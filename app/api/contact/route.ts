import {database} from '@/db/storage';
import {requestRateLimit} from '@/lib/rate-limit';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function POST(request:Request){
 try{
  if(request.headers.get('Origin')!==new URL(request.url).origin)return Response.json({error:'Use the workshop contact form.'},{status:403});
  const raw=await request.text();if(raw.length>10000)return Response.json({error:'This request is too large.'},{status:413});
  const data=z.object({kind:z.enum(['general','privacy','copyright']),name:z.string().trim().min(2).max(100),email:z.string().trim().email().max(254),body:z.string().trim().min(20).max(5000),goodFaith:z.boolean().optional(),accurate:z.boolean().optional()}).parse(JSON.parse(raw));
  if(data.kind==='copyright'&&(!data.goodFaith||!data.accurate))return Response.json({error:'Confirm the copyright statements before sending.'},{status:400});
  await requestRateLimit(request,'contact',3,3600000);
  const id=crypto.randomUUID(),body=data.body+(data.kind==='copyright'?'\n\nElectronically signed by '+data.name+'. Sender confirms good faith and accuracy under penalty of perjury.':'');
  await database().prepare('INSERT INTO legal_requests(id,kind,name,email,body,created_at) VALUES(?,?,?,?,?,?)').bind(id,data.kind,data.name,data.email,body,Date.now()).run();
  return Response.json({ok:true,reference:id},{headers:{'Cache-Control':'no-store'}});
 }catch(e){const err=e as Error&{status?:number;retryAfter?:number};return Response.json({error:e instanceof z.ZodError?e.issues[0]?.message:e instanceof SyntaxError?'Invalid request.':err.status?err.message:'Your request could not be saved. Please retry.'},{status:e instanceof z.ZodError||e instanceof SyntaxError?400:err.status||503,headers:{'Cache-Control':'no-store',...(err.retryAfter?{'Retry-After':String(err.retryAfter)}:{})}});}
}

