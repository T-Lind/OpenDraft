import {database} from '@/db/storage';
import {createSession} from '@/lib/auth';
import {tokenHash} from '@/lib/password-auth';
import {requestRateLimit} from '@/lib/rate-limit';

export const dynamic='force-dynamic';
const redirect=(location:string)=>new Response(null,{status:302,headers:{Location:location,'Cache-Control':'no-store'}});

export async function GET(request:Request){
 try{
  await requestRateLimit(request,'verify-email',20,10*60_000);
  const url=new URL(request.url),raw=url.searchParams.get('token');
  if(!raw||raw.length>200)return redirect('/?auth_error=invalid_verification');
  const hash=await tokenHash(raw),now=Date.now(),db=database();
  const verified=await db.prepare("WITH claimed AS (DELETE FROM auth_tokens WHERE token_hash=? AND kind='verify' AND expires_at>=? RETURNING profile_id), updated AS (UPDATE auth_credentials SET email_verified_at=?,updated_at=? WHERE profile_id=(SELECT profile_id FROM claimed) RETURNING profile_id,email) SELECT u.profile_id,u.email,p.name,p.session_valid_after FROM updated u JOIN profiles p ON p.id=u.profile_id WHERE p.deleted_at=0").bind(hash,now,now,now).first<{profile_id:string;email:string;name:string;session_valid_after:number}>();
  if(!verified)return redirect('/?auth_error=invalid_verification');
  await createSession({id:verified.profile_id,email:verified.email,name:verified.name||'Writer',issuedAt:Number(verified.session_valid_after)||0});
  return redirect('/#Onboarding');
 }catch{return redirect('/?auth_error=verification_failed');}
}
