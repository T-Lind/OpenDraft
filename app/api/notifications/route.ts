import {enqueueReadingReminders,visibleWorkNotificationsSQL,scheduleWorkEmails} from '@/lib/work-updates';
import { database } from '@/db/storage';
import {member} from '@/lib/member';
import { unreadSQL } from '@/lib/workshop-query';
export const dynamic='force-dynamic';
export async function GET(){
 try {
  const db=database(),session=await member(db);const uid=session?.uid;
  if(!uid)return Response.json({error:'Sign in to check messages.'},{status:401});
  await enqueueReadingReminders(db,uid);scheduleWorkEmails(db);
  const updates=await db.prepare(`SELECT COUNT(*) FILTER(WHERE n.read_at IS NULL)::int AS unread, (SELECT n.id ${visibleWorkNotificationsSQL} ORDER BY n.created_at DESC,n.id DESC LIMIT 1) AS latest ${visibleWorkNotificationsSQL}`).bind(uid,uid).first();
  const results=await db.read([
   db.prepare(unreadSQL).bind(uid,uid),
   db.prepare(`SELECT id,sender,created_at FROM (
    (SELECT id,sender,created_at FROM messages m WHERE recipient_id=? AND created_at>=COALESCE((SELECT p.session_valid_after*1000 FROM profiles p WHERE p.id=m.recipient_id),0) ORDER BY created_at DESC,id DESC LIMIT 1)
    UNION ALL (SELECT b.id,b.circle_name AS sender,d.created_at FROM bulletin_deliveries d JOIN bulletins b ON b.id=d.bulletin_id WHERE d.recipient_id=? AND b.sender_id<>? ORDER BY d.created_at DESC,d.bulletin_id DESC LIMIT 1)
   ) latest ORDER BY created_at DESC,id DESC LIMIT 1`).bind(uid,uid,uid),
   db.prepare("SELECT COUNT(*)::int AS n FROM friendships WHERE (low_id=? OR high_id=?) AND requester_id<>? AND status='pending'").bind(uid,uid,uid),
   ...(session.isAdmin?[db.prepare("SELECT (SELECT COUNT(*)::int FROM message_reports WHERE status='open') AS cases,(SELECT COUNT(*)::int FROM legal_requests WHERE status='open') AS legal")]:[]),
  ]);
  return Response.json({updatesUnread:Number(updates?.unread||0),latestWorkUpdate:updates?.latest||null,unread:Number(results[0].results[0]?.unread||0),friendRequests:Number(results[2].results[0]?.n||0),...(session.isAdmin?{adminRequests:{cases:Number(results[3].results[0]?.cases||0),legal:Number(results[3].results[0]?.legal||0)}}:{}),latest:results[1].results[0]||null},{headers:{'Cache-Control':'no-store'}});
 } catch(e){const error=e as Error&{status?:number};return Response.json({error:error.status?error.message:'Message status is temporarily unavailable.'},{status:error.status||503,headers:{'Cache-Control':'no-store'}});}
}
