import type {Database} from '@/db/storage';
const DAY=86400000;
export type QueueRates={observedMs:number;promotions:number;completions:number;completedTargets:number;roomSlots:number};
export type QueueForecast={lowMs:number;highMs:number;promotionsPerDay:number;completionsPerDay:number}|null;
// A throughput estimate, not a promised deadline. Both stages need recent evidence.
export function estimateCompletion(position:number,remaining:number,rates:QueueRates):QueueForecast {
 if(!Number.isFinite(position)||position<1||remaining<1||rates.promotions<3||rates.completions<3||rates.observedMs<DAY||rates.completedTargets<1)return null;
 const queueMs=position*rates.observedMs/rates.promotions;
 const roomMs=Math.max(1,rates.roomSlots)*rates.observedMs*remaining/rates.completedTargets;
 const expected=queueMs+roomMs;
 return {lowMs:Math.round(expected*.5),highMs:Math.round(expected*2),promotionsPerDay:rates.promotions*DAY/rates.observedMs,completionsPerDay:rates.completions*DAY/rates.observedMs};
}
export async function queueForecasts(db:Database,rows:Record<string,unknown>[],now=Date.now()) {
 const queued=rows.filter(w=>w.status==='queued');if(!queued.length)return rows;
 const genres=[...new Set(queued.map(w=>String(w.genre)))];
 const start=await db.prepare("SELECT value FROM settings WHERE id='queue-observation-start'").first<{value:string}>();
 const observedMs=Math.min(30*DAY,Math.max(0,now-Number(start?.value||now)));
 const stats=(await db.prepare(`SELECT g.genre,COUNT(*) FILTER(WHERE e.kind='promoted')::int AS promotions,COUNT(*) FILTER(WHERE e.kind='completed')::int AS completions,COALESCE(SUM(e.target_reviews) FILTER(WHERE e.kind='completed'),0)::int AS targets,(SELECT COUNT(*)::int FROM works w WHERE w.genre=g.genre AND w.status='spotlight' AND w.author_id NOT LIKE 'sample-%') AS slots FROM (SELECT unnest(ARRAY[${genres.map(()=>'?').join(',')}]::text[]) AS genre) g LEFT JOIN work_flow_events e ON e.genre=g.genre AND e.created_at>=? GROUP BY g.genre`).bind(...genres,now-30*DAY).all()).results;
 const byGenre=new Map(stats.map(s=>[s.genre,s]));
 return rows.map(w=>{if(w.status!=='queued')return w;const s=byGenre.get(w.genre);return {...w,completionForecast:s?estimateCompletion(Number(w.queuePosition),Math.max(0,Number(w.targetReviews||2)-Number(w.reviews||0)),{observedMs,promotions:Number(s.promotions),completions:Number(s.completions),completedTargets:Number(s.targets),roomSlots:Number(s.slots)}):null};});
}
