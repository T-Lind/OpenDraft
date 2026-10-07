'use client';
import {useEffect,useState} from 'react';
import {Button} from './ui/button';
type Draft={key:string;workId:string;title:string;version:number;updatedAt:number};
export function CritiqueDrafts({uid,onRead}:{uid:string;onRead:(id:string)=>void}){
  const [drafts,setDrafts]=useState<Draft[]>([]);
  useEffect(()=>{
    const found:Draft[]=[];
    try{for(let i=0;i<localStorage.length&&found.length<100;i++){
      const key=localStorage.key(i);if(!key?.startsWith('opendraft:temporary-critique:')||!key.includes(':'+uid+':')||key.endsWith(':reading'))continue;
      const value=JSON.parse(localStorage.getItem(key)||'null');if(value&&typeof value.workId==='string'&&typeof value.title==='string'&&key==='opendraft:temporary-critique:'+value.workId+':'+uid+':'+value.version&&(value.overall||value.strengths||value.suggestions||value.annotations?.length))found.push({key,workId:value.workId,title:value.title,version:value.version,updatedAt:value.updatedAt});
    }}catch{/* Storage unavailable; keep server history usable. */}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read this account's browser drafts after hydration.
    setDrafts(found.sort((a,b)=>b.updatedAt-a.updatedAt));
  },[uid]);
  if(!drafts.length)return null;
  return <section className="panel-card"><h2>Saved critique drafts</h2><p className="fine-print">Private copies on this browser. Credits are checked when you share; works outside the reading room earn zero. Withdrawn writing may no longer be available.</p>{drafts.map(draft=><article className="draft-save-status" key={draft.key}><span>{draft.title} · version {draft.version}</span><Button variant="outline" onClick={()=>onRead(draft.workId)}>Continue critique</Button><Button variant="ghost" onClick={()=>{try{localStorage.removeItem(draft.key);localStorage.removeItem(draft.key+':reading');sessionStorage.removeItem(draft.key);setDrafts(current=>current.filter(d=>d.key!==draft.key));}catch{/* keep the draft visible */}}}>Discard</Button></article>)}</section>;
}
