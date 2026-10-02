import {database,type Database} from '@/db/storage';
import {getChatGPTUser} from '@/app/chatgpt-auth';
import {sampleWorks,sampleCircles,genres,wordCount} from '@/app/data';
import {z} from 'zod';
export const dynamic='force-dynamic';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
const promoteSQL="UPDATE works SET status='spotlight' WHERE id IN (SELECT id FROM works WHERE status='queued' ORDER BY created_at ASC,id ASC LIMIT GREATEST(0,4-(SELECT COUNT(*) FROM works WHERE status='spotlight')))";
async function seed(db:Database){
 if(await db.prepare("SELECT id FROM settings WHERE id='examples-v1'").first()) return;
 const q=sampleWorks.map(w=>db.prepare("INSERT INTO works(id,author_id,author,title,genre,kind,stage,content,request,status,version,created_at,words,warning) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(w.id,w.authorId,w.author,w.title,w.genre,w.kind,w.stage,w.content,w.request,w.status,w.version,w.createdAt,w.words,w.warning));
 for(const c of sampleCircles)q.push(db.prepare('INSERT INTO circles(id,name,description,genre,owner_id) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(c.id,c.name,c.description,c.genre,'system'));
 q.push(db.prepare("INSERT INTO settings(id,value) VALUES('examples-v1','1') ON CONFLICT(id) DO NOTHING"));
 await db.batch(q);
}
async function identity(db:Database){const u=await getChatGPTUser();if(!u)return null;await db.prepare('INSERT INTO profiles(id,name,created_at) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(u.userId,u.fullName||u.email.split('@')[0],Date.now()).run();return u;}
async function snapshot(db:Database,uid:string){
 const r=await db.batch([
 db.prepare('SELECT * FROM profiles WHERE id=?').bind(uid),
 db.prepare("SELECT w.*, (SELECT COUNT(*) FROM reviews r WHERE r.work_id=w.id AND r.version=w.version) AS reviews FROM works w WHERE w.status NOT IN ('draft','withdrawn') OR w.author_id=? ORDER BY CASE w.status WHEN 'spotlight' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END,w.created_at DESC").bind(uid),
 db.prepare("SELECT r.* FROM reviews r JOIN works w ON w.id=r.work_id WHERE w.status NOT IN ('draft','withdrawn') OR w.author_id=? ORDER BY r.created_at DESC").bind(uid),
 db.prepare('SELECT work_id FROM bookmarks WHERE user_id=?').bind(uid),
 db.prepare('SELECT c.*, (SELECT COUNT(*) FROM memberships m WHERE m.circle_id=c.id) AS members, EXISTS(SELECT 1 FROM memberships m WHERE m.circle_id=c.id AND m.user_id=?) AS joined FROM circles c ORDER BY c.name').bind(uid),
 db.prepare('SELECT * FROM posts ORDER BY created_at DESC LIMIT 200'),
 db.prepare('SELECT * FROM credit_events WHERE user_id=? ORDER BY created_at DESC LIMIT 100').bind(uid)]);
 const camel=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([k,v])=>[k.replace(/_([a-z])/g,(_,c)=>c.toUpperCase()),v]));
 return {user:r[0].results[0]||null,works:r[1].results.map(camel),reviews:r[2].results.map(camel),bookmarks:r[3].results.map(x=>x.work_id),circles:r[4].results.map(camel),posts:r[5].results.map(camel),events:r[6].results.map(camel)};
}
export async function GET(){try{const db=database();await seed(db);const user=await identity(db);return json(await snapshot(db,user?.userId||''));}catch(e){console.error('Workshop read:',e);return json({error:'The workshop could not load. Please try again.'},503);}}
const workInput=z.object({id:z.string().min(1).max(100),title:z.string().trim().min(1).max(120),genre:z.enum(genres.slice(1) as [string,...string[]]),kind:z.enum(['Short story','Novel excerpt','Poem','Personal essay','Flash fiction']),stage:z.enum(['First draft','Second draft','Revision','Ready for a final look']),content:z.string().trim().min(1).max(50000),request:z.string().trim().min(5).max(800),warning:z.string().trim().max(300).default('')});
const reviewInput=z.object({workId:z.string().max(100),strengths:z.string().trim().min(30).max(12000),suggestions:z.string().trim().min(30).max(12000),overall:z.string().trim().min(20).max(12000),quote:z.string().max(4000).default(''),annotation:z.string().trim().max(8000).default('')});
function bad(message:string,status=400):never{throw Object.assign(new Error(message),{status});}
export async function POST(request:Request){try{
 const origin=request.headers.get('Origin'); if(!origin||origin!==new URL(request.url).origin) return json({error:'This request must come from the workshop.'},403);
 const raw=await request.text();if(raw.length>100000)return json({error:'This submission is too large.'},413);
 const b=JSON.parse(raw);const db=database();const user=await identity(db);if(!user)return json({error:'Sign in to save writing and join the workshop.'},401);
 const uid=user.userId;const now=Date.now();const p=await db.prepare('SELECT * FROM profiles WHERE id=?').bind(uid).first<{name:string;credits:number}>();if(!p)bad('Please sign in again.',401);
 if(b.action==='saveDraft'||b.action==='publish'){
 const w=workInput.parse(b.work);const count=wordCount(w.content);if(count>4000)bad('Please split pieces over 4,000 words into chapters.');
 const old=await db.prepare('SELECT * FROM works WHERE id=?').bind(w.id).first<{author_id:string;status:string}>();if(old&&(old.author_id!==uid||old.status!=='draft'))bad('Only your unpublished drafts can be edited here.',403);
 const publish=b.action==='publish';const eventId=`publish:${w.id}`;
 const query=db.prepare(`INSERT INTO works(id,author_id,author,title,genre,kind,stage,content,request,status,version,created_at,words,warning) ${publish?'SELECT ?,?,?,?,?,?,?,?,?,?,1,?,?,? WHERE EXISTS(SELECT 1 FROM credit_events WHERE id=?)':'VALUES(?,?,?,?,?,?,?,?,?,?,1,?,?,?)'} ON CONFLICT(id) DO UPDATE SET title=excluded.title,genre=excluded.genre,kind=excluded.kind,stage=excluded.stage,content=excluded.content,request=excluded.request,status=excluded.status,created_at=excluded.created_at,words=excluded.words,warning=excluded.warning WHERE works.author_id=excluded.author_id AND works.status='draft'`);
 const vals=[w.id,uid,p.name,w.title,w.genre,w.kind,w.stage,w.content,w.request,publish?'queued':'draft',now,count,w.warning];if(publish)vals.push(eventId);
 if(publish){
 if(p.credits<5)bad('You need 5 credits to publish. Give a critique to earn more.',409);
 const result=await db.batch([
 db.prepare('INSERT INTO credit_events(id,user_id,amount,reason,created_at) SELECT ?,?,-5,?,? WHERE (SELECT credits FROM profiles WHERE id=?)>=5 AND NOT EXISTS(SELECT 1 FROM works WHERE id=? AND (author_id<>? OR status<>\'draft\'))').bind(eventId,uid,'Published '+w.title,now,uid,w.id,uid),
 db.prepare('UPDATE profiles SET credits=credits-5 WHERE id=? AND EXISTS(SELECT 1 FROM credit_events WHERE id=?)').bind(uid,eventId),
 query.bind(...vals),db.prepare(promoteSQL)]);
 if(!result[0].meta.changes)bad('You need 5 credits to publish. Your draft is still here.',409);
 }else{await query.bind(...vals).run();}
 } else if(b.action==='review'){
 const r=reviewInput.parse(b.review);const count=wordCount(r.strengths+' '+r.suggestions+' '+r.overall+' '+r.annotation);if(count<100)bad('Write at least 100 words of specific feedback.');
 const w=await db.prepare('SELECT * FROM works WHERE id=?').bind(r.workId).first<{author_id:string;status:string;version:number;content:string;title:string}>();if(!w||['draft','withdrawn'].includes(w.status))bad('This work is no longer available.',404);if(w.author_id===uid)bad('You cannot earn credits by critiquing your own work.');
 if(r.quote&&!w.content.includes(r.quote))bad('The selected passage is no longer in this draft.');
 if(await db.prepare('SELECT id FROM reviews WHERE work_id=? AND user_id=? AND version=?').bind(r.workId,uid,w.version).first())bad('You have already critiqued this version.',409);
 const id=crypto.randomUUID();const critiqueResult=await db.batch([
 db.prepare("INSERT INTO reviews(id,work_id,user_id,author,strengths,suggestions,overall,annotation,quote,version,reward,created_at) SELECT ?,?,?,?,?,?,?,?,?,version,CASE WHEN status='spotlight' THEN 2 ELSE 1 END,? FROM works WHERE id=? AND version=? AND author_id<>? AND status NOT IN ('draft','withdrawn')").bind(id,r.workId,uid,p.name,r.strengths,r.suggestions,r.overall,r.annotation,r.quote,now,r.workId,w.version,uid),
 db.prepare('UPDATE profiles SET credits=credits+COALESCE((SELECT reward FROM reviews WHERE id=?),0) WHERE id=?').bind(id,uid),
 db.prepare('INSERT INTO credit_events(id,user_id,amount,reason,created_at) SELECT ?,?,reward,?,? FROM reviews WHERE id=?').bind(id,uid,'Critiqued '+w.title,now,id),
 db.prepare("UPDATE works SET status='open' WHERE status IN ('spotlight','queued') AND (SELECT COUNT(*) FROM reviews r WHERE r.work_id=works.id AND r.version=works.version)>=3"),db.prepare(promoteSQL)]);
 if(!critiqueResult[0].meta.changes)bad('This work is no longer available for critique.',409);
 }else if(b.action==='bookmark'){
 const id=z.string().max(100).parse(b.workId);if(!await db.prepare("SELECT id FROM works WHERE id=? AND status NOT IN ('draft','withdrawn')").bind(id).first())bad('This work is unavailable.',404);
 if(b.saved)await db.prepare('INSERT INTO bookmarks(id,user_id,work_id) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),uid,id).run();else await db.prepare('DELETE FROM bookmarks WHERE user_id=? AND work_id=?').bind(uid,id).run();
 }else if(b.action==='withdraw'){
 const id=z.string().max(100).parse(b.workId);const result=await db.batch([db.prepare("UPDATE works SET status='withdrawn' WHERE id=? AND author_id=? AND status<>'withdrawn'").bind(id,uid),db.prepare(promoteSQL)]);if(!result[0].meta.changes)bad('Work not found.',404);
 }else if(b.action==='join'){
 const id=z.string().max(100).parse(b.circleId);if(!await db.prepare('SELECT id FROM circles WHERE id=?').bind(id).first())bad('Circle not found.',404);
 if(b.joined)await db.prepare('INSERT INTO memberships(id,user_id,circle_id) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),uid,id).run();else await db.prepare('DELETE FROM memberships WHERE user_id=? AND circle_id=?').bind(uid,id).run();
 }else if(b.action==='createCircle'){
 const c=z.object({name:z.string().trim().min(3).max(80),description:z.string().trim().min(15).max(600),genre:z.enum(genres.slice(1) as [string,...string[]])}).parse(b.circle);const id=crypto.randomUUID();const critiqueResult=await db.batch([db.prepare('INSERT INTO circles(id,name,description,genre,owner_id) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(id,c.name,c.description,c.genre,uid),db.prepare('INSERT INTO memberships(id,user_id,circle_id) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(),uid,id)]);
 }else if(b.action==='post'){
 const id=z.string().max(100).parse(b.circleId),body=z.string().trim().min(5).max(5000).parse(b.body);if(!await db.prepare('SELECT id FROM memberships WHERE user_id=? AND circle_id=?').bind(uid,id).first())bad('Join this circle before posting.',403);await db.prepare('INSERT INTO posts(id,circle_id,user_id,author,body,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(),id,uid,p.name,body,now).run();
 }else if(b.action==='profile'){
 const name=z.string().trim().min(2).max(60).parse(b.name),bio=z.string().trim().max(1000).parse(b.bio);await db.batch([db.prepare('UPDATE profiles SET name=?,bio=? WHERE id=?').bind(name,bio,uid),db.prepare('UPDATE works SET author=? WHERE author_id=?').bind(name,uid),db.prepare('UPDATE reviews SET author=? WHERE user_id=?').bind(name,uid),db.prepare('UPDATE posts SET author=? WHERE user_id=?').bind(name,uid)]);
 }else if(b.action==='helpful'){
 const id=z.string().max(100).parse(b.reviewId);const result=await db.prepare('UPDATE reviews SET helpful=? WHERE id=? AND work_id IN (SELECT id FROM works WHERE author_id=?)').bind(b.helpful?1:0,id,uid).run();if(!result.meta.changes)bad('Only the writer can mark feedback helpful.',403);
 }else if(b.action==='report'){
 const id=z.string().max(100).parse(b.workId),reason=z.string().trim().min(10).max(1000).parse(b.reason);if(!await db.prepare("SELECT id FROM works WHERE id=? AND status NOT IN ('draft','withdrawn')").bind(id).first())bad('This work is unavailable.',404);await db.prepare('INSERT INTO reports(id,user_id,work_id,reason,created_at) VALUES(?,?,?,?,?) ON CONFLICT(work_id,user_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at').bind(crypto.randomUUID(),uid,id,reason,now).run();
 }else bad('Unknown workshop action.');
 return json(await snapshot(db,uid));
 }catch(e){if(e instanceof z.ZodError)return json({error:e.issues[0]?.message||'Please check your submission.'},400);const err=e as Error&{status?:number};if(err.status)return json({error:err.message},err.status);if(/UNIQUE constraint|duplicate key value/.test(err.message))return json({error:'This action was already completed. Refresh to see the latest state.'},409);console.error('Workshop write:',e);return json({error:'Could not save your changes. Your text is still here; please try again.'},503);}}



