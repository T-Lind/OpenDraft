'use client';
import {Button} from './ui/button';
import {usePagedList,PageMore} from './paged-list';
import type {AutoCritiqueCheck} from '@/hooks/use-auto-critique-check';
import {inspectCritique,readingComplete,type CritiqueDraft,type Engagement,type QualityCheck} from '@/lib/critique-quality';

export function EngagementDetails({summary}:{summary:Engagement}) {
  const time=(ms:number)=>`${Math.floor(ms/60000)}m ${Math.floor(ms/1000)%60}s`;
  return <div className="review-pilot-metrics"><p>{time(summary.activeMs)} active in this tab · {time(summary.readingMs)} with manuscript visible</p><div className="review-region-map" aria-label="Observed manuscript regions">{summary.regionsMs.map((ms,i)=><span key={i} className={ms>=3000?'observed':ms?'glimpsed':''} title={`Region ${i+1}: ${time(ms)} visible`}><span className="sr-only">Region {i+1}: {time(ms)} visible</span></span>)}</div><p className="fine-print">{summary.regionsMs.filter(n=>n>=3000).length}/12 regions visible for at least 3 seconds. All regions must be green for credits. Visibility does not prove comprehension.</p></div>;
}
export function ReadingChecks({summary}:{summary:Engagement|null}) {
  return <section className="review-quality" aria-label="Reading checks"><strong>Reading checks</strong><p className="fine-print">Read each part of the manuscript carefully. OpenDraft checks focused manuscript visibility; all twelve regions must be green to earn credits. These checks cannot prove comprehension. You can always choose to share without credits.</p>{summary&&<EngagementDetails summary={summary}/>}<p role="status">{readingComplete(summary)?'All reading checks green.':'Read more carefully: some parts still need your attention.'}</p></section>;
}
export function QualityDetails({quality}:{quality:QualityCheck}) {
  return <div><p>{quality.anchoredNotes} anchored line notes · beginning {quality.distribution[0]}, middle {quality.distribution[1]}, ending {quality.distribution[2]}</p><p>{quality.redlines} proposed cuts/additions · {quality.repeatedSentences} repeated sentences</p><p className="fine-print">Distribution is by word position. Concentrated feedback can be appropriate; an even spread and longer comments do not prove quality. Rationale checks are simple wording/length hints, not a judgment of substance.</p>{quality.prompts.length>0&&<ul>{quality.prompts.map(p=><li key={p}>{p}</li>)}</ul>}</div>;
}
export function CritiqueQuality({content,draft,enabled,check}:{content:string;draft:CritiqueDraft;enabled:boolean;check:AutoCritiqueCheck}) {
  const quality=inspectCritique(content,draft),result=check.current?.result;
  const average=result?.credit.mean===null||result?.credit.mean===undefined?'—':Number(result.credit.mean.toFixed(4));
  const categories=['grounding','relevance','rationale','usefulness'];
  return <section className="critique-checks" aria-label="Critique quality checks"><div className="critique-score-grid">{categories.map(name=><div key={name} className={result?(result.scores[name]>=2?'check-green':'check-pending'):''}><span>{name[0].toUpperCase()+name.slice(1)}</span><strong>{result?.scores[name]?.toFixed(2)??'—'}<small> / 4</small></strong></div>)}</div><p className="fine-print" role="status">{check.current?.error||(!enabled?'Quality checks become available after you and the writer accept the workshop terms.':check.current?.busy?'Checking automatically…':check.waiting?'Checking after a pause in editing…':result?`${result.mock?'Simulated quality check · ':''}Average ${average}/4 · ${result.credit.eligible?'Quality requirement met; checked again when you share.':'Below the credit quality requirement. Revise, or share without credits.'}`:'OpenDraft checks automatically after 5 seconds without edits.')}</p><p className="critique-structure">Line notes: {quality.distribution[0]} beginning · {quality.distribution[1]} middle · {quality.distribution[2]} ending{quality.repeatedSentences?` · ${quality.repeatedSentences} repeated sentences`:''}</p>{quality.prompts.length>0&&<p className="fine-print">{quality.prompts.join(' ')}</p>}</section>;
}
type PilotRecord={id:string;author:string;workId:string;title:string;createdAt:number;evidence:string};
export function CritiquePilotReview({onRead}:{onRead:(id:string)=>void}) {
  const page=usePagedList<PilotRecord>('/api/admin?collection=critiquePilot');
  return <section className="dash-section"><h2 className="section-title">Private reading checks</h2><p className="fine-print">Private summaries accompany submitted critiques. Reading checks affect credit eligibility, but client-reported visibility cannot prove comprehension or intent. Review the work and actual critique before making a human judgment.</p><Button variant="outline" onClick={page.refresh}>Refresh reading checks</Button>{!page.loading&&!page.items.length&&<p className="fine-print">No shared reading summaries yet.</p>}{page.items.map(item=>{
    let evidence:{engagement:Engagement;quality:QualityCheck}|null=null;try{evidence=JSON.parse(item.evidence);}catch{/* Ignore malformed historical summaries. */}
    return <article className="community-case" key={item.id}><header><strong>{item.author} · {item.title}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></header>{evidence&&<><EngagementDetails summary={evidence.engagement}/><QualityDetails quality={evidence.quality}/></>}<Button variant="outline" onClick={()=>onRead(item.workId)}>Read work and feedback</Button><p className="fine-print">Critique reference {item.id}</p></article>;
  })}<PageMore page={page} label="More reading summaries"/></section>;
}
