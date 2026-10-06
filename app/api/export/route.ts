import { database } from '@/db/storage';
import {member} from '@/lib/member';
import { camel } from '@/lib/workshop-query';
import { rateLimit } from '@/lib/rate-limit';
export const dynamic='force-dynamic';
export const maxDuration=60;
export async function GET(){
 try{
  const db=database(),session=await member(db);const uid=session?.uid;
  if(!uid)return Response.json({error:'Sign in to export your work.'},{status:401});
  await rateLimit(db,'export:'+uid,3,3_600_000);
  const profile=await db.prepare('SELECT * FROM profiles WHERE id=?').bind(uid).first();
  const sections=[
   ['queueHistory','SELECT e.* FROM work_flow_events e JOIN works w ON w.id=e.work_id WHERE w.author_id=?',[uid]],
   ['critiquePilot','SELECT * FROM critique_evidence WHERE user_id=?',[uid]],
   ['critiqueCreditChecks','SELECT * FROM critique_credit_checks WHERE user_id=?',[uid]],
   ['readingPreferences','SELECT user_id AS id,preferences,updated_at FROM reading_preferences WHERE user_id=?',[uid]],
   ['writing','SELECT * FROM works WHERE author_id=?', [uid]],
   ['critiquesGiven','SELECT * FROM reviews WHERE user_id=?',[uid]],
   ['critiquesReceived','SELECT r.* FROM reviews r JOIN works w ON w.id=r.work_id WHERE w.author_id=?',[uid]],
   ['annotations','SELECT a.* FROM annotations a JOIN works w ON w.id=a.work_id WHERE a.user_id=? OR w.author_id=?',[uid,uid]],
   ['bookmarks','SELECT b.* FROM bookmarks b WHERE b.user_id=?',[uid]],
   ['circles','SELECT c.* FROM circles c JOIN memberships m ON m.circle_id=c.id WHERE m.user_id=?',[uid]],
   ['circleRequests','SELECT * FROM circle_requests WHERE user_id=?',[uid]],
   ['posts','SELECT * FROM posts WHERE user_id=?',[uid]],
   ['ratings','SELECT * FROM critique_ratings WHERE rater_id=?',[uid]],
   ['friends',"SELECT * FROM friendships WHERE low_id=? OR high_id=?",[uid,uid]],
   ['blocks','SELECT * FROM member_blocks WHERE user_id=?',[uid]],
   ['messages','SELECT * FROM messages WHERE (sender_id=? OR recipient_id=?) AND created_at>=(SELECT session_valid_after*1000 FROM profiles WHERE id=?)',[uid,uid,uid]],
   ['credits','SELECT * FROM credit_events WHERE user_id=?',[uid]],
  ] as const;
  const encoder=new TextEncoder();let cancelled=false;
  const stream=new ReadableStream<Uint8Array>({async start(controller){
   const send=(text:string)=>{if(!cancelled)controller.enqueue(encoder.encode(text));};
   try{send(JSON.stringify({exportedAt:new Date().toISOString(),profile:profile?camel(profile):null}).slice(0,-1));
    for(const [name,sql,values] of sections){if(cancelled)return;send(',"'+name+'":[');let cursor='',first=true;
     while(!cancelled){
      const rows=(await db.prepare(`SELECT * FROM (${sql}) exported WHERE id>? ORDER BY id LIMIT 50`).bind(...values,cursor).all()).results;
      // The subquery gives joined tables an unambiguous id and keeps every batch bounded.
      for(const row of rows){send((first?'':',')+JSON.stringify(camel(row)));first=false;}if(rows.length<50)break;cursor=String(rows.at(-1)!.id);
     }send(']');
    }send('}');if(!cancelled)controller.close();
   }catch(error){if(!cancelled)controller.error(error);}
  },cancel(){cancelled=true;}});
  return new Response(stream,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="opendraft-writing-and-feedback.json"','Cache-Control':'no-store'}});
 }catch(e){const error=e as Error&{status?:number;retryAfter?:number};return Response.json({error:error.status?error.message:'Your export could not start.'},{status:error.status||503,headers:{'Cache-Control':'no-store',...(error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});}
}
