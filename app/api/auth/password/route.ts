import {z} from 'zod';
import {database} from '@/db/storage';
import {createSession,readEnv} from '@/lib/auth';
import {rateLimit,requestRateLimit} from '@/lib/rate-limit';
import {emailPasswordConfigured,hashPassword,newAuthToken,normalizeEmail,sendAuthEmail,tokenHash,verifyPassword} from '@/lib/password-auth';

export const dynamic='force-dynamic';
const emailSchema=z.string().trim().email().max(254).transform(normalizeEmail);
const passwordSchema=z.string().min(12,'Use at least 12 characters.').max(256);
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const DUMMY_HASH='pbkdf2-sha256$600000$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

function appOrigin(request:Request):string{
 const configured=readEnv('AUTH_APP_URL');
 if(configured){const url=new URL(configured);if(!['http:','https:'].includes(url.protocol))throw new Error('AUTH_APP_URL must be an HTTP(S) URL.');return url.origin;}
 return new URL(request.url).origin;
}

async function issueToken(request:Request,profileId:string,email:string,kind:'verify'|'reset'){
 const db=database(),raw=newAuthToken(),hash=await tokenHash(raw),now=Date.now();
 const expires=now+(kind==='verify'?24*60:30)*60_000;
 await db.batch([
  db.prepare('DELETE FROM auth_tokens WHERE profile_id=? AND kind=?').bind(profileId,kind),
  db.prepare('INSERT INTO auth_tokens(token_hash,profile_id,kind,expires_at,created_at) VALUES(?,?,?,?,?)').bind(hash,profileId,kind,expires,now),
 ]);
 const path=kind==='verify'?`/api/auth/verify?token=${encodeURIComponent(raw)}`:`/auth/reset?token=${encodeURIComponent(raw)}`;
 return sendAuthEmail(email,kind,appOrigin(request)+path);
}

export async function POST(request:Request){
 try{
  if(request.headers.get('Origin')!==new URL(request.url).origin)return json({error:'This request must come from OpenDraft.'},403);
  if(!emailPasswordConfigured())return json({error:'Email and password sign-in is not configured yet.'},503);
  await requestRateLimit(request,'password-auth',20,10*60_000);
  const raw=await request.text();if(raw.length>20_000)return json({error:'This request is too large.'},413);
  const body=JSON.parse(raw) as Record<string,unknown>;
  const action=z.enum(['register','login','resend','requestReset','reset']).parse(body.action);
  const db=database(),now=Date.now();

  if(action==='reset'){
   const token=z.string().min(20).max(200).parse(body.token),password=passwordSchema.parse(body.password);
   const hash=await tokenHash(token),passwordHash=await hashPassword(password);
   const changed=await db.prepare("WITH claimed AS (DELETE FROM auth_tokens WHERE token_hash=? AND kind='reset' AND expires_at>=? RETURNING profile_id) UPDATE auth_credentials SET password_hash=?,updated_at=? WHERE profile_id=(SELECT profile_id FROM claimed) RETURNING profile_id,email").bind(hash,now,passwordHash,now).first<{profile_id:string;email:string}>();
   if(!changed)return json({error:'This reset link is invalid or expired.'},400);
   const validAfter=Math.floor(now/1000)+1;
   await db.prepare('UPDATE profiles SET session_valid_after=? WHERE id=?').bind(validAfter,changed.profile_id).run();
   const profile=await db.prepare('SELECT name FROM profiles WHERE id=? AND deleted_at=0').bind(changed.profile_id).first<{name:string}>();
   if(!profile)return json({error:'This account is unavailable.'},403);
   await createSession({id:changed.profile_id,email:changed.email,name:profile.name||'Writer',issuedAt:validAfter});
   return json({ok:true});
  }

  const email=emailSchema.parse(body.email),emailKey=await tokenHash(email);
  await rateLimit(db,`auth-email:${emailKey}`,8,15*60_000,now);
  const existing=await db.prepare('SELECT c.profile_id,c.password_hash,c.email_verified_at,p.name,p.deleted_at,p.session_valid_after FROM auth_credentials c JOIN profiles p ON p.id=c.profile_id WHERE c.email=?').bind(email).first<{profile_id:string;password_hash:string;email_verified_at:number;name:string;deleted_at:number;session_valid_after:number}>();

  if(action==='login'){
   const password=passwordSchema.parse(body.password),valid=await verifyPassword(password,existing?.password_hash||DUMMY_HASH);
   if(!existing||!valid||existing.deleted_at)return json({error:'The email or password is incorrect.'},401);
   if(!existing.email_verified_at)return json({error:'Verify your email before signing in.',code:'unverified'},403);
   await createSession({id:existing.profile_id,email,name:existing.name||'Writer',issuedAt:Number(existing.session_valid_after)||0});
   return json({ok:true});
  }

  if(action==='requestReset'){
   let devUrl:string|undefined;
   if(existing?.email_verified_at&&!existing.deleted_at)({devUrl}=await issueToken(request,existing.profile_id,email,'reset'));
   return json({ok:true,message:'If that address has an account, a reset link is on its way.',...(devUrl?{devUrl}:{})});
  }

  if(action==='resend'){
   let devUrl:string|undefined;
   if(existing&&!existing.email_verified_at&&!existing.deleted_at)({devUrl}=await issueToken(request,existing.profile_id,email,'verify'));
   return json({ok:true,message:'If that address is awaiting verification, a new link is on its way.',...(devUrl?{devUrl}:{})});
  }

  const password=passwordSchema.parse(body.password);
  if(existing?.email_verified_at&&!existing.deleted_at)return json({error:'An account already uses this email. Sign in or reset its password.'},409);
  const passwordHash=await hashPassword(password);
  let profileId=existing?.profile_id;
  if(!profileId){
   const linked=await db.prepare('SELECT id FROM profiles WHERE LOWER(email)=? AND deleted_at=0 ORDER BY created_at LIMIT 1').bind(email).first<{id:string}>();
   profileId=linked?.id||crypto.randomUUID();
   await db.batch([
    db.prepare("INSERT INTO profiles(id,name,email,created_at) VALUES(?,'Writer',?,?) ON CONFLICT(id) DO UPDATE SET email=CASE WHEN profiles.email='' THEN excluded.email ELSE profiles.email END").bind(profileId,email,now),
    db.prepare('INSERT INTO auth_credentials(profile_id,email,password_hash,email_verified_at,created_at,updated_at) VALUES(?,?,?,0,?,?)').bind(profileId,email,passwordHash,now,now),
   ]);
  }else await db.prepare('UPDATE auth_credentials SET password_hash=?,updated_at=? WHERE profile_id=? AND email_verified_at=0').bind(passwordHash,now,profileId).run();
  const sent=await issueToken(request,profileId,email,'verify');
  return json({ok:true,message:'Check your email to verify your account.',...sent},201);
 }catch(error){
  if(error instanceof z.ZodError)return json({error:error.issues[0]?.message||'Please check your details.'},400);
  if(error instanceof SyntaxError)return json({error:'Please send a valid request.'},400);
  const e=error as Error&{status?:number;retryAfter?:number};
  if(e.status)return Response.json({error:e.message},{status:e.status,headers:{'Cache-Control':'no-store',...(e.retryAfter?{'Retry-After':String(e.retryAfter)}:{})}});
  console.error('Password authentication:',e);
  return json({error:'Authentication is temporarily unavailable. Please try again.'},503);
 }
}
