import type {Database} from '@/db/storage';
import {fail} from './member';
import {readEnv} from '@/lib/auth';
import {after} from 'next/server';
import {z} from 'zod';

export const workUpdateLabels:Record<string,string>={reminder:'Your reading reminder',critique:'New feedback',revision:'New revision posted',readingRoom:'Now in the reading room',completed:'Requested critiques complete'};
export const mailConfigured=()=>!!readEnv('RESEND_API_KEY')&&!!readEnv('AUTH_EMAIL_FROM')&&!!readEnv('AUTH_SECRET')&&!!readEnv('AUTH_APP_URL');
const verifiedSQL="(EXISTS(SELECT 1 FROM auth_identities ai WHERE ai.profile_id=p.id AND ai.provider='google') OR EXISTS(SELECT 1 FROM auth_credentials ac WHERE ac.profile_id=p.id AND ac.email_verified_at>0 AND ac.email=p.email))";
const unblockedSQL="NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=p.id AND b.blocked_id=w.author_id) OR (b.user_id=w.author_id AND b.blocked_id=p.id))";
export const workPreferenceInput=z.object({workId:z.string().min(1).max(100),feedUpdates:z.boolean().optional(),emailUpdates:z.boolean().optional(),read:z.boolean().optional(),reminderAt:z.number().int().positive().nullable().optional()}).strict().refine(value=>Object.keys(value).length>1,'Choose a setting to change.');
export async function workPreferenceStatus(db:Database,uid:string,workId:string){
 const work=await db.prepare("SELECT id,author_id,version FROM works WHERE id=? AND status NOT IN ('draft','withdrawn')").bind(workId).first();
 if(!work)fail('This work is unavailable.',404);
 const [preference,verified]=await Promise.all([
  db.prepare('SELECT * FROM work_preferences WHERE user_id=? AND work_id=?').bind(uid,workId).first(),
  db.prepare(`SELECT ${verifiedSQL} AS verified FROM profiles p WHERE p.id=? AND p.deleted_at=0`).bind(uid).first(),
 ]);
 return {workId,version:Number(work.version),feedUpdates:preference?!!preference.feed_updates:work.author_id===uid,emailUpdates:!!preference?.email_updates,read:!!preference?.read_at&&Number(preference.read_version)===Number(work.version),readVersion:Number(preference?.read_version||0),readAt:preference?.read_at?Number(preference.read_at):null,reminderAt:preference?.reminder_at&&!preference.reminder_fired_at?Number(preference.reminder_at):null,emailAvailable:mailConfigured()&&!!verified?.verified};
}
export async function changeWorkPreference(db:Database,uid:string,input:z.infer<typeof workPreferenceInput>,now=Date.now()){
 const status=await workPreferenceStatus(db,uid,input.workId);
 if(input.emailUpdates&&!status.emailAvailable)fail('Email updates need a verified account email and configured email delivery.',503);
 if(input.reminderAt&&(input.reminderAt<now+60000||input.reminderAt>now+365*86400000))fail('Choose a reminder between one minute and one year from now.');
 const updates:string[]=[],values:unknown[]=[];
 for(const [field,value] of [['feed_updates',input.feedUpdates],['email_updates',input.emailUpdates]] as const)if(value!==undefined){updates.push(field+'=?');values.push(value);}
 if(input.read!==undefined){updates.push('read_version=?','read_at=?');values.push(input.read?status.version:0,input.read?now:null);if(input.read){updates.push('reminder_at=NULL','reminder_fired_at=NULL');}}
 if(input.reminderAt!==undefined){updates.push('reminder_at=?','reminder_fired_at=NULL');values.push(input.reminderAt);}
 await db.batch([
  db.prepare("INSERT INTO work_preferences(user_id,work_id,feed_updates,updated_at) SELECT ?,id,author_id=?,? FROM works WHERE id=? AND status NOT IN ('draft','withdrawn') ON CONFLICT(user_id,work_id) DO NOTHING").bind(uid,uid,now,input.workId),
  db.prepare(`UPDATE work_preferences SET ${updates.join(',')},updated_at=? WHERE user_id=? AND work_id=? AND EXISTS(SELECT 1 FROM works w WHERE w.id=work_id AND w.version=? AND w.status NOT IN ('draft','withdrawn')) RETURNING work_id`).bind(...values,now,uid,input.workId,status.version),
  ...(input.read===true?[db.prepare("UPDATE work_notifications SET read_at=COALESCE(read_at,?),email_requested=false WHERE user_id=? AND work_id=? AND kind='reminder'").bind(now,uid,input.workId)]:[]),
  ...(input.emailUpdates===false?[db.prepare('UPDATE work_notifications SET email_requested=false WHERE user_id=? AND work_id=? AND email_sent_at IS NULL').bind(uid,input.workId)]:[]),
 ]).then(result=>{if(!result[1].meta.changes)fail('This work changed. Refresh before changing its reading options.',409);});
 return workPreferenceStatus(db,uid,input.workId);
}
export async function enqueueReadingReminders(db:Database,uid?:string,now=Date.now()){
 const statement=db.prepare(`WITH due AS (
  SELECT s.user_id,s.work_id,s.reminder_at,s.email_updates FROM work_preferences s JOIN profiles p ON p.id=s.user_id JOIN works w ON w.id=s.work_id
  WHERE s.reminder_at<=? AND s.reminder_fired_at IS NULL AND p.deleted_at=0 AND w.status NOT IN ('draft','withdrawn') AND ${unblockedSQL}${uid?' AND s.user_id=?':''}
  ORDER BY s.reminder_at,s.user_id,s.work_id LIMIT 500 FOR UPDATE OF s SKIP LOCKED
 ), notified AS (
  INSERT INTO work_notifications(user_id,work_id,target_work_id,event_key,kind,feed,created_at,email_requested)
  SELECT user_id,work_id,work_id,'reminder:'||work_id||':'||reminder_at,'reminder',true,?,email_updates FROM due ON CONFLICT(user_id,event_key) DO NOTHING RETURNING id
 ) UPDATE work_preferences s SET reminder_fired_at=s.reminder_at FROM due WHERE s.user_id=due.user_id AND s.work_id=due.work_id AND s.reminder_at=due.reminder_at RETURNING s.work_id`).bind(now,...(uid?[uid]:[]),now);
 return (await db.batch([statement]))[0];
}
export const visibleWorkNotificationsSQL="FROM work_notifications n JOIN works w ON w.id=n.work_id JOIN works target ON target.id=n.target_work_id WHERE n.user_id=? AND n.feed=true AND w.status NOT IN ('draft','withdrawn') AND target.status NOT IN ('draft','withdrawn') AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=n.user_id AND b.blocked_id=w.author_id) OR (b.user_id=w.author_id AND b.blocked_id=n.user_id))";
const escapeHtml=(value:string)=>value.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]!));
async function signingKey(){const secret=readEnv('AUTH_SECRET');if(!secret)throw new Error('Notification signing is not configured.');return crypto.subtle.importKey('raw',new TextEncoder().encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);}
export async function unsubscribeToken(uid:string,workId:string,now=Date.now()){
 const payload=Buffer.from(JSON.stringify({uid,workId,expiresAt:now+180*86400000})).toString('base64url');
 const signature=await crypto.subtle.sign('HMAC',await signingKey(),new TextEncoder().encode('work-email:'+payload));
 return payload+'.'+Buffer.from(signature).toString('base64url');
}
export async function verifyUnsubscribeToken(token:string,now=Date.now()){
 if(token.length>1000)fail('This unsubscribe link is invalid.');
 try{const [payload,signature,...rest]=token.split('.');if(rest.length||!payload||!signature||!await crypto.subtle.verify('HMAC',await signingKey(),Buffer.from(signature,'base64url'),new TextEncoder().encode('work-email:'+payload)))fail('This unsubscribe link is invalid.');
  const data=z.object({uid:z.string().min(1).max(100),workId:z.string().min(1).max(100),expiresAt:z.number().int()}).strict().parse(JSON.parse(Buffer.from(payload,'base64url').toString()));if(data.expiresAt<now)fail('This link expired. Turn off email updates on the work page.');return data;
 }catch{fail('This unsubscribe link is invalid or expired.');}
}
export async function unsubscribeWorkEmail(db:Database,token:string){
 const {uid,workId}=await verifyUnsubscribeToken(token);
 await db.batch([db.prepare('UPDATE work_preferences SET email_updates=false,updated_at=? WHERE user_id=? AND work_id=?').bind(Date.now(),uid,workId),db.prepare('UPDATE work_notifications SET email_requested=false WHERE user_id=? AND work_id=? AND email_sent_at IS NULL').bind(uid,workId)]);
}
export async function deliverWorkEmails(db:Database,now=Date.now()){
 if(!mailConfigured())return {sent:0,configured:false};
 const app=new URL(readEnv('AUTH_APP_URL')!);if(app.protocol!=='https:'&&readEnv('NODE_ENV')==='production')throw new Error('Email links require the configured HTTPS application URL.');
 const lease=now+120000;
 const claimed=await db.prepare(`UPDATE work_notifications n SET email_lease_until=?,email_started_at=COALESCE(email_started_at,?),email_attempts=email_attempts+1 WHERE id IN (
  SELECT n.id FROM work_notifications n WHERE n.email_requested=true AND n.email_sent_at IS NULL AND n.email_attempts<7 AND n.email_next_at<=? AND n.email_lease_until<=? AND (n.email_started_at IS NULL OR n.email_started_at>?) ORDER BY n.created_at,n.id LIMIT 5 FOR UPDATE SKIP LOCKED
 ) RETURNING n.*`).bind(lease,now,now,now,now-23*3600000).all();
 let sent=0;
 for(const notification of claimed.results){
  const recipient=await db.prepare(`SELECT p.email,w.title,target.title AS target_title FROM profiles p JOIN work_preferences s ON s.user_id=p.id JOIN works w ON w.id=s.work_id JOIN works target ON target.id=? WHERE p.id=? AND s.work_id=? AND s.email_updates=true AND p.deleted_at=0 AND p.email<>'' AND ${verifiedSQL} AND ${unblockedSQL} AND w.status NOT IN ('draft','withdrawn') AND target.status NOT IN ('draft','withdrawn') AND EXISTS(SELECT 1 FROM work_notifications n WHERE n.id=? AND n.email_requested=true)`).bind(notification.target_work_id,notification.user_id,notification.work_id,notification.id).first();
  if(!recipient){await db.prepare('UPDATE work_notifications SET email_requested=false,email_lease_until=0 WHERE id=? AND email_lease_until=?').bind(notification.id,lease).run();continue;}
  const title=String(recipient.target_title),label=workUpdateLabels[String(notification.kind)]||'Work update';
  const workURL=new URL('/#story/'+encodeURIComponent(String(notification.target_work_id)),app).toString();
  const unsubscribeURL=new URL('/api/work-updates/unsubscribe',app);unsubscribeURL.searchParams.set('token',await unsubscribeToken(String(notification.user_id),String(notification.work_id),Number(notification.email_started_at)));
  try{
   const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+readEnv('RESEND_API_KEY'),'Content-Type':'application/json','Idempotency-Key':'work-update-'+notification.id},signal:AbortSignal.timeout(8000),body:JSON.stringify({from:readEnv('AUTH_EMAIL_FROM'),to:[recipient.email],subject:(label+': '+title).replace(/[\r\n]/g,' ').slice(0,180),text:`${label}: ${title}\n\nOpen the work: ${workURL}\n\nTurn off email updates for this work: ${unsubscribeURL}`,html:`<p>${escapeHtml(label)}: <strong>${escapeHtml(title)}</strong></p><p><a href="${escapeHtml(workURL)}">Open the work</a></p><p><a href="${escapeHtml(unsubscribeURL.toString())}">Turn off email updates for this work</a></p>`,headers:{'List-Unsubscribe':'<'+unsubscribeURL+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}})});
   if(!response.ok)throw new Error('Mail delivery failed');
   await db.prepare('UPDATE work_notifications SET email_sent_at=?,email_lease_until=0 WHERE id=? AND email_lease_until=?').bind(Date.now(),notification.id,lease).run();sent++;
  }catch{await db.prepare('UPDATE work_notifications SET email_next_at=?,email_lease_until=0 WHERE id=? AND email_lease_until=?').bind(now+Math.min(6*3600000,60000*2**Number(notification.email_attempts)),notification.id,lease).run();}
 }
 return {sent,configured:true};
}
export function scheduleWorkEmails(db:Database){if(mailConfigured())after(async()=>{try{await deliverWorkEmails(db);}catch{console.error('Work update email delivery will retry.');}});}
