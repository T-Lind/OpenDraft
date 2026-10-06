import { database } from '@/db/storage';
import { member, fail, requireTerms } from '@/lib/member';
import { rateLimit } from '@/lib/rate-limit';
import { evaluateContentThemes } from '@/lib/jev';
import { z } from 'zod';

export const dynamic='force-dynamic';
export const maxDuration=30;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request){
  try {
    if(request.headers.get('Origin')!==new URL(request.url).origin)fail('This request must come from the workshop.',403);
    const raw=await request.text();if(raw.length>60000)fail('This draft is too large for an optional theme check.',413);
    const input=z.object({content:z.string().trim().min(1).max(50000)}).strict().parse(JSON.parse(raw));
    const db=database(),user=await member(db);if(!user)fail('Sign in to check your draft.',401);requireTerms(user.profile);
    await rateLimit(db,'theme-check:'+user.uid,5,86400000);
    await rateLimit(db,'theme-check-global',25,86400000);
    return json(await evaluateContentThemes(input.content,process.env.VERCEL==='1'?request.headers.get('x-vercel-oidc-token'):null));
  } catch(e) {
    if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Please provide a draft for this check.'},400);
    const err=e as Error&{status?:number;retryAfter?:number};
    // Never log manuscript text or provider output, and never block publishing.
    return Response.json({error:err.status?err.message:'The optional theme check is unavailable. Choose content notes yourself; publishing still works.'},{status:err.status||503,headers:{'Cache-Control':'no-store',...(err.retryAfter?{'Retry-After':String(err.retryAfter)}:{})}});
  }
}
