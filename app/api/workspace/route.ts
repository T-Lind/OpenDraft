import {database} from '@/db/storage';
import {member,fail,requireTerms} from '@/lib/member';
import {rateLimit} from '@/lib/rate-limit';
import {camel} from '@/lib/workshop-query';
import {critiqueDraftInput} from '@/lib/critique-quality';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const id=z.string().min(1).max(100);
const unblocked="NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=? AND b.blocked_id=w.author_id) OR (b.user_id=w.author_id AND b.blocked_id=?))";
const readable="(w.author_id=? OR (w.status NOT IN ('draft','withdrawn') AND (w.critique_visibility='public' OR r.user_id=?)))";
function error(e:unknown){if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:'Check the information and try again.'},400);const err=e as Error&{status?:number;retryAfter?:number;code?:string};if(err.code==='23505')return json({error:'That larger-work title is already in use on your account. Choose another title.'},409);return Response.json({error:err.status?err.message:'The workshop could not save this change. Please retry.'},{status:err.status||503,headers:{'Cache-Control':'no-store',...(err.retryAfter?{'Retry-After':String(err.retryAfter)}:{})}});}
export async function GET(request:Request){try{
 const db=database(),user=await member(db);if(!user)fail('Sign in to continue.',401);
 const {uid}=user,p=new URL(request.url).searchParams,section=p.get('section');
 await rateLimit(db,'workspace-read:'+uid,120,60000);
 if(section==='drafts'){
  const workId=p.get('workId');
  if(workId){const row=await db.prepare('SELECT * FROM critique_drafts WHERE user_id=? AND work_id=? AND version=?').bind(uid,id.parse(workId),z.coerce.number().int().positive().parse(p.get('version'))).first();return json({draft:row?{...camel(row),content:JSON.parse(String(row.draft))}:null});}
  const rows=(await db.prepare(`SELECT d.id,d.work_id,d.version,d.updated_at,w.title,w.status FROM critique_drafts d JOIN works w ON w.id=d.work_id WHERE d.user_id=? AND (d.draft::jsonb->>'overall'<>'' OR d.draft::jsonb->>'strengths'<>'' OR d.draft::jsonb->>'suggestions'<>'' OR jsonb_array_length(d.draft::jsonb->'annotations')>0) ORDER BY d.updated_at DESC,d.id DESC LIMIT 100`).bind(uid).all()).results;return json({items:rows.map(camel)});
 }
 if(section==='replies'){
  const reviewId=id.parse(p.get('id'));
  // A block between the reader and either participant hides the whole thread.
  const threadUnblocked=`${unblocked} AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=? AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=?))`;
  const review=await db.prepare(`SELECT r.user_id,w.author_id,w.critique_visibility,w.status FROM reviews r JOIN works w ON w.id=r.work_id WHERE r.id=? AND ${readable} AND ${threadUnblocked}`).bind(reviewId,uid,uid,uid,uid,uid,uid).first();if(!review)fail('This critique is unavailable.',404);
  const before=p.get('before')||'';
  const rows=(await db.prepare("SELECT c.id,c.body,c.user_id,c.created_at,p.name AS author,(c.user_id=?) AS mine FROM critique_replies c JOIN profiles p ON p.id=c.user_id WHERE c.review_id=? AND p.deleted_at=0"+(before?' AND (c.created_at,c.id)<(SELECT created_at,id FROM critique_replies WHERE id=? AND review_id=?)':'')+' ORDER BY c.created_at DESC,c.id DESC LIMIT 21').bind(uid,reviewId,...(before?[id.parse(before),reviewId]:[])).all()).results;
  return json({items:rows.slice(0,20).map(camel),next:rows.length>20?rows[19].id:null,canReply:review.status!=='withdrawn'&&(review.user_id===uid||review.author_id===uid)});
 }
 if(section==='largerWork'){
  const group=await db.prepare("SELECT l.*,p.name AS author,EXISTS(SELECT 1 FROM larger_work_followers f WHERE f.larger_work_id=l.id AND f.user_id=?) AS following FROM larger_works l JOIN profiles p ON p.id=l.author_id WHERE l.id=? AND p.deleted_at=0 AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=? AND b.blocked_id=l.author_id) OR (b.user_id=l.author_id AND b.blocked_id=?)) AND (l.author_id=? OR EXISTS(SELECT 1 FROM works w WHERE w.larger_work_id=l.id AND w.status NOT IN ('draft','withdrawn')))").bind(uid,id.parse(p.get('id')),uid,uid,uid).first();if(!group)fail('This larger work is unavailable.',404);
  const rows=(await db.prepare("SELECT w.id,w.title,w.part_number,w.version,w.revision_of,w.status,w.words,w.created_at,(SELECT COUNT(*)::int FROM reviews r WHERE r.work_id=w.id) AS reviews FROM works w WHERE w.larger_work_id=? AND w.status<>'withdrawn' AND (w.author_id=? OR w.status<>'draft') ORDER BY w.part_number,w.version DESC,w.created_at DESC,w.id LIMIT 1001").bind(group.id,uid).all()).results;
  return json({group:camel(group),parts:rows.slice(0,1000).map(camel),truncated:rows.length>1000,own:group.author_id===uid});
 }
 fail('Unknown workspace view.',404);
 }catch(e){return error(e);}}
export async function POST(request:Request){try{
 if(request.headers.get('Origin')!==new URL(request.url).origin)fail('This request must come from the workshop.',403);
 const raw=await request.text();if(raw.length>160000)fail('This request is too large.',413);
 const b=z.record(z.string(),z.unknown()).parse(JSON.parse(raw)),db=database(),user=await member(db);if(!user)fail('Sign in to continue.',401);
 const {uid}=user,now=Date.now();await rateLimit(db,'workspace-write:'+uid,60,60000);
 if(b.action==='saveCritiqueDraft'){
  requireTerms(user.profile);
  const workId=id.parse(b.workId),version=z.number().int().positive().parse(b.version),expected=z.number().int().nonnegative().parse(b.expectedUpdatedAt),draft=critiqueDraftInput.parse(b.draft);
  const work=await db.prepare("SELECT version FROM works WHERE id=? AND author_id<>? AND status NOT IN ('draft','withdrawn') AND NOT EXISTS(SELECT 1 FROM reviews WHERE work_id=works.id AND user_id=? AND version=works.version)").bind(workId,uid,uid).first();if(!work||Number(work.version)!==version)fail('This version no longer accepts an unfinished critique. Your browser copy is preserved.',409);
  const saved=await db.batch([db.prepare("INSERT INTO critique_drafts(id,user_id,work_id,version,draft,updated_at) SELECT ?,?,?,?,?,? FROM profiles WHERE id=? AND deleted_at=0 AND EXISTS(SELECT 1 FROM works w WHERE w.id=? AND w.version=? AND w.author_id<>? AND w.status NOT IN ('draft','withdrawn') AND NOT EXISTS(SELECT 1 FROM reviews r WHERE r.work_id=w.id AND r.user_id=? AND r.version=w.version)) AND (?::bigint=0 OR EXISTS(SELECT 1 FROM critique_drafts d WHERE d.user_id=? AND d.work_id=? AND d.version=? AND d.updated_at=?)) ON CONFLICT(user_id,work_id,version) DO UPDATE SET draft=excluded.draft,updated_at=GREATEST(excluded.updated_at,critique_drafts.updated_at+1) WHERE critique_drafts.updated_at=? RETURNING updated_at").bind(crypto.randomUUID(),uid,workId,version,JSON.stringify(draft),now,uid,workId,version,uid,uid,expected,uid,workId,version,expected,expected)], false);const row=saved[0].results[0];if(!row)fail('This critique changed on another device. Compare the saved copy before replacing it.',409);return json({updatedAt:Number(row.updated_at)});
 }
 if(b.action==='discardCritiqueDraft'){
  const result=await db.prepare('DELETE FROM critique_drafts WHERE user_id=? AND work_id=? AND version=? AND updated_at=?').bind(uid,id.parse(b.workId),z.number().int().positive().parse(b.version),z.number().int().nonnegative().parse(b.expectedUpdatedAt)).run();if(!result.meta.changes)fail('This draft changed on another device. Refresh before discarding it.',409);return json({ok:true});
 }
 requireTerms(user.profile);
 if(b.action==='reply'){
  const reviewId=id.parse(b.reviewId),body=z.string().trim().min(1).max(4000).parse(b.body),replyId=crypto.randomUUID();await rateLimit(db,'critique-reply:'+uid,20,3600000);
  const result=await db.batch([
   db.prepare(`INSERT INTO critique_replies(id,review_id,user_id,body,created_at) SELECT ?,r.id,?,?,? FROM reviews r JOIN works w ON w.id=r.work_id WHERE r.id=? AND w.status NOT IN ('draft','withdrawn') AND (w.author_id=? OR r.user_id=?) AND ${unblocked} AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=? AND b.blocked_id=r.user_id) OR (b.user_id=r.user_id AND b.blocked_id=?))`).bind(replyId,uid,body,now,reviewId,uid,uid,uid,uid,uid,uid),
   db.prepare("INSERT INTO work_notifications(user_id,work_id,target_work_id,event_key,kind,feed,created_at,review_id) SELECT CASE WHEN w.author_id=? THEN r.user_id ELSE w.author_id END,w.id,w.id,?,'reply',true,?,r.id FROM reviews r JOIN works w ON w.id=r.work_id WHERE r.id=? AND EXISTS(SELECT 1 FROM critique_replies WHERE id=?) ON CONFLICT(user_id,event_key) DO NOTHING").bind(uid,'reply:'+replyId,now,reviewId,replyId)
  ], false);if(!result[0].meta.changes)fail('Only the writer and reviewer can reply to this available critique.',403);return json({ok:true});
 }
 if(b.action==='removeReply'){const result=await db.prepare('DELETE FROM critique_replies WHERE id=? AND user_id=?').bind(id.parse(b.id),uid).run();if(!result.meta.changes)fail('Only your own reply can be removed.',403);return json({ok:true});}
 if(b.action==='updateLargerWork'){
  const groupId=id.parse(b.id),title=z.string().trim().min(1).max(120).parse(b.title),synopsis=z.string().trim().max(3000).parse(b.synopsis),expected=z.number().int().nonnegative().parse(b.expectedUpdatedAt);
  const result=await db.batch([db.prepare('UPDATE larger_works SET title=?,synopsis=?,updated_at=GREATEST(?,updated_at+1) WHERE id=? AND author_id=? AND updated_at=? RETURNING id').bind(title,synopsis,now,groupId,uid,expected),db.prepare(`UPDATE works SET larger_work=?,created_at=CASE WHEN status='draft' THEN GREATEST(?,created_at+1) ELSE created_at END WHERE larger_work_id=? AND author_id=? AND EXISTS(SELECT 1 FROM larger_works WHERE id=? AND title=? AND synopsis=?)`).bind(title,now,groupId,uid,groupId,title,synopsis)]);if(!result[0].meta.changes)fail('This larger work changed. Reload its details before saving.',409);return json({ok:true});
 }
 if(b.action==='followLargerWork'){
  const groupId=id.parse(b.id),follow=z.boolean().parse(b.follow);
  if(follow){const result=await db.prepare("INSERT INTO larger_work_followers(id,larger_work_id,user_id) SELECT ?,l.id,? FROM larger_works l WHERE l.id=? AND (l.author_id=? OR EXISTS(SELECT 1 FROM works w WHERE w.larger_work_id=l.id AND w.status NOT IN ('draft','withdrawn'))) ON CONFLICT(larger_work_id,user_id) DO NOTHING").bind(crypto.randomUUID(),uid,groupId,uid).run();if(!result.meta.changes&&!await db.prepare('SELECT id FROM larger_work_followers WHERE larger_work_id=? AND user_id=?').bind(groupId,uid).first())fail('This larger work is unavailable.',404);}
  else await db.prepare('DELETE FROM larger_work_followers WHERE larger_work_id=? AND user_id=?').bind(groupId,uid).run();return json({ok:true});
 }
 fail('Unknown workspace action.');
 }catch(e){return error(e);}}
