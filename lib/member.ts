import { getSessionUser } from '@/lib/auth';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import type { Database } from '@/db/storage';
export const TERMS_VERSION='2026-10-03';
export function fail(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export async function member(db:Database,provision=false){
 const session=await getSessionUser();const legacy=session?null:await getChatGPTUser();
 const uid=session?.id||legacy?.userId;if(!uid)return null;
 const email=session?.email||legacy?.email||'';
 if(provision)await db.prepare('INSERT INTO profiles(id,name,email,created_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(uid,'Writer',email,Date.now()).run();
 let profile=await db.prepare('SELECT * FROM profiles WHERE id=?').bind(uid).first();
 if(!profile)return null;
 if(Number(profile.session_valid_after)>Number(session?.issuedAt||0))fail('This session has ended. Please sign in again.',401);
 if(Number(profile.deleted_at)){
  if(!provision||!session)fail('This account was deleted. Sign in again to create a fresh profile.',401);
  await db.prepare("UPDATE profiles SET deleted_at=0,email=?,credits=5,name='Writer',onboarding_completed=false,created_at=? WHERE id=? AND deleted_at>0").bind(email,Date.now(),uid).run();
  profile=await db.prepare('SELECT * FROM profiles WHERE id=?').bind(uid).first();
 }
 return {uid,email,profile:profile!,isAdmin:!!email&&(process.env.ADMIN_EMAILS||process.env.ADMIN_EMAIL||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase())};
}
export function requireTerms(profile:Record<string,unknown>){if(profile.terms_version!==TERMS_VERSION)fail('Please review and accept the workshop terms before sharing contributions.',428);}
export async function canContact(db:Database,from:string,to:string){
 const result=await db.prepare("SELECT p.name,p.friends_only,EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=? AND b.blocked_id=p.id) OR (b.user_id=p.id AND b.blocked_id=?)) AS blocked,EXISTS(SELECT 1 FROM friendships f WHERE f.low_id=LEAST(?,p.id) AND f.high_id=GREATEST(?,p.id) AND f.status='accepted') AS friends FROM profiles p WHERE p.id=? AND p.deleted_at=0 AND p.onboarding_completed=true").bind(from,from,from,from,to).first();
 return result;
}
