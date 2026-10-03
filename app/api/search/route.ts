import { database } from '@/db/storage';
import { camel,workSearchVector,profileSearchVector,circleSearchVector,searchTerms,escapeLike } from '@/lib/workshop-query';
import { limitFor,pageOf,readCursor } from '@/lib/pagination';
import { requestRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const params=new URL(request.url).searchParams;
    const query=(params.get('q')||'').trim().slice(0,80);
    if(query.length<2)return Response.json({works:[],authors:[],circles:[]},{headers:{'Cache-Control':'no-store'}});
    await requestRateLimit(request,'search',90,60_000);
    const db=database(),terms=searchTerms(query),like='%'+escapeLike(query)+'%',prefix=escapeLike(query)+'%';
    const limit=limitFor(params,8,20),cursor=readCursor(params.get('cursor')),section=params.get('section');
    const recipients=params.get('recipient')==='1';
    const boundary=cursor?' WHERE (rank,id)<(?,?)':'';const after=cursor?[cursor.value,cursor.id]:[];
    const statements={
      works:db.prepare(`WITH matches AS (SELECT w.id,w.title,w.author,w.author_id,w.genre,w.kind,w.words,w.status,(SELECT COUNT(*) FROM reviews r WHERE r.work_id=w.id AND r.version=w.version)::int AS reviews,
        (CASE WHEN w.title ILIKE ? THEN 10 ELSE 0 END+CASE WHEN w.author ILIKE ? THEN 5 ELSE 0 END+ts_rank(${workSearchVector},to_tsquery('simple',?)))::float8 AS rank FROM works w WHERE w.status NOT IN ('draft','withdrawn') AND ${workSearchVector} @@ to_tsquery('simple',?)) SELECT * FROM matches${boundary} ORDER BY rank DESC,id DESC LIMIT ?`).bind(prefix,prefix,terms,terms,...after,limit+1),
      authors:db.prepare(`WITH matches AS (SELECT p.id,p.name,p.bio,p.location,p.interests,(CASE WHEN p.name ILIKE ? THEN 10 ELSE 0 END+ts_rank(${profileSearchVector},to_tsquery('simple',?)))::float8 AS rank FROM profiles p WHERE p.onboarding_completed=true AND p.deleted_at=0 AND ${profileSearchVector} @@ to_tsquery('simple',?)
        ${recipients?'':"UNION ALL SELECT DISTINCT w.author_id,w.author,''::text,''::text,''::text,1::float8 FROM works w WHERE w.author_id LIKE 'sample-%' AND w.status NOT IN ('draft','withdrawn') AND w.author ILIKE ?"}) SELECT * FROM matches${boundary} ORDER BY rank DESC,id DESC LIMIT ?`).bind(prefix,terms,terms,...(recipients?[]:[like]),...after,limit+1),
      circles:db.prepare(`WITH matches AS (SELECT c.id,c.name,c.description,c.genre,(SELECT COUNT(*) FROM memberships m WHERE m.circle_id=c.id)::int AS members,(CASE WHEN c.name ILIKE ? THEN 10 ELSE 0 END+ts_rank(${circleSearchVector},to_tsquery('simple',?)))::float8 AS rank FROM circles c WHERE ${circleSearchVector} @@ to_tsquery('simple',?)) SELECT * FROM matches${boundary} ORDER BY rank DESC,id DESC LIMIT ?`).bind(prefix,terms,terms,...after,limit+1),
    };
    if(section){if(!['works','authors','circles'].includes(section))throw Object.assign(new Error('Unknown search section.'),{status:400});const r=await statements[section as keyof typeof statements].all();const page=pageOf(r.results,limit,row=>Number(row.rank));return Response.json({...page,items:page.items.map(camel)},{headers:{'Cache-Control':'no-store'}});}
    const results=await db.read(recipients?[statements.authors]:[statements.works,statements.authors,statements.circles]);
    const data:Record<string,unknown>={works:[],authors:[],circles:[]},nextCursors:Record<string,string|null>={};
    for(const [i,key] of (recipients?['authors']:['works','authors','circles']).entries()){const page=pageOf(results[i].results,limit,row=>Number(row.rank));data[key]=page.items.map(camel);nextCursors[key]=page.nextCursor;}
    return Response.json({...data,nextCursors},{headers:{'Cache-Control':'no-store'}});
  } catch (e) {
    const error=e as Error&{status?:number;retryAfter?:number};return Response.json({error:error.status?error.message:'Search is unavailable right now.'},{status:error.status||503,headers:{'Cache-Control':'no-store',...(error.retryAfter?{'Retry-After':String(error.retryAfter)}:{})}});
  }
}
