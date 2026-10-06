import {queueForecasts} from './queue-forecast';
import type { Database } from '@/db/storage';
import { cursorFor, limitFor, pageOf, readCursor } from './pagination';
import { reservationStatus } from './critique-reservations';
import { circleProjection } from './circle-access';
import { TERMS_VERSION } from './workshop-policy';

export type Row = Record<string, unknown>;
export const camel = (row: Row): Row => Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/_([a-z])/g,(_,letter)=>letter.toUpperCase()),value]));
export const workColumns = `w.id,w.author_id,w.author,w.title,w.genre,w.kind,w.stage,w.request,w.status,w.version,w.created_at,w.words,w.warning,w.mature,w.themes,w.target_reviews,w.critique_visibility,w.revision_of,w.showcase_opt_in,w.ai_showcase_consent,w.ai_process,(w.author_id LIKE 'sample-%' OR EXISTS(SELECT 1 FROM profiles jp WHERE jp.id=w.author_id AND jp.deleted_at=0 AND jp.terms_version='${TERMS_VERSION}')) AS jev_review_available`;
export const publicWork = "w.status NOT IN ('draft','withdrawn')";
export const workExtras = `(SELECT COUNT(*) FROM reviews r WHERE r.work_id=w.id AND r.version=w.version)::int AS reviews,
 EXISTS(SELECT 1 FROM bookmarks b WHERE b.work_id=w.id AND b.user_id=?) AS bookmarked,
 EXISTS(SELECT 1 FROM reviews r WHERE r.work_id=w.id AND r.version=w.version AND r.user_id=?) AS has_reviewed,
 CASE WHEN w.status='queued' THEN (SELECT COUNT(*)+1 FROM works q WHERE q.genre=w.genre AND q.status='queued' AND (q.created_at,q.id)<(w.created_at,w.id)) ELSE NULL END AS queue_position`;

// A bulletin stores its body once; the delivery rows track each member's inbox.
export const messageUnion = `SELECT m.id,m.sender_id,m.sender,m.recipient_id,m.recipient,m.body,m.read_at,m.created_at,'direct' AS kind,NULL::text AS circle_id,NULL::text AS circle_name,
 CASE WHEN m.sender_id=? THEN m.recipient_id ELSE m.sender_id END AS conversation_id,
 CASE WHEN m.sender_id=? THEN m.recipient ELSE m.sender END AS name FROM messages m WHERE m.sender_id=? OR m.recipient_id=?
 UNION ALL SELECT b.id,b.sender_id,b.sender,d.recipient_id,''::text,b.body,d.read_at,b.created_at,'bulletin',b.circle_id,b.circle_name,'circle:'||b.circle_id,b.circle_name
 FROM bulletins b JOIN bulletin_deliveries d ON d.bulletin_id=b.id WHERE d.recipient_id=?`;
export const unreadSQL = `SELECT (SELECT COUNT(*) FROM messages m WHERE recipient_id=? AND read_at IS NULL AND created_at>=COALESCE((SELECT p.session_valid_after*1000 FROM profiles p WHERE p.id=m.recipient_id),0))+(SELECT COUNT(*) FROM bulletin_deliveries WHERE recipient_id=? AND read_at IS NULL) AS unread`;

export async function queryCollection(db: Database, uid: string, params: URLSearchParams) {
 const collection=params.get('collection');
 const cursor=readCursor(params.get('cursor'));
 const limit=limitFor(params);
 const id=(params.get('id')||'').slice(0,100);
 const after=cursor?' AND (created_at,id)<(?,?)':'';
 const afterValues=cursor?[cursor.value,cursor.id]:[];
 let rows:Row[];
 if(collection==='critiqueReservation') return reservationStatus(db,uid,id);
 if(collection==='work') {
  const work=await db.prepare(`SELECT ${workColumns},w.content,${workExtras} FROM works w WHERE w.id=? AND (${publicWork} OR w.author_id=?)`).bind(uid,uid,id,uid).first();
  if(!work) throw Object.assign(new Error('This work is unavailable.'),{status:404});
  return {work:(await queueForecasts(db,[camel(work)]))[0]};
 }
 if(collection==='works') {
  const mode=params.get('mode')||'explore';
  const author=params.get('author');
  const where=[mode==='mine'?"w.author_id=? AND w.status<>'withdrawn'":publicWork];
  const values:unknown[]=mode==='mine'?[uid]:[];
  if(author) {where.push('w.author_id=?');values.push(author.slice(0,100));}
  if(mode==='saved'){where.push('EXISTS(SELECT 1 FROM bookmarks b WHERE b.work_id=w.id AND b.user_id=?)');values.push(uid);}
  if(mode==='spotlight')where.push("w.status='spotlight'");
  const genre=params.get('genre');if(genre&&genre!=='All genres'){where.push('w.genre=?');values.push(genre.slice(0,80));}
  const search=(params.get('q')||'').trim().slice(0,80);
  if(search){const terms=searchTerms(search);where.push(`${workSearchVector} @@ to_tsquery('simple',?)`);values.push(terms);}
  const sort=params.get('sort')||'Newest first';
  const recommended=sort==='Recommended';
  const ascending=sort==='Shortest first'||sort==='Needs feedback';
  const key=sort==='Shortest first'||sort==='Longest first'?'words':sort==='Needs feedback'?'reviews':'created_at';
  const direction=ascending?'ASC':'DESC'; const op=ascending?'>':'<';
  const tier="CASE status WHEN 'spotlight' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END";
  let boundary='';
  if(cursor){boundary=recommended?` WHERE (${tier}>? OR (${tier}=? AND (created_at,id)<(?,?)))`:` WHERE (${key},id)${op}(?,?)`; if(recommended)values.push(cursor.rank??0,cursor.rank??0,cursor.value,cursor.id);else values.push(cursor.value,cursor.id);}
  rows=(await db.prepare(`WITH listing AS (SELECT ${workColumns},''::text AS content,${workExtras} FROM works w WHERE ${where.join(' AND ')}) SELECT * FROM listing${boundary} ORDER BY ${recommended?tier+' ASC,':''}${key} ${direction},id ${direction} LIMIT ?`).bind(uid,uid,...values,limit+1).all()).results;
  const items=rows.slice(0,limit);const last=items.at(-1);
  return {items:await queueForecasts(db,items.map(camel)),nextCursor:rows.length>limit&&last?cursorFor(Number(last[key]),String(last.id),recommended?last.status==='spotlight'?0:last.status==='queued'?1:2:undefined):null};
 }
 if(collection==='reviews') {
  const mode=params.get('mode')||'given';
  const scope=id?'r.work_id=?':mode==='received'?'w.author_id=?':'r.user_id=?';
  const boundary=cursor?' AND (r.created_at,r.id)<(?,?)':'';
  rows=(await db.prepare(`SELECT r.*,w.title AS work_title FROM reviews r JOIN works w ON w.id=r.work_id WHERE ${scope} AND (w.author_id=? OR ((${publicWork} OR (w.author_id='' AND r.user_id=?)) AND (r.user_id=? OR w.critique_visibility='public')))${boundary} ORDER BY r.created_at DESC,r.id DESC LIMIT ?`).bind(id||uid,uid,uid,uid,...afterValues,limit+1).all()).results;
 } else if(collection==='annotations') {
  rows=(await db.prepare(`SELECT a.* FROM annotations a JOIN works w ON w.id=a.work_id WHERE a.work_id=? AND (w.author_id=? OR (${publicWork} AND (a.user_id=? OR w.critique_visibility='public')))${cursor?' AND (a.created_at,a.id)<(?,?)':''} ORDER BY a.created_at DESC,a.id DESC LIMIT ?`).bind(id,uid,uid,...afterValues,limit+1).all()).results;
 } else if(collection==='circles') {
  const author=params.get('author');
  const where=author?' WHERE EXISTS(SELECT 1 FROM memberships m WHERE m.circle_id=c.id AND m.user_id=?)':' WHERE true';
  rows=(await db.prepare(`WITH viewer AS (SELECT ?::text AS uid) SELECT ${circleProjection} FROM circles c${where}${cursor?' AND (c.name,c.id)>(?,?)':''} ORDER BY c.name,c.id LIMIT ?`).bind(uid,...(author?[author.slice(0,100)]:[]),...afterValues,limit+1).all()).results;
  const page=pageOf(rows,limit,row=>String(row.name));return {...page,items:page.items.map(camel)};
 } else if(collection==='circle') {
  const circle=await db.prepare(`WITH viewer AS (SELECT ?::text AS uid) SELECT ${circleProjection} FROM circles c WHERE c.id=?`).bind(uid,id).first();
  if(!circle)throw Object.assign(new Error('This circle is unavailable.'),{status:404});return {circle:camel(circle)};
 } else if(collection==='posts') {
  rows=(await db.prepare(`SELECT * FROM posts WHERE circle_id=? AND EXISTS(SELECT 1 FROM circles c WHERE c.id=posts.circle_id AND (c.access='open' OR EXISTS(SELECT 1 FROM memberships m WHERE m.circle_id=c.id AND m.user_id=?)))${after} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(id,uid,...afterValues,limit+1).all()).results;
 } else if(collection==='circleMembers'||collection==='circleRequests') {
  if(!await db.prepare('SELECT id FROM circles WHERE id=? AND owner_id=?').bind(id,uid).first())throw Object.assign(new Error('Only the circle owner can manage membership.'),{status:403});
  const table=collection==='circleMembers'?'memberships':'circle_requests';
  rows=(await db.prepare(`SELECT m.id,m.user_id,p.name,${table==='memberships'?'0::bigint':'m.created_at'} AS created_at FROM ${table} m JOIN profiles p ON p.id=m.user_id WHERE m.circle_id=? AND p.deleted_at=0${cursor?' AND m.id>?':''} ORDER BY m.id LIMIT ?`).bind(id,...(cursor?[cursor.id]:[]),limit+1).all()).results;
  const page=pageOf(rows,limit);return {...page,items:page.items.map(camel)};
 } else if(collection==='circleReadings') {
  if(!await db.prepare('SELECT id FROM memberships WHERE user_id=? AND circle_id=?').bind(uid,id).first())throw Object.assign(new Error('Join this circle to see its workshop reading list.'),{status:403});
  rows=(await db.prepare(`SELECT cr.id,cr.work_id,cr.added_by,cr.created_at,w.title,w.author,w.genre,w.words FROM circle_readings cr JOIN works w ON w.id=cr.work_id WHERE cr.circle_id=? AND ${publicWork}${cursor?' AND (cr.created_at,cr.id)<(?,?)':''} ORDER BY cr.created_at DESC,cr.id DESC LIMIT ?`).bind(id,...afterValues,limit+1).all()).results;
 } else if(collection==='events') {
  rows=(await db.prepare(`SELECT * FROM credit_events WHERE user_id=?${after} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(uid,...afterValues,limit+1).all()).results;
 } else if(collection==='conversations') {
  rows=(await db.prepare(`WITH all_messages AS (${messageUnion}), summary AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY conversation_id ORDER BY created_at DESC,id DESC) AS position, SUM(CASE WHEN recipient_id=? AND read_at IS NULL THEN 1 ELSE 0 END) OVER(PARTITION BY conversation_id)::int AS unread FROM all_messages WHERE created_at>=(SELECT session_valid_after*1000 FROM profiles WHERE id=?)) SELECT * FROM summary WHERE position=1${params.get('unread')==='1'?' AND unread>0':''}${after} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(uid,uid,uid,uid,uid,uid,uid,...afterValues,limit+1).all()).results;
 } else if(collection==='messages') {
  rows=(await db.prepare(`WITH all_messages AS (${messageUnion}) SELECT * FROM all_messages WHERE conversation_id=? AND created_at>=(SELECT session_valid_after*1000 FROM profiles WHERE id=?)${after} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(uid,uid,uid,uid,uid,id,uid,...afterValues,limit+1).all()).results;
 } else if(collection==='analytics') {
  // Cursor ordering stays stable while read counts change.
  rows=(await db.prepare(`SELECT w.id,w.id AS work_id,w.title,w.words,w.created_at,COALESCE(SUM(v.views),0)::int AS views,COUNT(v.user_id)::int AS readers FROM works w LEFT JOIN work_views v ON v.work_id=w.id WHERE w.author_id=? AND w.status<>'withdrawn'${cursor?' AND (w.created_at,w.id)<(?,?)':''} GROUP BY w.id ORDER BY w.created_at DESC,w.id DESC LIMIT ?`).bind(uid,...afterValues,limit+1).all()).results;
 } else throw Object.assign(new Error('Unknown collection.'),{status:400});
 const page=pageOf(rows,limit);return {...page,items:page.items.map(camel)};
}

export function escapeLike(value:string){return value.replace(/[\\%_]/g,ch=>'\\'+ch);}
export function searchTerms(value:string) {const words=value.toLowerCase().match(/[\p{L}\p{N}]+/gu)?.slice(0,8)||[];return words.map(word=>"'"+word.slice(0,60)+"':*").join(' & ')||"'__empty__'";}
export const workSearchVector="to_tsvector('simple',coalesce(w.title,'')||' '||coalesce(w.author,'')||' '||coalesce(w.genre,'')||' '||coalesce(w.request,'')||' '||coalesce(w.content,''))";
export const profileSearchVector="to_tsvector('simple',coalesce(p.name,'')||' '||coalesce(p.bio,'')||' '||coalesce(p.interests,''))";
export const circleSearchVector="to_tsvector('simple',coalesce(c.name,'')||' '||coalesce(c.description,'')||' '||coalesce(c.genre,''))";
