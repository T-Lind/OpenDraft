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
  return <section className="sheet critique-drafts" aria-labelledby="critique-drafts-title"><div className="sheet-head"><h2 id="critique-drafts-title">Saved critique drafts</h2></div><div className="sheet-body"><p className="fine-print">Private copies on this browser. Credits are checked when you share; works outside the reading room earn zero. Withdrawn writing may no longer be available.</p><div className="critique-draft-list">{drafts.map(draft=><article className="critique-draft-row" key={draft.key}><div className="critique-draft-copy"><strong>{draft.title}</strong><span className="fine-print">Version {draft.version}</span></div><div className="critique-draft-actions"><Button variant="outline" onClick={()=>onRead(draft.workId)}>Continue critique</Button><Button variant="ghost" onClick={()=>{try{localStorage.removeItem(draft.key);localStorage.removeItem(draft.key+':reading');sessionStorage.removeItem(draft.key);setDrafts(current=>current.filter(d=>d.key!==draft.key));}catch{/* keep the draft visible */}}}>Discard</Button></div></article>)}</div></div></section>;
}
