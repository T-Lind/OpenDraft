'use client';
import {useEffect,useState} from 'react';
import type {Work} from '@/app/data';
type Task={workId:string;title:string};
export function NextSteps({works,uid,revision,onRead,onCritique,onEdit}:{works:Work[];uid:string;revision:number;onRead:(id:string)=>void;onCritique:(id:string)=>void;onEdit:(work:Work)=>void}){
 const [drafts,setDrafts]=useState<Task[]>([]),[updates,setUpdates]=useState<Task[]>([]);
 useEffect(()=>{if(!uid)return;const c=new AbortController();Promise.all([fetch('/api/workspace?section=drafts',{signal:c.signal}).then(r=>r.ok?r.json() as Promise<{items:Array<Task&{status:string}>}>:null),fetch('/api/work-updates?limit=10',{signal:c.signal}).then(r=>r.ok?r.json() as Promise<{items:Array<{readAt:number|null;targetWorkId:string;targetTitle:string}>}>:null)]).then(([d,u])=>{if(!c.signal.aborted){setDrafts((d?.items||[]).filter((item:{status:string})=>item.status!=='withdrawn').slice(0,3));setUpdates((u?.items||[]).filter((item:{readAt:number|null})=>!item.readAt).slice(0,3).map((item:{targetWorkId:string;targetTitle:string})=>({workId:item.targetWorkId,title:item.targetTitle})));}}).catch(()=>{});return()=>c.abort();},[uid,revision]);
 const writing=works.filter(w=>w.status==='draft').slice(0,2);
 if(!drafts.length&&!updates.length&&!writing.length)return null;
 return <section className="next-steps" aria-label="Pick up where you left off"><h2 className="section-title">Pick up where you left off</h2><div className="next-step-grid">{drafts.map(d=><button key={'critique'+d.workId} className="next-step" onClick={()=>onCritique(d.workId)}><span>Finish your critique</span><strong>{d.title}</strong></button>)}{updates.map((d,i)=><button key={'update'+d.workId+i} className="next-step" onClick={()=>onRead(d.workId)}><span>Read a new work update</span><strong>{d.title}</strong></button>)}{writing.map(w=><button key={w.id} className="next-step" onClick={()=>onEdit(w)}><span>Continue your draft</span><strong>{w.title||'Untitled draft'}</strong></button>)}</div></section>;
}
