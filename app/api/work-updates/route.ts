import {database} from '@/db/storage';
import {member,fail} from '@/lib/member';
import {rateLimit} from '@/lib/rate-limit';
import {camel} from '@/lib/workshop-query';
import {readCursor,cursorFor,limitFor} from '@/lib/pagination';
import {workPreferenceInput,workPreferenceStatus,changeWorkPreference,enqueueReadingReminders,visibleWorkNotificationsSQL,scheduleWorkEmails} from '@/lib/work-updates';
import {z} from 'zod';
export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const error=(e:unknown)=>{if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Provide valid reading options.'},400);const err=e as Error&{status?:number};return json({error:err.status?err.message:'Work updates are temporarily unavailable.'},err.status||503);};
export async function GET(request:Request){try{
 const db=database(),user=await member(db);if(!user)fail('Sign in to manage reading and updates.',401);
 const params=new URL(request.url).searchParams,workId=params.get('workId');
 if(workId)return json(await workPreferenceStatus(db,user.uid,workId.slice(0,100)));
 await enqueueReadingReminders(db,user.uid);scheduleWorkEmails(db);
 const cursor=readCursor(params.get('cursor')),limit=limitFor(params);
 const rows=(await db.prepare(`SELECT n.id,n.work_id,n.target_work_id,n.kind,n.read_at,n.created_at,w.title,target.title AS target_title ${visibleWorkNotificationsSQL}${cursor?' AND (n.created_at,n.id)<(?,?)':''} ORDER BY n.created_at DESC,n.id DESC LIMIT ?`).bind(user.uid,...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
 const items=rows.slice(0,limit),last=items.at(-1);
 const unread=(await db.prepare(`SELECT COUNT(*)::int AS n ${visibleWorkNotificationsSQL} AND n.read_at IS NULL`).bind(user.uid).first())?.n||0;
 return json({items:items.map(camel),unread:Number(unread),nextCursor:rows.length>limit&&last?cursorFor(Number(last.created_at),String(last.id)):null});
 }catch(e){return error(e);}}
export async function POST(request:Request){try{
 if(request.headers.get('Origin')!==new URL(request.url).origin)fail('This request must come from the workshop.',403);
 const raw=await request.text();if(raw.length>4000)fail('This request is too large.',413);
 const db=database(),user=await member(db);if(!user)fail('Sign in to manage reading and updates.',401);
 await rateLimit(db,'work-options:'+user.uid,60,60000);
 const payload=JSON.parse(raw);if(!payload||typeof payload!=='object'||Array.isArray(payload))fail('Provide valid reading options.');
 const {action,...input}=payload;
 if(action==='preference')return json(await changeWorkPreference(db,user.uid,workPreferenceInput.parse(input)));
 if(action==='read'){
  const parsed=z.union([z.object({id:z.string().min(1).max(100)}).strict(),z.object({all:z.literal(true)}).strict()]).parse(input);
  const result=await db.prepare(`UPDATE work_notifications SET read_at=COALESCE(read_at,?) WHERE id IN (SELECT n.id ${visibleWorkNotificationsSQL}${'id' in parsed?' AND n.id=?':''})`).bind(Date.now(),user.uid,...('id' in parsed?[parsed.id]:[])).run();
  if('id' in parsed&&!result.meta.changes)fail('This update is unavailable.',404);return json({ok:true});
 }
 fail('Unknown work-update action.');
 }catch(e){return error(e);}}
