import {database} from '@/db/storage';
import {member,fail,requireTerms} from '@/lib/member';
import {rateLimit,rateLimitCooldown} from '@/lib/rate-limit';
import {critiqueDraftInput,manuscriptParagraphs,validQualityNote} from '@/lib/critique-quality';
import {evaluateCritique} from '@/lib/jev';
import {z} from 'zod';
import {TERMS_VERSION} from '@/lib/workshop-policy';
export const dynamic='force-dynamic';
export const maxDuration=30;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export async function POST(request:Request) {
  try {
    if(request.headers.get('Origin')!==new URL(request.url).origin)fail('This request must come from the workshop.',403);
    const raw=await request.text();if(raw.length>100000)fail('This critique is too large for an optional check.',413);
    const input=z.object({workId:z.string().min(1).max(100),version:z.number().int().positive(),draft:critiqueDraftInput}).strict().parse(JSON.parse(raw));
    const db=database(),user=await member(db);if(!user)fail('Sign in to check your critique.',401);requireTerms(user.profile);
    const work=await db.prepare("SELECT w.content,w.request,w.version,w.genre,w.kind,w.stage,(w.author_id LIKE 'sample-%' OR EXISTS(SELECT 1 FROM profiles p WHERE p.id=w.author_id AND p.deleted_at=0 AND p.terms_version=?)) AS jev_review_available FROM works w WHERE w.id=? AND w.status NOT IN ('draft','withdrawn')").bind(TERMS_VERSION,input.workId).first<{content:string;request:string;version:number;genre:string;kind:string;stage:string;jev_review_available:boolean}>();
    if(!work)fail('This work is unavailable.',404);
    if(!work.jev_review_available)fail('Automatic checks will be available after the writer accepts the updated workshop terms.',403);
    if(work.version!==input.version)fail('This work changed. Reopen it before checking.',409);
    const paragraphs=manuscriptParagraphs(work.content);
    if(input.draft.annotations.some(note=>!validQualityNote(note,paragraphs)))fail('A line note does not match this version. Revisit the note before checking.');
    if(![input.draft.overall,input.draft.strengths,input.draft.suggestions,...input.draft.annotations.map(a=>a.body)].some(s=>s.trim()))fail('Add some feedback before checking.');
    await rateLimitCooldown(db,'critique-check-cadence:'+user.uid,2000);
    await rateLimit(db,'critique-check:'+user.uid,120,86400000);
    await rateLimit(db,'critique-check-global',1000,86400000);
    return json(await evaluateCritique(work.content,work.request,input.draft,process.env.VERCEL==='1'?request.headers.get('x-vercel-oidc-token'):null,work));
  }catch(e){
    if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Provide valid feedback for this check.'},400);
    const err=e as Error&{status?:number;retryAfter?:number};
    return Response.json({error:err.status?err.message:'The optional critique check is unavailable. You can still share your feedback.'},{status:err.status||503,headers:{'Cache-Control':'no-store',...(err.retryAfter?{'Retry-After':String(err.retryAfter)}:{})}});
  }
}
