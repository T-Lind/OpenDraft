import {database} from '@/db/storage';
import {destroySession} from '@/lib/auth';
import {z} from 'zod';
import {member,fail,requireTerms,TERMS_VERSION,canContact} from '@/lib/member';
import {reputations} from '@/lib/reputation';
import {communityRead,showcaseEligibility} from '@/lib/community-read';
import {rateLimit,requestRateLimit} from '@/lib/rate-limit';
import {deleteAccount} from '@/lib/account-deletion';
import {evaluateShowcase} from '@/lib/jev';
import {camel} from '@/lib/workshop-query';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
function error(e:unknown){const err=e as Error&{status?:number;retryAfter?:number};if(e instanceof SyntaxError)return json({error:'Invalid JSON request.'},400);if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Invalid request.'},400);if(!err.status)console.error('Community operation failed');return Response.json({error:err.status?err.message:'This action could not complete. Please retry.'},{status:err.status||503,headers:{'Cache-Control':'no-store',...(err.retryAfter?{'Retry-After':String(err.retryAfter)}:{})}});}
export async function GET(request:Request){
 try{
  await requestRateLimit(request,'community-read',90,60000);
  const db=database(),params=new URL(request.url).searchParams,section=params.get('section');
  if(section==='reputation'){const ids=[...new Set((params.get('ids')||'').split(',').filter(Boolean))];if(ids.length>20||ids.some(id=>id.length>100))fail('Choose at most 20 reviewers.');return json({items:await reputations(db,ids)});}
  if(section==='showcase'){
   const row=await db.prepare('SELECT s.day,s.note,w.id,w.title,w.author,w.author_id,w.genre,w.kind,w.words,w.warning,w.mature FROM showcases s JOIN works w ON w.id=s.work_id JOIN profiles p ON p.id=w.author_id WHERE s.day=? AND '+showcaseEligibility).bind(new Date().toISOString().slice(0,10)).first();return json({showcase:row?camel(row):null});
  }
  const user=await member(db);if(!user)fail('Sign in to continue.',401);
  return json(await communityRead(db,user.uid,user.isAdmin,params));
 }catch(e){return error(e);}
}
export async function POST(request:Request){
 try{
  if(request.headers.get('Origin')!==new URL(request.url).origin)fail('This request must come from the workshop.',403);
  const raw=await request.text();if(raw.length>12000)fail('This request is too large.',413);
  const b=JSON.parse(raw) as Record<string,unknown>,db=database(),user=await member(db);if(!user)fail('Sign in to continue.',401);
  const {uid,profile,isAdmin}=user,now=Date.now(),action=String(b.action);
  await rateLimit(db,'community-write:'+uid,60,60000,now);
  const id=()=>z.string().min(1).max(100).parse(b.id);
  const audit=(target:string,reason='',details='')=>db.prepare('INSERT INTO admin_actions(id,admin_id,action,target_id,reason,details,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),uid,action,target,reason,details,now);
  if(action==='acceptTerms'){
   if(b.accepted!==true||b.version!==TERMS_VERSION)fail('Please confirm the current terms and privacy policy.');
   await db.prepare('UPDATE profiles SET terms_version=?,terms_accepted_at=? WHERE id=? AND deleted_at=0').bind(TERMS_VERSION,now,uid).run();return json({ok:true,version:TERMS_VERSION});
  }
  if(action==='settings'){const friendsOnly=z.boolean().parse(b.friendsOnly);await db.prepare('UPDATE profiles SET friends_only=? WHERE id=? AND deleted_at=0').bind(friendsOnly,uid).run();return json({ok:true});}
  if(action==='revokeSessions'){
   await rateLimit(db,'session-revoke:'+uid,5,86400000,now);
   await db.prepare('UPDATE profiles SET session_valid_after=? WHERE id=? AND deleted_at=0').bind(Math.floor(now/1000)+1,uid).run();
   await destroySession();return json({ok:true});
  }
  if(action==='deleteAccount'){
   if(b.confirmation!=='DELETE')fail('Type DELETE to confirm account deletion.');
   await rateLimit(db,'account-delete:'+uid,1,86400000,now);await deleteAccount(db,uid);await destroySession();return json({ok:true,deleted:true});
  }
  if(action==='block'||action==='unblock'){
   const other=id();if(other===uid)fail('You cannot block yourself.');
   if(action==='block'){
    if(!await db.prepare('SELECT id FROM profiles WHERE id=? AND deleted_at=0').bind(other).first())fail('That member is unavailable.',404);
    await db.batch([db.prepare('INSERT INTO member_blocks(id,user_id,blocked_id,created_at) VALUES(?,?,?,?) ON CONFLICT(user_id,blocked_id) DO NOTHING').bind(crypto.randomUUID(),uid,other,now),db.prepare('DELETE FROM friendships WHERE low_id=LEAST(?,?) AND high_id=GREATEST(?,?)').bind(uid,other,uid,other)]);
   }else await db.prepare('DELETE FROM member_blocks WHERE user_id=? AND blocked_id=?').bind(uid,other).run();
   return json({ok:true});
  }
  if(action==='reportMessage'){
   const messageId=id(),reason=z.string().trim().min(10).max(1000).parse(b.reason);
   const message=await db.prepare('SELECT id,sender_id,body FROM messages m WHERE id=? AND recipient_id=? AND sender_id<>? AND created_at>=COALESCE((SELECT p.session_valid_after*1000 FROM profiles p WHERE p.id=m.recipient_id),0)').bind(messageId,uid,uid).first();if(!message)fail('Only a recipient can report an incoming message.',403);
   await rateLimit(db,'message-report:'+uid,10,3600000,now);
   await db.prepare("INSERT INTO message_reports(id,user_id,message_id,sender_id,body,reason,created_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,message_id) DO UPDATE SET reason=excluded.reason,status='open',resolution='',resolved_at=NULL,created_at=excluded.created_at").bind(crypto.randomUUID(),uid,messageId,message.sender_id,message.body,reason,now).run();return json({ok:true});
  }
  if(['resolveCase','resolveLegal','redactCase','redactLegal'].includes(action)){
   if(!isAdmin)fail('Administrator access is required.',403);
   const caseId=id(),reason=z.string().trim().min(5).max(1000).parse(b.reason);
   const table=action==='resolveCase'||action==='redactCase'?'message_reports':'legal_requests';
   const redact=action.startsWith('redact');
   const statement=redact?db.prepare("UPDATE "+table+" SET body='[Evidence removed after retention review]',"+(table==='legal_requests'?"name='Contact details removed',email='',":"reason='[Report details removed after retention review]',")+"resolution=resolution||? WHERE id=? AND status='resolved' AND body<>'[Evidence removed after retention review]'").bind('\nRetention review '+new Date(now).toISOString()+': '+reason,caseId):db.prepare("UPDATE "+table+" SET status='resolved',resolution=?,resolved_at=? WHERE id=? AND status='open'").bind(reason,now,caseId);
   const result=await db.batch([statement,audit(caseId,reason)]);
   if(!result[0].meta.changes)fail('This request already changed or is unavailable. Resolve an open case before removing its evidence.',409);return json({ok:true});
  }
  requireTerms(profile);
  if(action==='adoptCircle'){
   if(!isAdmin)fail('Administrator access is required.',403);
   const circleId=id();const result=await db.batch([db.prepare("UPDATE circles SET owner_id=? WHERE id=? AND owner_id='system'").bind(uid,circleId),db.prepare("INSERT INTO memberships(id,user_id,circle_id) SELECT ?,?,id FROM circles WHERE id=? AND owner_id=? ON CONFLICT(user_id,circle_id) DO NOTHING").bind(crypto.randomUUID(),uid,circleId,uid),audit(circleId,z.string().trim().min(5).max(500).parse(b.reason))]);if(!result[0].meta.changes)fail('This circle already has an owner.',409);return json({ok:true});
  }
  if(['friendRequest','acceptFriend','rejectFriend','cancelFriend','removeFriend'].includes(action)){
   const other=id();if(other===uid)fail('You cannot send yourself a friend request.');
   const low=[uid,other].sort()[0],high=[uid,other].sort()[1];
   if(action==='friendRequest'){
    const contact=await canContact(db,uid,other);if(!contact||contact.blocked)fail('This writer cannot receive your request.',403);
    await rateLimit(db,'friend-request:'+uid,10,86400000,now);
    const result=await db.batch([db.prepare("INSERT INTO friendships(id,low_id,high_id,requester_id,status,created_at,updated_at) SELECT ?,?,?,?,'pending',?,? WHERE NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=? AND b.blocked_id=?) OR (b.user_id=? AND b.blocked_id=?)) ON CONFLICT(low_id,high_id) DO UPDATE SET requester_id=excluded.requester_id,status='pending',created_at=excluded.created_at,updated_at=excluded.updated_at WHERE friendships.status='rejected' AND friendships.updated_at<? RETURNING id").bind(crypto.randomUUID(),low,high,uid,now,now,uid,other,other,uid,now-7*86400000)]);if(!result[0].meta.changes)fail('A friendship or recent request already exists. Check Friends for its status.',409);
   }else{
    const query=action==='acceptFriend'?"UPDATE friendships SET status='accepted',updated_at=? WHERE low_id=? AND high_id=? AND status='pending' AND requester_id<>?":action==='rejectFriend'?"UPDATE friendships SET status='rejected',updated_at=? WHERE low_id=? AND high_id=? AND status='pending' AND requester_id<>?":action==='cancelFriend'?"DELETE FROM friendships WHERE low_id=? AND high_id=? AND status='pending' AND requester_id=?":"DELETE FROM friendships WHERE low_id=? AND high_id=? AND status='accepted'";
    const contact=await canContact(db,uid,other);if(action==='acceptFriend'&&(!contact||contact.blocked))fail('This request is unavailable.',403);
    const values=action==='acceptFriend'||action==='rejectFriend'?[now,low,high,uid]:action==='cancelFriend'?[low,high,uid]:[low,high];
    const result=await db.prepare(query).bind(...values).run();if(!result.meta.changes)fail('This friendship request has already changed. Refresh the list.',409);
   }return json({ok:true});
  }
  if(action==='rateCritique'||action==='removeRating'){
   const reviewId=id(),review=await db.prepare('SELECT r.user_id FROM reviews r JOIN works w ON w.id=r.work_id WHERE r.id=? AND w.author_id=? AND r.user_id<>?').bind(reviewId,uid,uid).first();if(!review)fail('Only the writer who received this critique may rate it.',403);
   await rateLimit(db,'rating:'+uid,60,3600000,now);
   if(action==='removeRating')await db.prepare('DELETE FROM critique_ratings WHERE review_id=? AND rater_id=?').bind(reviewId,uid).run();
   else{
    const score=z.number().int().min(1).max(5),u=score.parse(b.usefulness),s=score.parse(b.specificity),a=score.parse(b.actionability);
    const result=await db.prepare('INSERT INTO critique_ratings(id,review_id,rater_id,reviewer_id,usefulness,specificity,actionability,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(review_id) DO UPDATE SET usefulness=excluded.usefulness,specificity=excluded.specificity,actionability=excluded.actionability,updated_at=excluded.updated_at WHERE critique_ratings.rater_id=excluded.rater_id AND critique_ratings.created_at>=? RETURNING id').bind(crypto.randomUUID(),reviewId,uid,review.user_id,u,s,a,now,now,now-7*86400000).first();if(!result)fail('Ratings can be edited for seven days. You may still remove your rating.',409);
   }return json({ok:true,reputation:(await reputations(db,[String(review.user_id)]))[0]});
  }
  if(action==='showcaseConsent'){
   const workId=id(),optIn=z.boolean().parse(b.optIn),aiConsent=z.boolean().parse(b.aiConsent);
   if(aiConsent&&!optIn)fail('Showcase evaluation requires showcase opt-in.');
   const result=await db.prepare("UPDATE works SET showcase_opt_in=?,ai_showcase_consent=?,ai_assessment=CASE WHEN ? THEN ai_assessment ELSE '' END,ai_assessed_at=CASE WHEN ? THEN ai_assessed_at ELSE 0 END WHERE id=? AND author_id=? AND status NOT IN ('draft','withdrawn')").bind(optIn,aiConsent,aiConsent,aiConsent,workId,uid).run();if(!result.meta.changes)fail('Only your published writing can enter the showcase.',403);return json({ok:true});
  }
  if(['evaluateShowcase','pickShowcase','clearShowcase'].includes(action)){
   if(!isAdmin)fail('Administrator access is required.',403);
   if(action==='clearShowcase'){const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(b.day),reason=z.string().trim().min(5).max(500).parse(b.reason);await db.batch([db.prepare('DELETE FROM showcases WHERE day=?').bind(day),audit(day,reason)]);return json({ok:true});}
   const workId=id(),work=await db.prepare('SELECT w.* FROM works w JOIN profiles p ON p.id=w.author_id WHERE w.id=? AND '+showcaseEligibility).bind(workId).first();if(!work)fail('This work is no longer eligible for the showcase.',409);
   if(action==='evaluateShowcase'){
    if(!work.ai_showcase_consent)fail('The writer has not consented to Jev evaluation.',403);
    if(Number(work.ai_assessed_at)>now-86400000&&work.ai_assessment)return json({ok:true,assessment:JSON.parse(String(work.ai_assessment)),cached:true});
    await rateLimit(db,'jev-global',5,86400000,now);
    const assessment=await evaluateShowcase(String(work.content),String(work.request),process.env.VERCEL==='1'?request.headers.get('x-vercel-oidc-token'):null);
    const result=await db.batch([db.prepare("UPDATE works SET ai_assessment=?,ai_assessed_at=? WHERE id=? AND ai_showcase_consent=true AND showcase_opt_in=true AND status NOT IN ('draft','withdrawn')").bind(JSON.stringify(assessment),now,workId),audit(workId,'Writer-consented Jev evaluation through Vercel AI Gateway.')]);if(!result[0].meta.changes)fail('Consent or availability changed during evaluation. The assessment was not saved.',409);
    return json({ok:true,assessment});
   }
   const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(b.day),date=Date.parse(day+'T00:00:00Z'),today=Date.parse(new Date(now).toISOString().slice(0,10)+'T00:00:00Z');
   if(!Number.isFinite(date)||new Date(date).toISOString().slice(0,10)!==day||date<today||date>today+30*86400000)fail('Choose today or a date within the next 30 days (UTC).');
   const note=z.string().trim().min(10).max(500).parse(b.note);
   const alternativeEligibility=showcaseEligibility.replaceAll("w.","alternative.").replaceAll("p.","other_profile.");
   const rotation=" AND (w.genre NOT IN (SELECT genre FROM adjacent_genres) OR NOT EXISTS(SELECT 1 FROM works alternative JOIN profiles other_profile ON other_profile.id=alternative.author_id CROSS JOIN selection WHERE "+alternativeEligibility+" AND alternative.genre NOT IN (SELECT genre FROM adjacent_genres) AND NOT EXISTS(SELECT 1 FROM showcases booked JOIN works featured ON featured.id=booked.work_id WHERE featured.author_id=alternative.author_id AND booked.day::date<>selection.day AND booked.day::date BETWEEN selection.day-29 AND selection.day+29)))";
   const result=await db.batch([db.prepare("WITH selection AS (SELECT ?::date AS day), adjacent_genres AS (SELECT previous.genre FROM showcases booked JOIN works previous ON previous.id=booked.work_id CROSS JOIN selection WHERE booked.day::date IN (selection.day-1,selection.day+1)) INSERT INTO showcases(day,work_id,admin_id,note,created_at) SELECT ?,w.id,?,?,? FROM works w JOIN profiles p ON p.id=w.author_id WHERE w.id=? AND "+showcaseEligibility+" AND NOT EXISTS(SELECT 1 FROM showcases s JOIN works previous ON previous.id=s.work_id WHERE previous.author_id=w.author_id AND s.day<>? AND s.day::date BETWEEN (?::date-29) AND (?::date+29)) "+rotation+" ON CONFLICT(day) DO UPDATE SET work_id=excluded.work_id,admin_id=excluded.admin_id,note=excluded.note,created_at=excluded.created_at").bind(day,day,uid,note,now,workId,day,day,day),audit(workId,'Showcase selection requested by an operator.',JSON.stringify({day}))]);if(!result[0].meta.changes)fail('Choose another author or genre for this date, or refresh the available candidates.',409);return json({ok:true});
  }
  fail('Unknown community action.');
 }catch(e){return error(e);}
}
