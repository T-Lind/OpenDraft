import { database, type Database } from '@/db/storage';
import { readEnv, googleConfigured } from '@/lib/auth';
import { sampleWorks, sampleCircles, genres, wordCount, workKinds, acceptedWritingProcessValues } from '@/app/data';
import { z } from 'zod';
import { avatarPng, screenAvatar } from '@/lib/avatar';
import { rateLimit, writeLimits } from '@/lib/rate-limit';
import { queryCollection, workColumns, workExtras, unreadSQL } from '@/lib/workshop-query';
import { member,canContact,requireTerms,TERMS_VERSION } from '@/lib/member';
import { savePrivateDraft,revisionVersion } from '@/lib/draft-save';
import { promoteSQL } from '@/lib/reading-room';
import {emailPasswordConfigured} from '@/lib/password-auth';
import { changeReservation, availableCritiqueSlot } from '@/lib/critique-reservations';
import { circleProjection, changeCircleMembership, manageCircle } from '@/lib/circle-access';

export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

async function seed(db: Database) {
  if (await db.prepare("SELECT id FROM settings WHERE id='examples-v1'").first()) return;
  const q = sampleWorks.map(w => db.prepare("INSERT INTO works(id,author_id,author,title,genre,kind,stage,content,request,status,version,created_at,words,warning) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING").bind(w.id, w.authorId, w.author, w.title, w.genre, w.kind, w.stage, w.content, w.request, w.status, w.version, w.createdAt, w.words, w.warning));
  for (const c of sampleCircles) q.push(db.prepare('INSERT INTO circles(id,name,description,genre,owner_id) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(c.id, c.name, c.description, c.genre, 'system'));
  q.push(db.prepare("INSERT INTO settings(id,value) VALUES('examples-v1','1') ON CONFLICT(id) DO NOTHING"));
  await db.batch(q);
}

type Identity = { userId: string; email: string; fullName: string | null; displayName: string };

function adminEmails(): string[] {
  return (readEnv('ADMIN_EMAILS') || readEnv('ADMIN_EMAIL') || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

function sourceRepositoryUrl():string{
 const value=readEnv('SOURCE_REPOSITORY_URL')||readEnv('NEXT_PUBLIC_SOURCE_REPOSITORY_URL')||'';
 try{const url=new URL(value);return url.protocol==='https:'?url.toString():'';}catch{return '';}
}

function isAdminEmail(email: string | null | undefined): boolean {
  return !!email && adminEmails().includes(email.toLowerCase());
}

async function identity(db: Database,provision=true): Promise<Identity | null> {
 const m=await member(db,provision);return m?{userId:m.uid,email:m.email,fullName:String(m.profile.name),displayName:String(m.profile.name)}:null;
}

async function touchStreak(db: Database, uid: string, now: number): Promise<void> {
  const day = new Date(now).toISOString().slice(0, 10);
  const yesterday = new Date(now - 86_400_000).toISOString().slice(0, 10);
  await db.prepare('UPDATE profiles SET last_active_day=?, current_streak=CASE WHEN last_active_day=? THEN current_streak+1 ELSE 1 END, longest_streak=GREATEST(longest_streak, CASE WHEN last_active_day=? THEN current_streak+1 ELSE 1 END) WHERE id=? AND last_active_day<>?')
    .bind(day, yesterday, yesterday, uid, day).run();
}

type Row = Record<string, unknown>;

function ageBracket(age: number | null | undefined): string {
  if (age === null || age === undefined || Number.isNaN(age)) return 'Unknown';
  if (age < 18) return 'Under 18';
  if (age <= 24) return '18–24';
  if (age <= 34) return '25–34';
  if (age <= 44) return '35–44';
  if (age <= 54) return '45–54';
  if (age <= 64) return '55–64';
  return '65+';
}

function tally(counts: Record<string, number>, key: string | null | undefined): void {
  const label = key && String(key).trim() ? String(key).trim() : 'Not specified';
  counts[label] = (counts[label] || 0) + 1;
}

function buildAnalytics(total: Row | undefined, perWork: Row[], demographics: Row[], recent: Row[]) {
  const age: Record<string, number> = {};
  const sex: Record<string, number> = {};
  const locations: Record<string, number> = {};
  for (const row of demographics) {
    if(row.dimension){const counts=row.dimension==='age'?age:row.dimension==='sex'?sex:locations;counts[String(row.label)]=Number(row.n);continue;}
    const bracket = ageBracket(typeof row.age === 'number' ? row.age : null);
    age[bracket] = (age[bracket] || 0) + 1;
    tally(sex, row.sex as string);
    tally(locations, row.location as string);
  }
  const topLocations = Object.fromEntries(Object.entries(locations).sort((a, b) => b[1] - a[1]).slice(0, 6));
  return {
    totalReads: Number(total?.total_reads || 0),
    uniqueReaders: Number(total?.unique_readers || 0),
    works: perWork.map(w => ({ workId: String(w.work_id), title: String(w.title), words: Number(w.words || 0), views: Number(w.views || 0), readers: Number(w.readers || 0) })),
    age,
    sex,
    locations: topLocations,
    recentReaders: recent.map(r => ({ name: String(r.name || 'A reader'), age: typeof r.age === 'number' ? r.age : null, sex: String(r.sex || ''), location: String(r.location || ''), views: Number(r.views || 0), lastViewedAt: Number(r.last_viewed_at || 0) })),
  };
}

async function snapshot(db: Database, uid: string) {
  const r = await db.read([
    db.prepare('SELECT * FROM profiles WHERE id=?').bind(uid),
    db.prepare(`SELECT ${workColumns},''::text AS content,${workExtras} FROM works w WHERE w.id IN (SELECT id FROM works WHERE author_id=? ORDER BY created_at DESC,id DESC LIMIT 20) OR w.id IN (SELECT id FROM works WHERE status NOT IN ('draft','withdrawn') ORDER BY CASE status WHEN 'spotlight' THEN 0 WHEN 'queued' THEN 1 ELSE 2 END,created_at DESC,id DESC LIMIT 20) ORDER BY w.created_at DESC,w.id DESC`).bind(uid,uid,uid),
    db.prepare("SELECT r.*,w.title AS work_title FROM reviews r JOIN works w ON w.id=r.work_id WHERE w.author_id=? OR ((w.status NOT IN ('draft','withdrawn') OR (w.author_id='' AND r.user_id=?)) AND (r.user_id=? OR w.critique_visibility='public')) ORDER BY r.created_at DESC,r.id DESC LIMIT 20").bind(uid, uid, uid),
    db.prepare('SELECT work_id FROM bookmarks WHERE user_id=? ORDER BY id DESC LIMIT 50').bind(uid),
    db.prepare(`WITH viewer AS (SELECT ?::text AS uid) SELECT ${circleProjection} FROM circles c ORDER BY c.name,c.id LIMIT 20`).bind(uid),
    db.prepare("SELECT * FROM posts WHERE EXISTS(SELECT 1 FROM circles c WHERE c.id=posts.circle_id AND (c.access='open' OR EXISTS(SELECT 1 FROM memberships m WHERE m.circle_id=c.id AND m.user_id=?))) ORDER BY created_at DESC,id DESC LIMIT 20").bind(uid),
    db.prepare('SELECT * FROM credit_events WHERE user_id=? ORDER BY created_at DESC,id DESC LIMIT 20').bind(uid),
    db.prepare("SELECT a.* FROM annotations a JOIN works w ON w.id=a.work_id WHERE w.author_id=? OR (w.status NOT IN ('draft','withdrawn') AND (a.user_id=? OR w.critique_visibility='public')) ORDER BY a.created_at DESC,a.id DESC LIMIT 50").bind(uid, uid),
    db.prepare("SELECT COALESCE(SUM(v.views),0) AS total_reads, COUNT(DISTINCT v.user_id) AS unique_readers FROM work_views v JOIN works w ON w.id=v.work_id WHERE w.author_id=? AND w.status<>'withdrawn'").bind(uid),
    db.prepare("SELECT w.id AS work_id, w.title, w.words, COALESCE(SUM(v.views),0) AS views, COUNT(v.user_id) AS readers FROM works w LEFT JOIN work_views v ON v.work_id=w.id WHERE w.author_id=? AND w.status<>'withdrawn' GROUP BY w.id,w.title,w.words ORDER BY views DESC, w.created_at DESC LIMIT 50").bind(uid),
    db.prepare(`WITH readers AS (SELECT DISTINCT p.id,p.age,p.sex,p.location FROM work_views v JOIN works w ON w.id=v.work_id LEFT JOIN profiles p ON p.id=v.user_id WHERE w.author_id=? AND w.status<>'withdrawn')
      SELECT 'age' AS dimension, CASE WHEN age IS NULL THEN 'Unknown' WHEN age<18 THEN 'Under 18' WHEN age<=24 THEN '18–24' WHEN age<=34 THEN '25–34' WHEN age<=44 THEN '35–44' WHEN age<=54 THEN '45–54' WHEN age<=64 THEN '55–64' ELSE '65+' END AS label,COUNT(*)::int AS n FROM readers GROUP BY label
      UNION ALL SELECT 'sex',COALESCE(NULLIF(sex,''),'Not specified'),COUNT(*)::int FROM readers GROUP BY sex
      UNION ALL (SELECT 'location',COALESCE(NULLIF(location,''),'Not specified'),COUNT(*)::int FROM readers GROUP BY location ORDER BY 3 DESC LIMIT 6)`).bind(uid),
    db.prepare('SELECT p.name, p.age, p.sex, p.location, v.views, v.last_viewed_at FROM work_views v JOIN works w ON w.id=v.work_id JOIN profiles p ON p.id=v.user_id WHERE w.author_id=? AND w.status<>\'withdrawn\' ORDER BY v.last_viewed_at DESC LIMIT 12').bind(uid),
    db.prepare('SELECT * FROM messages WHERE (sender_id=? OR recipient_id=?) AND created_at>=(SELECT session_valid_after*1000 FROM profiles WHERE id=?) ORDER BY created_at DESC,id DESC LIMIT 20').bind(uid, uid, uid),
    db.prepare(`SELECT (SELECT COUNT(*) FROM works WHERE author_id=? AND status<>'withdrawn')::int AS works,(SELECT COALESCE(SUM(words),0) FROM works WHERE author_id=? AND status<>'withdrawn')::int AS words,(SELECT COUNT(*) FROM reviews WHERE user_id=?)::int AS given,(SELECT COUNT(*) FROM reviews r JOIN works w ON w.id=r.work_id WHERE w.author_id=?)::int AS received`).bind(uid,uid,uid,uid),
    db.prepare(unreadSQL).bind(uid,uid),
  ]);
  const camel = (row: Row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));
  const user = r[0].results[0] ? camel(r[0].results[0]) : null;
  const total = r[8].results[0];
  const analytics = uid ? buildAnalytics(total, r[9].results, r[10].results, r[11].results) : null;
  return {
    user,
    works: r[1].results.map(camel),
    reviews: r[2].results.map(camel),
    bookmarks: r[3].results.map(x => x.work_id),
    circles: r[4].results.map(camel),
    posts: r[5].results.map(camel),
    events: r[6].results.map(camel),
    annotations: r[7].results.map(camel),
    analytics,
    messages: r[12].results.map(camel),
    stats:r[13].results[0],
    unreadMessages:Number(r[14].results[0]?.unread||0),
  };
}

export async function GET(request?: Request) {
  try {
    const db = database();
    const collection=request&&new URL(request.url).searchParams.has('collection');
    if(!collection)await seed(db);
    const user = await identity(db,!collection);
    if (request && new URL(request.url).searchParams.has('collection')) {
      if (!user) return json({error:'Sign in to browse the workshop.'},401);
      return json(await queryCollection(db,user.userId,new URL(request.url).searchParams));
    }
    const publicConfig={googleConfigured:googleConfigured(),emailPasswordConfigured:emailPasswordConfigured(),sourceRepositoryUrl:sourceRepositoryUrl()};
    if (!user) return json({ user: null, works: [], reviews: [], bookmarks: [], circles: [], posts: [], events: [], annotations: [], analytics: null, messages: [], isAdmin: false, ...publicConfig });
    return json({ ...(await snapshot(db, user.userId)), isAdmin: isAdminEmail(user.email), ...publicConfig });
  } catch (e) {
    if ((e as {status?:number}).status) return json({error:(e as Error).message},(e as {status:number}).status);
    console.error('Workshop read:', e);
    return json({ error: 'The workshop could not load. Please try again.' }, 503);
  }
}

const workInput = z.object({ id: z.string().min(1).max(100), title: z.string().trim().min(1).max(120), genre: z.enum(genres.slice(1) as [string, ...string[]]), kind: z.enum(workKinds as [string, ...string[]]), stage: z.enum(['First draft', 'Second draft', 'Revision', 'Ready for a final look']), content: z.string().trim().min(1).max(50000), request: z.string().trim().min(5).max(800), warning: z.string().trim().max(300).default(''), mature: z.boolean().default(false), themes: z.string().trim().max(400).default(''), targetReviews: z.number().int().min(2).max(5).default(2), critiqueVisibility: z.enum(['public', 'private']).default('public'), aiProcess:z.enum(acceptedWritingProcessValues).default('not-declared'),revisionOf:z.string().min(1).max(100).nullable().default(null) });

const annotationInput = z.object({
  kind: z.enum(['delete', 'insert', 'highlight', 'comment']),
  quote: z.string().max(4000).default(''),
  body: z.string().max(4000).default(''),
  para: z.number().int().min(0).max(5000),
  start: z.number().int().min(0).max(1000000),
  end: z.number().int().min(0).max(1000000),
});

const reviewInput = z.object({
  workId: z.string().max(100),
  strengths: z.string().trim().max(12000).default(''),
  suggestions: z.string().trim().max(12000).default(''),
  overall: z.string().trim().max(12000).default(''),
  quote: z.string().max(4000).default(''),
  annotation: z.string().trim().max(8000).default(''),
  annotations: z.array(annotationInput).max(300).default([]),
  processDisclosure:z.enum(['human-only','assistive-tools']),
  attested:z.literal(true),
});

function bad(message: string, status = 400): never {
  throw Object.assign(new Error(message), { status });
}

const SPAM_PHRASES = ['buy now', 'click here', 'free money', 'make money fast', 'crypto giveaway', 'work from home', 'limited time offer', 'casino', 'bitcoin doubler', 'double your crypto', 'guaranteed income', 'no credit check', 'weight loss pill'];
function messageProblem(body: string): string | null {
  const lower = body.toLowerCase();
  const links = (lower.match(/https?:\/\//g) || []).length;
  if (links > 2) return 'messages with many links are not allowed';
  for (const phrase of SPAM_PHRASES) if (lower.includes(phrase)) return 'that looks like spam';
  const letters = body.replace(/[^a-z]/gi, '');
  if (letters.length > 30 && (body.replace(/[^A-Z]/g, '').length / letters.length) > 0.7) return 'please do not shout';
  if (/(.)\1{9,}/.test(body)) return 'please do not repeat characters';
  return null;
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== new URL(request.url).origin) return json({ error: 'This request must come from the workshop.' }, 403);
    const raw = await request.text();
    if (raw.length > 410000) return json({ error: 'This submission is too large.' }, 413);
    const b = JSON.parse(raw);
    if(!b||!['uploadAvatar','removeAvatar','saveDraft','autosaveDraft','publish','review','annotationResponse','bookmark','view','withdraw','join','createCircle','post','bulletin','profile','completeOnboarding','helpful','sendMessage','readMessage','report','feedback','updateWorkshop','addCircleReading','removeCircleReading','reserveCritique','renewCritique','releaseCritique','circleAccess','circleRequest','removeCircleMember'].includes(b.action))bad('Unknown workshop action.');
    if (b.action !== 'uploadAvatar' && raw.length > 200000) return json({ error: 'This submission is too large.' }, 413);
    const db = database();
    const user = await identity(db,b.action !== 'autosaveDraft');
    if (!user) return json({ error: 'Sign in to save writing and join the workshop.' }, 401);
    const uid = user.userId;
    const now = Date.now();
    await rateLimit(db,`write:${uid}`,120,60_000,now);
    const [maximum,windowMs]=writeLimits[b.action]||[30,60_000];
    await rateLimit(db,`action:${b.action}:${uid}`,maximum,windowMs,now);
    const p = await db.prepare('SELECT * FROM profiles WHERE id=?').bind(uid).first<{ name: string; credits: number;terms_version:string }>();
    if (!p) bad('Please sign in again.', 401);
    if (!['view', 'bookmark', 'readMessage'].includes(b.action)) await touchStreak(db, uid, now);

    if(['publish','review','createCircle','join','post','bulletin','sendMessage','updateWorkshop','addCircleReading','reserveCritique','circleAccess','circleRequest','removeCircleMember'].includes(b.action))requireTerms(p!);
    let actionNotice = '';
    if (['reserveCritique','renewCritique','releaseCritique'].includes(b.action)) {
      const workId=z.string().min(1).max(100).parse(b.workId);
      return json(await changeReservation(db,uid,workId,b.action,now));
    } else if (b.action === 'uploadAvatar') {
      const image = z.string().max(405000).parse(b.image);
      try { avatarPng(image); } catch (e) { bad((e as Error).message); }
      const allowed = await db.prepare('UPDATE profiles SET avatar_scan_at=? WHERE id=? AND avatar_scan_at<?').bind(now, uid, now - 30_000).run();
      if (!allowed.meta.changes) bad('Please wait thirty seconds before trying another picture.', 429);
      await screenAvatar(image);
      const result=await db.batch([
        db.prepare('INSERT INTO profile_photos(user_id,image_data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET image_data=excluded.image_data,updated_at=excluded.updated_at').bind(uid, image, now),
        db.prepare('UPDATE profiles SET avatar_updated_at=? WHERE id=? AND deleted_at=0').bind(now, uid),
      ]);
      if(!result[1].meta.changes)bad('Your session ended during picture screening. Sign in again.',401);
    } else if (b.action === 'removeAvatar') {
      await db.batch([db.prepare('DELETE FROM profile_photos WHERE user_id=?').bind(uid), db.prepare('UPDATE profiles SET avatar_updated_at=0 WHERE id=?').bind(uid)]);
    } else if (b.action === 'saveDraft' || b.action === 'autosaveDraft') {
      const expected = b.action === 'autosaveDraft' ? z.number().int().nonnegative().parse(b.expectedSavedAt) : undefined;
      const saved = await savePrivateDraft(db,uid,p.name,b.work,expected);
      if (b.action === 'autosaveDraft') return json(saved);
    } else if (b.action === 'publish') {
      const w = workInput.parse(b.work);
      const count = wordCount(w.content);
      if (count > 4000) bad('Please split pieces over 4,000 words into chapters.');
      const old = await db.prepare('SELECT * FROM works WHERE id=?').bind(w.id).first<{ author_id: string; status: string; created_at:number;version:number;revision_of:string|null }>();
      if (old && (old.author_id !== uid || old.status !== 'draft')) bad('Only your unpublished drafts can be edited here.', 403);
      const expected = b.expectedSavedAt === undefined ? undefined : z.number().int().nonnegative().parse(b.expectedSavedAt);
      if (old && expected !== undefined && old.created_at !== expected) bad('This draft changed in another tab. Reload it before publishing.',409);
      if(old&&(old.revision_of||null)!==w.revisionOf)bad('The source revision cannot be changed.',409);
      const version=old?Number(old.version):await revisionVersion(db,uid,w.revisionOf);
      const eventId='publish:'+w.id,cost=5+2*(w.targetReviews-2);
      const vals=[w.id,uid,p.name,w.title,w.genre,w.kind,w.stage,w.content,w.request,'queued',version,now,count,w.warning,w.mature,w.themes,w.targetReviews,w.critiqueVisibility,w.revisionOf,w.aiProcess,eventId];
      const result=await db.batch([
        db.prepare('SELECT id FROM works WHERE id=? FOR UPDATE').bind(w.id),
        db.prepare(`INSERT INTO credit_events(id,user_id,amount,reason,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND credits>=? AND deleted_at=0 AND terms_version=?) AND NOT EXISTS(SELECT 1 FROM works WHERE id=? AND (author_id<>? OR status<>'draft' ${expected===undefined?'':'OR created_at<>?'}))`).bind(eventId,uid,-cost,'Published '+w.title,now,uid,cost,TERMS_VERSION,w.id,uid,...(expected===undefined?[]:[expected])),
        db.prepare('UPDATE profiles SET credits=credits-? WHERE id=? AND EXISTS(SELECT 1 FROM credit_events WHERE id=?)').bind(cost,uid,eventId),
        db.prepare("INSERT INTO works(id,author_id,author,title,genre,kind,stage,content,request,status,version,created_at,words,warning,mature,themes,target_reviews,critique_visibility,revision_of,ai_process) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM credit_events WHERE id=?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,genre=excluded.genre,kind=excluded.kind,stage=excluded.stage,content=excluded.content,request=excluded.request,status=excluded.status,created_at=excluded.created_at,words=excluded.words,warning=excluded.warning,mature=excluded.mature,themes=excluded.themes,target_reviews=excluded.target_reviews,critique_visibility=excluded.critique_visibility,ai_process=excluded.ai_process WHERE works.author_id=excluded.author_id AND works.status='draft'").bind(...vals),
        db.prepare(promoteSQL)
      ]);
      if(!result[1].meta.changes)bad('Publication could not complete: your balance or draft changed. Your text is still here.',409);
    } else if (b.action === 'review') {
      const r = reviewInput.parse(b.review);
      const count = wordCount(r.strengths + ' ' + r.suggestions + ' ' + r.overall + ' ' + r.annotation + ' ' + r.annotations.map(a => a.body).join(' '));
      if (!count) bad('Add some feedback before sharing your critique. Short critiques are welcome.');
      const w = await db.prepare('SELECT * FROM works WHERE id=?').bind(r.workId).first<{ author_id: string; status: string; version: number; content: string; title: string }>();
      if (!w || ['draft', 'withdrawn'].includes(w.status)) bad('This work is no longer available.', 404);
      if (w.author_id === uid) bad('You cannot earn credits by critiquing your own work.');
      if (r.quote && !w.content.includes(r.quote)) bad('The selected passage is no longer in this draft.');
      if (await db.prepare('SELECT id FROM reviews WHERE work_id=? AND user_id=? AND version=?').bind(r.workId, uid, w.version).first()) bad('You have already critiqued this version.', 409);
      const id = crypto.randomUUID();
      const annotationStatements = r.annotations.map(a => db.prepare('INSERT INTO annotations(id,review_id,work_id,user_id,author,kind,quote,body,para,start_pos,end_pos,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM reviews WHERE id=?)').bind(crypto.randomUUID(), id, r.workId, uid, p.name, a.kind, a.quote, a.body, a.para, a.start, a.end, now,id));
      const critiqueResult = await db.batch([
        db.prepare(`INSERT INTO reviews(id,work_id,user_id,author,strengths,suggestions,overall,annotation,quote,process_disclosure,attested,version,reward,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,version,CASE WHEN ?<175 THEN 0 ELSE ROUND(((CASE WHEN status='spotlight' THEN 1 ELSE 0.5 END)*(1+(?-175)*0.005))::numeric,3) END,? FROM works WHERE id=? AND version=? AND author_id<>? AND status NOT IN ('draft','withdrawn') AND ${availableCritiqueSlot} RETURNING reward`).bind(id, r.workId, uid, p.name, r.strengths, r.suggestions, r.overall, r.annotation, r.quote,r.processDisclosure,r.attested,count,count,now,r.workId,w.version,uid,now,uid),
        db.prepare('UPDATE profiles SET credits=credits+COALESCE((SELECT reward FROM reviews WHERE id=?),0) WHERE id=?').bind(id, uid),
        db.prepare('INSERT INTO credit_events(id,user_id,amount,reason,created_at) SELECT ?,?,reward,?,? FROM reviews WHERE id=? AND reward>0').bind(id, uid, 'Critiqued ' + w.title, now, id),
        ...annotationStatements,
        db.prepare('DELETE FROM critique_reservations WHERE user_id=? AND work_id=? AND EXISTS(SELECT 1 FROM reviews WHERE id=?)').bind(uid,r.workId,id),
        db.prepare("UPDATE works SET status='open' WHERE status IN ('spotlight','queued') AND (SELECT COUNT(*) FROM reviews r WHERE r.work_id=works.id AND r.version=works.version)>=COALESCE(target_reviews,2)"),
        db.prepare(promoteSQL),
      ]);
      if (!critiqueResult[0].meta.changes) bad('The remaining requested critique spots are held by other readers, or this work changed. Your draft is safe; wait for a spot or try another work.', 409);
      const earned=Number(critiqueResult[0].results[0].reward);
      actionNotice=earned ? `Critique shared. You earned ${earned.toLocaleString(undefined,{maximumFractionDigits:3})} credits.` : 'Critique shared. Thank you for helping this writer. This shorter critique earned no credits.';
    } else if(b.action==='annotationResponse'){
      const input=z.object({annotationId:z.string().max(100),status:z.enum(['open','resolved','kept','not-this-draft']),response:z.string().trim().max(500).default('')}).parse(b);
      const changed=await db.prepare('UPDATE annotations a SET writer_status=?,writer_response=? FROM works w WHERE a.id=? AND w.id=a.work_id AND w.author_id=?').bind(input.status,input.response,input.annotationId,uid).run();
      if(!changed.meta.changes)bad('Only the writer can update this revision note.',403);
    } else if (b.action === 'bookmark') {
      const id = z.string().max(100).parse(b.workId);
      if (!await db.prepare("SELECT id FROM works WHERE id=? AND status NOT IN ('draft','withdrawn')").bind(id).first()) bad('This work is unavailable.', 404);
      if (b.saved) await db.prepare('INSERT INTO bookmarks(id,user_id,work_id) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(), uid, id).run();
      else await db.prepare('DELETE FROM bookmarks WHERE user_id=? AND work_id=?').bind(uid, id).run();
    } else if (b.action === 'view') {
      const id = z.string().max(100).parse(b.workId);
      const w = await db.prepare("SELECT author_id FROM works WHERE id=? AND status NOT IN ('draft','withdrawn')").bind(id).first<{ author_id: string }>();
      if (!w) bad('Work not found.', 404);
      if (w.author_id !== uid) {
        await db.prepare('INSERT INTO work_views(work_id,user_id,views,first_viewed_at,last_viewed_at) VALUES(?,?,1,?,?) ON CONFLICT (work_id,user_id) DO UPDATE SET views=work_views.views+1,last_viewed_at=excluded.last_viewed_at').bind(id, uid, now, now).run();
      }
      return json({ ok: true });
    } else if (b.action === 'withdraw') {
      const id = z.string().max(100).parse(b.workId);
      const result = await db.batch([db.prepare("UPDATE works SET status='withdrawn' WHERE id=? AND author_id=? AND status<>'withdrawn'").bind(id, uid), db.prepare("DELETE FROM critique_reservations WHERE work_id=? AND EXISTS(SELECT 1 FROM works WHERE id=? AND author_id=? AND status='withdrawn')").bind(id,id,uid), db.prepare("DELETE FROM circle_readings WHERE work_id=? AND EXISTS(SELECT 1 FROM works WHERE id=? AND author_id=? AND status='withdrawn')").bind(id,id,uid), db.prepare(promoteSQL)]);
      if (!result[0].meta.changes) bad('Work not found.', 404);
    } else if (b.action === 'join') {
      const id = z.string().max(100).parse(b.circleId);
      await changeCircleMembership(db,uid,id,z.boolean().parse(b.joined),now);
    } else if (['circleAccess','circleRequest','removeCircleMember'].includes(b.action)) {
      await manageCircle(db,uid,b,now);
    } else if (b.action === 'createCircle') {
      const c = z.object({ name: z.string().trim().min(3).max(80), description: z.string().trim().min(15).max(600), genre: z.enum(genres.slice(1) as [string, ...string[]]),access:z.enum(['open','approval']).default('open') }).parse(b.circle);
      const id = crypto.randomUUID();
      await db.batch([db.prepare('INSERT INTO circles(id,name,description,genre,owner_id,access) VALUES(?,?,?,?,?,?) ON CONFLICT DO NOTHING').bind(id, c.name, c.description, c.genre, uid,c.access), db.prepare('INSERT INTO memberships(id,user_id,circle_id) VALUES(?,?,?) ON CONFLICT DO NOTHING').bind(crypto.randomUUID(), uid, id)]);
    } else if (b.action === 'updateWorkshop') {
      const input=z.object({circleId:z.string().min(1).max(100),workshopPrompt:z.string().trim().max(1200),workshopAgenda:z.string().trim().max(2000),meetingPlace:z.string().trim().max(240),meetingAt:z.number().int().min(0).max(4102444800000),feedbackDueAt:z.number().int().min(0).max(4102444800000)}).parse(b);
      const result=await db.prepare('UPDATE circles SET workshop_prompt=?,workshop_agenda=?,meeting_place=?,meeting_at=?,feedback_due_at=? WHERE id=? AND owner_id=?').bind(input.workshopPrompt,input.workshopAgenda,input.meetingPlace,input.meetingAt,input.feedbackDueAt,input.circleId,uid).run();
      if(!result.meta.changes)bad('Only the circle owner can edit the workshop brief.',403);
    } else if (b.action === 'addCircleReading') {
      const circleId=z.string().min(1).max(100).parse(b.circleId),workId=z.string().min(1).max(100).parse(b.workId);
      const result=await db.batch([db.prepare("INSERT INTO circle_readings(id,circle_id,work_id,added_by,created_at) SELECT ?,?,w.id,?,? FROM works w WHERE w.id=? AND w.status NOT IN ('draft','withdrawn') AND EXISTS(SELECT 1 FROM memberships WHERE circle_id=? AND user_id=?) AND (SELECT COUNT(*) FROM circle_readings WHERE circle_id=?)<24 ON CONFLICT(circle_id,work_id) DO NOTHING").bind(crypto.randomUUID(),circleId,uid,now,workId,circleId,uid,circleId)]);
      if(!result[0].meta.changes)bad('Join the circle and choose an available published work not already on the list. Each circle can hold up to 24 readings.',409);
    } else if (b.action === 'removeCircleReading') {
      const circleId=z.string().min(1).max(100).parse(b.circleId),readingId=z.string().min(1).max(100).parse(b.readingId);
      const result=await db.prepare('DELETE FROM circle_readings cr WHERE cr.id=? AND cr.circle_id=? AND EXISTS(SELECT 1 FROM memberships WHERE circle_id=cr.circle_id AND user_id=?) AND (cr.added_by=? OR EXISTS(SELECT 1 FROM circles WHERE id=cr.circle_id AND owner_id=?))').bind(readingId,circleId,uid,uid,uid).run();
      if(!result.meta.changes)bad('Only the member who added this reading or the circle owner can remove it.',403);
    } else if (b.action === 'post') {
      const id = z.string().max(100).parse(b.circleId), body = z.string().trim().min(5).max(5000).parse(b.body);
      if (!await db.prepare('SELECT id FROM memberships WHERE user_id=? AND circle_id=?').bind(uid, id).first()) bad('Join this circle before posting.', 403);
      const posted=await db.batch([db.prepare('INSERT INTO posts(id,circle_id,user_id,author,body,created_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM memberships WHERE user_id=? AND circle_id=?)').bind(crypto.randomUUID(), id, uid, p.name, body, now,uid,id)]);
      if(!posted[0].meta.changes)bad('Join this circle before posting.',403);
    } else if (b.action === 'bulletin') {
      const circleId=z.string().max(100).parse(b.circleId),body=z.string().trim().min(5).max(4000).parse(b.body);
      const circle=await db.prepare('SELECT name FROM circles WHERE id=? AND owner_id=?').bind(circleId,uid).first<{name:string}>();
      if(!circle)bad('Only the circle owner can send a bulletin.',403);
      const problem=messageProblem(body);if(problem)bad('This bulletin was not sent: '+problem+'.',422);
      const id=crypto.randomUUID();
      await db.batch([
        db.prepare('INSERT INTO bulletins(id,circle_id,sender_id,sender,circle_name,body,created_at) VALUES(?,?,?,?,?,?,?)').bind(id,circleId,uid,p.name,circle.name,body,now),
        db.prepare('INSERT INTO bulletin_deliveries(bulletin_id,recipient_id,created_at,read_at) SELECT ?,user_id,?,CASE WHEN user_id=? THEN ?::bigint ELSE NULL::bigint END FROM memberships WHERE circle_id=?').bind(id,now,uid,now,circleId),
      ]);
    } else if (b.action === 'profile' || b.action === 'completeOnboarding') {
      if(b.action==='completeOnboarding'&&(b.acceptedTerms!==true||b.termsVersion!==TERMS_VERSION))bad('Please accept the current terms and privacy policy.');
      const input = z.object({
        name: z.string().trim().min(2).max(60),
        bio: z.string().trim().max(1000).default(''),
        age: z.union([z.number().int().min(13).max(120), z.null()]).optional(),
        sex: z.string().trim().max(40).default(''),
        location: z.string().trim().max(80).default(''),
        interests: z.string().trim().max(400).default(''),
      }).parse({ name: b.name, bio: b.bio, age: b.age === '' || b.age === undefined ? null : Number(b.age), sex: b.sex, location: b.location, interests: b.interests });
      await db.batch([
        ...(b.action==='completeOnboarding'?[db.prepare('UPDATE profiles SET terms_version=?,terms_accepted_at=? WHERE id=? AND deleted_at=0').bind(TERMS_VERSION,now,uid)]:[]),
        db.prepare('UPDATE profiles SET name=?,bio=?,age=?,sex=?,location=?,interests=?,onboarding_completed=CASE WHEN ? THEN true ELSE onboarding_completed END WHERE id=? AND deleted_at=0').bind(input.name, input.bio, input.age, input.sex, input.location, input.interests, b.action === 'completeOnboarding', uid),
        db.prepare('UPDATE works SET author=? WHERE author_id=?').bind(input.name, uid),
        db.prepare('UPDATE reviews SET author=? WHERE user_id=?').bind(input.name, uid),
        db.prepare('UPDATE annotations SET author=? WHERE user_id=?').bind(input.name, uid),
        db.prepare('UPDATE posts SET author=? WHERE user_id=?').bind(input.name, uid),
        db.prepare('UPDATE messages SET sender=? WHERE sender_id=? AND EXISTS(SELECT 1 FROM profiles p WHERE p.id=messages.sender_id AND p.deleted_at=0)').bind(input.name, uid),
        db.prepare('UPDATE messages SET recipient=? WHERE recipient_id=? AND EXISTS(SELECT 1 FROM profiles p WHERE p.id=messages.recipient_id AND p.deleted_at=0)').bind(input.name, uid),
      ]);
    } else if (b.action === 'helpful') {
      const id = z.string().max(100).parse(b.reviewId);
      const result = await db.prepare('UPDATE reviews SET helpful=? WHERE id=? AND work_id IN (SELECT id FROM works WHERE author_id=?)').bind(b.helpful ? 1 : 0, id, uid).run();
      if (!result.meta.changes) bad('Only the writer can mark feedback helpful.', 403);
    } else if (b.action === 'sendMessage') {
      const recipient = z.string().max(100).parse(b.recipientId);
      if (recipient.startsWith('sample-')) bad('Example authors are fictional and cannot receive messages. Choose a workshop member.', 400);
      const body = z.string().trim().min(2).max(4000).parse(b.body);
      if (recipient === uid) bad('You cannot message yourself.');
      if (!await db.prepare('SELECT id FROM profiles WHERE id=?').bind(recipient).first()) bad('That writer could not be found.', 404);
      const problem = messageProblem(body);
      if (problem) bad('This message was not sent: ' + problem + '.', 422);
      await rateLimit(db,`message-hour:${uid}`,20,3_600_000,now);
      await rateLimit(db,`message-day:${uid}`,100,86_400_000,now);
      await rateLimit(db,`message-recipient:${uid}:${recipient}`,5,60_000,now);
      const target=await canContact(db,uid,recipient);
      if(!target||target.blocked||(target.friends_only&&!target.friends))bad('This writer is not accepting messages from you.',403);
      const sent=await db.prepare("WITH sender AS (SELECT id FROM profiles WHERE id=? AND deleted_at=0 FOR SHARE) INSERT INTO messages(id,sender_id,sender,recipient_id,recipient,body,flagged,read_at,created_at) SELECT ?,?,?,?,?,?,0,NULL,? FROM sender,profiles p WHERE p.id=? AND p.deleted_at=0 AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=? AND b.blocked_id=?) OR (b.user_id=? AND b.blocked_id=?)) AND (p.friends_only=false OR EXISTS(SELECT 1 FROM friendships f WHERE f.low_id=LEAST(?,?) AND f.high_id=GREATEST(?,?) AND f.status='accepted'))").bind(uid,crypto.randomUUID(),uid,p.name,recipient,target.name,body,now,recipient,uid,recipient,recipient,uid,uid,recipient,uid,recipient).run();
      if(!sent.meta.changes)bad('This writer is no longer accepting messages from you.',403);
    } else if (b.action === 'readMessage') {
      if(b.circleId){const circleId=z.string().max(100).parse(b.circleId);await db.prepare('UPDATE bulletin_deliveries SET read_at=? WHERE recipient_id=? AND read_at IS NULL AND bulletin_id IN (SELECT id FROM bulletins WHERE circle_id=?)').bind(now,uid,circleId).run();}
      else {const other = z.string().max(100).parse(b.userId);await db.prepare('UPDATE messages SET read_at=? WHERE recipient_id=? AND sender_id=? AND read_at IS NULL').bind(now, uid, other).run();}
      if (b.quiet === true) { const counts=await db.prepare(unreadSQL).bind(uid,uid).first<{unread:number}>(); return json({unreadMessages:Number(counts?.unread||0)}); }
    } else if (b.action === 'report') {
      const id = z.string().max(100).parse(b.workId), reason = z.string().trim().min(10).max(1000).parse(b.reason);
      if (!await db.prepare("SELECT id FROM works WHERE id=? AND status NOT IN ('draft','withdrawn')").bind(id).first()) bad('This work is unavailable.', 404);
      await db.prepare("INSERT INTO reports(id,user_id,work_id,reason,created_at) VALUES(?,?,?,?,?) ON CONFLICT(work_id,user_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at,status='open',resolution='',resolved_at=NULL").bind(crypto.randomUUID(), uid, id, reason, now).run();
    } else if (b.action === 'feedback') {
      const kind = z.enum(['bug', 'feature']).parse(b.kind);
      const body = z.string().trim().min(5).max(4000).parse(b.body);
      const page = z.string().trim().max(200).default('').parse(b.page || '');
      await db.prepare('INSERT INTO feedback(id,user_id,email,kind,body,page,status,created_at) VALUES(?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(), uid, user.email || '', kind, body, page, 'open', now).run();
    } else bad('Unknown workshop action.');

    return json({ ...(await snapshot(db, uid)), actionNotice, isAdmin: isAdminEmail(user.email), googleConfigured: googleConfigured(),emailPasswordConfigured:emailPasswordConfigured(),sourceRepositoryUrl:sourceRepositoryUrl() });
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues[0]?.message || 'Please check your submission.' }, 400);
    const err = e as Error & { status?: number;retryAfter?:number };
    if (err.status) return Response.json({error:err.message},{status:err.status,headers:{'Cache-Control':'no-store',...(err.retryAfter?{'Retry-After':String(err.retryAfter)}:{})}});
    if (e instanceof SyntaxError) return json({error:'Please send a valid JSON submission.'},400);
    if (/UNIQUE constraint|duplicate key value/.test(err.message)) return json({ error: 'This action was already completed. Refresh to see the latest state.' }, 409);
    console.error('Workshop write:', e);
    return json({ error: 'Could not save your changes. Your text is still here; please try again.' }, 503);
  }
}
