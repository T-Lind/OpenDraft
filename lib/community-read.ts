import type {Database} from '@/db/storage';
import {camel} from './workshop-query';
import {readCursor,limitFor,pageOf} from './pagination';
import {fail} from './member';
import {readAccountPreferences} from './account-preferences';
export const showcaseEligibility="w.status NOT IN ('draft','withdrawn') AND w.showcase_opt_in=true AND p.deleted_at=0 AND p.onboarding_completed=true AND NOT EXISTS(SELECT 1 FROM reports r WHERE r.work_id=w.id AND r.status='open')";
export async function communityRead(db:Database,uid:string,admin:boolean,params:URLSearchParams){
 const section=params.get('section'),cursor=readCursor(params.get('cursor')),limit=limitFor(params);
 const id=(params.get('id')||'').slice(0,100);
 if(section==='readingPreferences')return readAccountPreferences(db,uid);
 if(section==='relationship'){
  const p=await db.prepare('SELECT id FROM profiles WHERE id=? AND deleted_at=0 AND onboarding_completed=true').bind(id).first();
  const rows=await db.read([db.prepare('SELECT * FROM friendships WHERE low_id=LEAST(?,?) AND high_id=GREATEST(?,?)').bind(uid,id,uid,id),db.prepare('SELECT user_id FROM member_blocks WHERE (user_id=? AND blocked_id=?) OR (user_id=? AND blocked_id=?)').bind(uid,id,id,uid)]);
  const f=rows[0].results[0];return {available:!!p&&uid!==id&&!id.startsWith('sample-'),status:f?.status||'none',incoming:f?.requester_id!==uid,blocked:rows[1].results.some(r=>r.user_id===uid),unavailable:rows[1].results.some(r=>r.user_id!==uid)};
 }
 if(section==='status'){const result=await db.prepare("SELECT friends_only,(SELECT COUNT(*)::int FROM friendships f WHERE (f.low_id=p.id OR f.high_id=p.id) AND f.requester_id<>p.id AND f.status='pending') AS requests FROM profiles p WHERE p.id=?").bind(uid).first();return camel(result||{});}
 if(section==='friends'){
  const mode=params.get('mode')||'accepted',after=cursor?' AND (created_at,id)<(?,?)':'';
  let sql='',values:unknown[]=[];
  if(mode==='blocked'){sql="SELECT b.id,b.blocked_id AS user_id,p.name,'blocked'::text AS status,b.created_at FROM member_blocks b JOIN profiles p ON p.id=b.blocked_id WHERE b.user_id=?";values=[uid];}
  else{if(!['accepted','incoming','outgoing'].includes(mode))fail('Unknown friend list.');sql="SELECT f.id,CASE WHEN f.low_id=? THEN f.high_id ELSE f.low_id END AS user_id,p.name,f.status,f.updated_at AS created_at FROM friendships f JOIN profiles p ON p.id=CASE WHEN f.low_id=? THEN f.high_id ELSE f.low_id END WHERE (f.low_id=? OR f.high_id=?) AND p.deleted_at=0 AND "+(mode==='accepted'?"f.status='accepted'":mode==='incoming'?"f.status='pending' AND f.requester_id<>?":"f.status IN ('pending','rejected') AND f.requester_id=?");values=[uid,uid,uid,uid,...(mode==='accepted'?[]:[uid])];}
  const rows=(await db.prepare('SELECT * FROM ('+sql+') listed WHERE true'+after+' ORDER BY created_at DESC,id DESC LIMIT ?').bind(...values,...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
  const page=pageOf(rows,limit);return {...page,items:page.items.map(camel)};
 }
 if(section==='rating'){const review=await db.prepare('SELECT r.id FROM reviews r JOIN works w ON w.id=r.work_id WHERE r.id=? AND w.author_id=? AND r.user_id<>?').bind(id,uid,uid).first();if(!review)fail('Only the writer receiving this critique may rate it.',403);return{rating:await db.prepare('SELECT usefulness,specificity,actionability,created_at FROM critique_ratings WHERE review_id=? AND rater_id=?').bind(id,uid).first()};}
 if(section==='revisions'){
  const current=await accessibleWork(db,uid,id);
  const rows=(await db.prepare("WITH RECURSIVE ancestors AS (SELECT id,revision_of,0 AS depth,ARRAY[id] AS path FROM works WHERE id=? UNION ALL SELECT p.id,p.revision_of,a.depth+1,a.path||p.id FROM works p JOIN ancestors a ON p.id=a.revision_of WHERE NOT p.id=ANY(a.path)), family AS (SELECT w.id,w.revision_of,0 AS depth,ARRAY[w.id] AS path FROM works w WHERE w.id=(SELECT id FROM ancestors ORDER BY depth DESC LIMIT 1) UNION ALL SELECT w.id,w.revision_of,f.depth+1,f.path||w.id FROM works w JOIN family f ON w.revision_of=f.id WHERE NOT w.id=ANY(f.path)) SELECT w.id,w.title,w.version,w.created_at,w.status,w.revision_of,(SELECT COUNT(*)::int FROM reviews r WHERE r.work_id=w.id) AS reviews FROM works w JOIN family f ON f.id=w.id WHERE w.author_id=? AND (w.author_id=? OR w.status NOT IN ('draft','withdrawn')) "+(cursor?'AND (w.created_at,w.id)<(?,?)':'')+" ORDER BY w.created_at DESC,w.id DESC LIMIT ?").bind(id,current.author_id,uid,...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
  const page=pageOf(rows,limit);return{...page,items:page.items.map(camel)};
 }
 if(section==='compare'){
  const left=params.get('left')?.slice(0,100)||'',right=params.get('right')?.slice(0,100)||'';
  const [a,b]=await Promise.all([accessibleWork(db,uid,left),accessibleWork(db,uid,right)]);
  if(a.author_id!==b.author_id)fail('Choose versions of the same work.');
  const related=await db.prepare('WITH RECURSIVE ancestry AS (SELECT id,revision_of,id AS origin,0 AS depth,ARRAY[id] AS path FROM works WHERE id IN (?,?) UNION ALL SELECT p.id,p.revision_of,a.origin,a.depth+1,a.path||p.id FROM works p JOIN ancestry a ON p.id=a.revision_of WHERE NOT p.id=ANY(a.path)) SELECT id FROM ancestry GROUP BY id HAVING COUNT(DISTINCT origin)=2 LIMIT 1').bind(left,right).first();
  if(left===right||!related)fail('Choose two different revisions in the same work family.');
  return{left:camel(a),right:camel(b)};
 }
 if(section==='cases'||section==='legal'){
  if(!admin)fail('Administrator access is required.',403);
  const status=params.get('status')||'open';if(!['open','resolved','all'].includes(status))fail('Unknown case status.');
  const filters=[status==='all'?'true':'status=?'];const values:unknown[]=status==='all'?[]:[status];if(cursor){filters.push('(created_at,id)<(?,?)');values.push(cursor.value,cursor.id);}
  const rows=(await db.prepare('SELECT * FROM '+(section==='legal'?'legal_requests':'message_reports')+' WHERE '+filters.join(' AND ')+' ORDER BY created_at DESC,id DESC LIMIT ?').bind(...values,limit+1).all()).results;
  const page=pageOf(rows,limit);return{...page,items:page.items.map(camel)};
 }
 if(section==='candidates'){
  if(!admin)fail('Administrator access is required.',403);
  const day=params.get('day')||new Date().toISOString().slice(0,10);
  const rows=(await db.prepare('SELECT w.id,w.title,w.author,w.author_id,w.genre,w.warning,w.mature,w.words,w.created_at,w.ai_showcase_consent,w.ai_assessment FROM works w JOIN profiles p ON p.id=w.author_id WHERE '+showcaseEligibility+" AND NOT EXISTS(SELECT 1 FROM showcases s JOIN works previous ON previous.id=s.work_id WHERE previous.author_id=w.author_id AND s.day<>? AND s.day::date BETWEEN (?::date-29) AND (?::date+29)) "+(cursor?'AND (w.created_at,w.id)<(?,?)':'')+' ORDER BY w.created_at DESC,w.id DESC LIMIT ?').bind(day,day,day,...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
  const page=pageOf(rows,limit);return{...page,items:page.items.map(camel)};
 }
 if(section==='scheduled'){
  if(!admin)fail('Administrator access is required.',403);
  const rows=(await db.prepare('SELECT s.day AS id,s.day,s.note,w.id AS work_id,w.title,w.author,w.genre,s.created_at FROM showcases s JOIN works w ON w.id=s.work_id WHERE true'+(cursor?' AND (s.created_at,s.day)<(?,?)':'')+' ORDER BY s.created_at DESC,s.day DESC LIMIT ?').bind(...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
  const page=pageOf(rows,limit);return{...page,items:page.items.map(camel)};
 }
 if(section==='orphanedCircles'){
  if(!admin)fail('Administrator access is required.',403);
  const rows=(await db.prepare("SELECT id,name,description,name AS cursor_value FROM circles WHERE owner_id='system' "+(cursor?'AND (name,id)>(?,?)':'')+' ORDER BY name,id LIMIT ?').bind(...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
  const page=pageOf(rows,limit,row=>String(row.name));return{...page,items:page.items.map(camel)};
 }
 fail('Unknown community section.');
}
export async function accessibleWork(db:Database,uid:string,id:string){
 const w=await db.prepare("SELECT id,title,author_id,revision_of,version,content,status,created_at FROM works WHERE id=? AND (author_id=? OR status NOT IN ('draft','withdrawn'))").bind(id,uid).first();if(!w)fail('This writing is unavailable.',404);return w;
}
