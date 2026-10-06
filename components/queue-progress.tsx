import type {Work} from '@/app/data';
function duration(ms:number){const hours=Math.max(1,Math.round(ms/3600000));return hours<48?`${hours} hours`:`${Math.round(hours/24)} days`;}
export function QueueProgress({work}:{work:Work}) {
 if(work.status!=='queued')return null;
 const forecast=work.completionForecast;
 return <div className="queue-progress"><span>Queue {work.queuePosition?`#${work.queuePosition}`:'position updating'} in {work.genre}</span><span>{forecast?`Estimated ${duration(forecast.lowMs)}–${duration(forecast.highMs)} to all ${work.targetReviews||2} requested critiques`:'Completion estimate unavailable — not enough recent activity.'}</span>{forecast&&<small title={`${forecast.promotionsPerDay.toFixed(1)} works/day enter the reading room; ${forecast.completionsPerDay.toFixed(1)} works/day finish their requested critiques.`}>Based on recent {work.genre} activity · timing may change</small>}</div>;
}
