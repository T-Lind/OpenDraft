import { database, type Database, type Statement } from '@/db/storage';
import { readEnv } from '@/lib/auth';
import {member} from '@/lib/member';
import { z } from 'zod';
import { readCursor,limitFor,pageOf } from '@/lib/pagination';
import { rateLimit } from '@/lib/rate-limit';
import { promoteSQL } from '@/lib/reading-room';
import { accountReview } from '@/lib/account-review';

export const dynamic = 'force-dynamic';

const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });

type Row = Record<string, unknown>;
const camel = (row: Row): Row => Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));

function adminEmails(): string[] {
  return (readEnv('ADMIN_EMAILS') || readEnv('ADMIN_EMAIL') || '')
    .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

type Identity = { userId: string; email: string; name: string };

async function requireAdmin(db: Database): Promise<Identity | null> {
  const m=await member(db,true);const user:Identity|null=m?{userId:m.uid,email:m.email,name:String(m.profile.name)}:null;
  if (!user || !adminEmails().includes((user.email || '').toLowerCase())) return null;
  await db.prepare('INSERT INTO profiles(id,name,email,created_at) VALUES(?,?,?,?) ON CONFLICT (id) DO NOTHING').bind(user.userId, 'Writer', user.email, Date.now()).run();
  return user;
}

async function overview(db: Database) {
  const r = await db.read([
    db.prepare('SELECT COUNT(*) AS n FROM profiles WHERE deleted_at=0'),
    db.prepare("SELECT status, COUNT(*) AS n FROM works WHERE author_id<>'' GROUP BY status"),
    db.prepare('SELECT COUNT(*) AS n FROM reviews'),
    db.prepare('SELECT COUNT(*) AS n FROM messages'),
    db.prepare('SELECT COUNT(*) AS n FROM messages WHERE flagged>0'),
    db.prepare("SELECT COUNT(*) AS n FROM reports WHERE status='open'"),
    db.prepare("SELECT COUNT(*) AS n FROM feedback WHERE status='open'"),
    db.prepare('SELECT r.*, w.title AS work_title, w.author AS work_author FROM reports r LEFT JOIN works w ON w.id=r.work_id ORDER BY r.created_at DESC LIMIT 100'),
    db.prepare('SELECT * FROM feedback ORDER BY created_at DESC LIMIT 100'),
    db.prepare("SELECT w.id, w.title, w.author, w.status, w.words, w.created_at, (SELECT COUNT(*) FROM reviews r WHERE r.work_id=w.id) AS reviews FROM works w WHERE w.status NOT IN ('draft','withdrawn') ORDER BY w.created_at DESC LIMIT 100"),
    db.prepare('SELECT id, sender, recipient, body, flagged, created_at FROM messages WHERE flagged>0 ORDER BY created_at DESC LIMIT 100'),
    db.prepare("SELECT genre, SUM(CASE WHEN status='spotlight' THEN 1 ELSE 0 END) AS reading_room, SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) AS queue FROM works WHERE status IN ('spotlight','queued') GROUP BY genre ORDER BY genre"),
  ]);
  const worksByStatus: Record<string, number> = {};
  for (const row of r[1].results) worksByStatus[String(row.status)] = Number(row.n || 0);
  return {
    counts: {
      members: Number(r[0].results[0]?.n || 0),
      works: Object.values(worksByStatus).reduce((a, b) => a + b, 0),
      worksByStatus,
      readingRoom: worksByStatus['spotlight'] || 0,
      queued: worksByStatus['queued'] || 0,
      reviews: Number(r[2].results[0]?.n || 0),
      messages: Number(r[3].results[0]?.n || 0),
      flaggedMessages: Number(r[4].results[0]?.n || 0),
      reports: Number(r[5].results[0]?.n || 0),
      openFeedback: Number(r[6].results[0]?.n || 0),
    },
    reports: r[7].results.map(camel),
    feedback: r[8].results.map(camel),
    works: r[9].results.map(camel),
    flaggedMessages: r[10].results.map(camel),
    queues: r[11].results.map(row => ({ genre: String(row.genre), readingRoom: Number(row.reading_room || 0), queue: Number(row.queue || 0) })),
  };
}

export async function GET(request?:Request) {
  try {
    const db = database();
    const admin = await requireAdmin(db);
    if (!admin) return json({ error: 'Administrator access is required.' }, 403);
    const params=request?new URL(request.url).searchParams:null;
    if(params?.has('collection')){
      if(['accountSignals','accountEvidence'].includes(params.get('collection')||''))return json(await accountReview(db,params));
      const cursor=readCursor(params.get('cursor')),limit=limitFor(params);
      const listings:Record<string,string>={reports:'SELECT r.*,w.title AS work_title,w.author AS work_author FROM reports r LEFT JOIN works w ON w.id=r.work_id',feedback:'SELECT * FROM feedback',works:"SELECT w.id,w.title,w.author,w.status,w.words,w.created_at,(SELECT COUNT(*) FROM reviews r WHERE r.work_id=w.id)::int AS reviews FROM works w WHERE w.status<>'draft'",flaggedMessages:'SELECT id,sender,recipient,body,flagged,created_at FROM messages WHERE flagged>0'};
      listings.audit='SELECT a.*,p.name AS admin_name FROM admin_actions a JOIN profiles p ON p.id=a.admin_id';
      const listing=listings[params.get('collection')||''];if(!listing)return json({error:'Unknown admin collection.'},400);
      const collection=params.get('collection');const filters:string[]=[],values:unknown[]=[];
      if(collection==='feedback'||collection==='reports'){const allowed=collection==='feedback'?['open','resolved','archived']:['open','dismissed'];const status=params.get('status')||'open';if(status!=='all'){if(!allowed.includes(status))return json({error:'Unknown status.'},400);filters.push('status=?');values.push(status);}}
      if(cursor){filters.push('(created_at,id)<(?,?)');values.push(cursor.value,cursor.id);}
      const rows=(await db.prepare(`SELECT * FROM (${listing}) listing ${filters.length?'WHERE '+filters.join(' AND '):''} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(...values,limit+1).all()).results;
      const page=pageOf(rows,limit);return json({...page,items:page.items.map(camel)});
    }
    return json(await overview(db));
  } catch (e) {
    if((e as {status?:number}).status)return json({error:(e as Error).message},(e as {status:number}).status);
    console.error('Admin read:', e);
    return json({ error: 'The admin dashboard could not load.' }, 503);
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('Origin');
    if (!origin || origin !== new URL(request.url).origin) return json({ error: 'This request must come from the workshop.' }, 403);
    const raw=await request.text();if(raw.length>10000)return json({error:'This request is too large.'},413);
    const b = JSON.parse(raw) as Record<string, unknown>;
    const db = database();
    const admin = await requireAdmin(db);
    if (!admin) return json({ error: 'Administrator access is required.' }, 403);
    const now = Date.now();
    await rateLimit(db,'admin:'+admin.userId,60,60_000,now);
    const reasonActions=['dismissReport','withdrawWork','restoreWork','clearMessageFlag','deleteMessage','deleteFeedback','grantCredits'];
    const reason=reasonActions.includes(String(b.action))?z.string().trim().min(5).max(800).parse(b.reason):'';
    const statements:Statement[]=[];
    let target='',details='';

    if (b.action === 'setFeedbackStatus') {
      const id = z.string().max(100).parse(b.id);
      const status = z.enum(['open', 'resolved', 'archived']).parse(b.status);
      target=id;details=JSON.stringify({status});statements.push(db.prepare('UPDATE feedback SET status=? WHERE id=?').bind(status,id));
    } else if (b.action === 'deleteFeedback') {
      const id = z.string().max(100).parse(b.id);
      target=id;statements.push(db.prepare('DELETE FROM feedback WHERE id=?').bind(id));
    } else if (b.action === 'dismissReport') {
      const id = z.string().max(100).parse(b.id);
      target=id;statements.push(db.prepare("UPDATE reports SET status='dismissed',resolution=?,resolved_at=? WHERE id=? AND status='open'").bind(reason,now,id));
    } else if (b.action === 'withdrawWork') {
      const id = z.string().max(100).parse(b.id);
      target=id;statements.push(db.prepare("UPDATE works SET status='withdrawn' WHERE id=? AND status NOT IN ('draft','withdrawn')").bind(id));
    } else if (b.action === 'restoreWork') {
      const id = z.string().max(100).parse(b.id);
      target=id;statements.push(db.prepare("UPDATE works SET status='queued' WHERE id=? AND status='withdrawn' AND author_id<>''").bind(id));
    } else if (b.action === 'clearMessageFlag') {
      const id = z.string().max(100).parse(b.id);
      target=id;statements.push(db.prepare('UPDATE messages SET flagged=0 WHERE id=?').bind(id));
    } else if (b.action === 'deleteMessage') {
      const id = z.string().max(100).parse(b.id);
      target=id;statements.push(db.prepare('DELETE FROM messages WHERE id=?').bind(id));
    } else if (b.action === 'grantCredits') {
      const id = z.string().max(100).parse(b.userId);
      const amount = z.number().min(-1000).max(1000).parse(b.amount);
      target=id;details=JSON.stringify({amount});const event=crypto.randomUUID();
      statements.push(db.prepare('INSERT INTO credit_events(id,user_id,amount,reason,created_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND credits+?>=0)').bind(event,id,amount,'Administrator adjustment: '+reason,now,id,amount),db.prepare('UPDATE profiles SET credits=credits+? WHERE id=? AND EXISTS(SELECT 1 FROM credit_events WHERE id=?)').bind(amount,id,event));
    } else {
      return json({ error: 'Unknown admin action.' }, 400);
    }
    if (b.action==='withdrawWork'||b.action==='restoreWork') statements.push(db.prepare(promoteSQL));
    statements.push(db.prepare('INSERT INTO admin_actions(id,admin_id,action,target_id,reason,details,created_at) VALUES(?,?,?,?,?,?,?)').bind(crypto.randomUUID(),admin.userId,b.action,target,reason,details,now));
    const results=await db.batch(statements);
    if(!results[0].meta.changes)return json({error:'No change was made. The item may already be resolved, missing, or the credit adjustment would make its balance negative.'},409);
    return json(await overview(db));
  } catch (e) {
    if (e instanceof z.ZodError) return json({ error: e.issues[0]?.message || 'Invalid request.' }, 400);
    const err=e as Error&{status?:number;retryAfter?:number};if(err.status)return Response.json({error:err.message},{status:err.status,headers:{'Cache-Control':'no-store',...(err.retryAfter?{'Retry-After':String(err.retryAfter)}:{})}});
    console.error('Admin write:', e);
    return json({ error: 'Could not complete that admin action.' }, 503);
  }
}
