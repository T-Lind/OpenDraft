import { database } from '@/db/storage';
import { queryCollection } from '@/lib/workshop-query';

export const dynamic = 'force-dynamic';

type Row = Record<string, unknown>;

function camel(row: Row): Row {
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k.replace(/_([a-z])/g, (_, c) => c.toUpperCase()), v]));
}

export async function GET(request: Request) {
  try {
    const id = (new URL(request.url).searchParams.get('id') || '').trim().slice(0, 100);
    if (!id) return Response.json({ error: 'A writer id is required.' }, { status: 400 });
    const db = database();
    const params=new URL(request.url).searchParams;
    if(params.has('section')){const section=params.get('section');if(!['works','circles'].includes(section||''))return Response.json({error:'Unknown profile section.'},{status:400});params.set('collection',section||'works');params.set('author',id);params.set('mode','explore');return Response.json(await queryCollection(db,'',params),{headers:{'Cache-Control':'no-store'}});}
    const results = await db.read([
      db.prepare('SELECT id, name, bio, credits, created_at, age, sex, location, interests, current_streak, longest_streak, avatar_updated_at FROM profiles WHERE id=? AND onboarding_completed=true AND deleted_at=0').bind(id),
      db.prepare("SELECT w.id, w.title, w.author, w.genre, w.kind, w.stage, w.words, w.status, w.created_at, (SELECT COUNT(*) FROM reviews r WHERE r.work_id=w.id AND r.version=w.version) AS reviews FROM works w WHERE w.author_id=? AND w.status NOT IN ('draft','withdrawn') ORDER BY w.created_at DESC,w.id DESC LIMIT 20").bind(id),
      db.prepare('SELECT COUNT(*) AS given, COALESCE(SUM(helpful),0) AS helpful FROM reviews WHERE user_id=?').bind(id),
      db.prepare('SELECT c.id, c.name, c.description, c.genre, (SELECT COUNT(*) FROM memberships m WHERE m.circle_id=c.id) AS members FROM circles c JOIN memberships m ON m.circle_id=c.id WHERE m.user_id=? ORDER BY c.name,c.id LIMIT 20').bind(id),
      db.prepare("SELECT COUNT(*)::int AS works,COALESCE(SUM(words),0)::int AS words FROM works WHERE author_id=? AND status NOT IN ('draft','withdrawn')").bind(id),
    ]);
    const profileRow = results[0].results[0];
    const works = results[1].results.map(camel);
    if (!profileRow && !works.length) return Response.json({ error: 'That writer could not be found.' }, { status: 404 });
    const given = Number(results[2].results[0]?.given || 0);
    const helpful = Number(results[2].results[0]?.helpful || 0);
    const circles = results[3].results.map(camel);
    const profile = profileRow ? camel(profileRow) : { id, name: works[0]?.author || 'A writer', bio: '', age: null, sex: '', location: '', interests: '', credits: 0, createdAt: 0 };
    if (!profile.name && works[0]?.author) profile.name = works[0].author;
    return Response.json({
      profile,
      stats: { works: Number(results[4].results[0]?.works||0), words:Number(results[4].results[0]?.words||0), critiquesGiven: given, helpfulReceived: helpful, readers: 0,currentStreak:Number(profile.currentStreak||0),longestStreak:Number(profile.longestStreak||0) },
      works,
      circles,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    if((e as {status?:number}).status)return Response.json({error:(e as Error).message},{status:(e as {status:number}).status});
    console.error('Author error:', e);
    return Response.json({ error: 'This profile is unavailable right now.' }, { status: 503 });
  }
}
