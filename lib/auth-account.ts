import type {SessionUser} from './auth';
import type {Database} from '@/db/storage';
import {normalizeEmail} from './password-auth';

type IdentityRow={profile_id:string;name:string;email:string;session_valid_after:number};

export async function resolveGoogleAccount(db:Database,user:SessionUser):Promise<SessionUser>{
 const subject=user.id.startsWith('google_')?user.id.slice(7):user.id;
 const email=normalizeEmail(user.email),now=Date.now();
 const linked=await db.prepare("SELECT i.profile_id,p.name,p.email,p.session_valid_after FROM auth_identities i JOIN profiles p ON p.id=i.profile_id WHERE i.provider='google' AND i.subject=?").bind(subject).first<IdentityRow>();
 if(linked){
  await db.batch([
   db.prepare("UPDATE auth_identities SET email=?,last_used_at=? WHERE provider='google' AND subject=?").bind(email,now,subject),
   db.prepare("UPDATE profiles SET email=CASE WHEN email='' THEN ? ELSE email END WHERE id=?").bind(email,linked.profile_id),
  ]);
  return{id:linked.profile_id,email:linked.email||email,name:linked.name||'Writer',issuedAt:Number(linked.session_valid_after)||0};
 }
 const credential=await db.prepare('SELECT c.profile_id,p.name,p.email,p.session_valid_after FROM auth_credentials c JOIN profiles p ON p.id=c.profile_id WHERE c.email=? AND c.email_verified_at>0 AND p.deleted_at=0').bind(email).first<IdentityRow>();
 const legacy=credential?null:await db.prepare('SELECT id AS profile_id,name,email,session_valid_after FROM profiles WHERE (id=? OR LOWER(email)=?) AND deleted_at=0 ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1').bind(user.id,email,user.id).first<IdentityRow>();
 const profileId=credential?.profile_id||legacy?.profile_id||user.id;
 await db.batch([
  db.prepare("INSERT INTO profiles(id,name,email,created_at) VALUES(?,'Writer',?,?) ON CONFLICT(id) DO UPDATE SET email=CASE WHEN profiles.email='' THEN excluded.email ELSE profiles.email END").bind(profileId,email,now),
  db.prepare("INSERT INTO auth_identities(provider,subject,profile_id,email,created_at,last_used_at) VALUES('google',?,?,?,?,?) ON CONFLICT(provider,subject) DO UPDATE SET profile_id=excluded.profile_id,email=excluded.email,last_used_at=excluded.last_used_at").bind(subject,profileId,email,now,now),
 ]);
 return{id:profileId,email,name:credential?.name||legacy?.name||'Writer',issuedAt:Number(credential?.session_valid_after||legacy?.session_valid_after)||0};
}
