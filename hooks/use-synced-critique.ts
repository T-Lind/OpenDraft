'use client';
import {useEffect,useRef,useState} from 'react';
import {critiqueDraftInput,type CritiqueDraft} from '@/lib/critique-quality';
import {cleanCritiqueDraft} from './use-auto-critique-check';
type Saved={content:CritiqueDraft;updatedAt:number};
const hasText=(d:CritiqueDraft)=>!!(d.overall||d.strengths||d.suggestions||d.annotations.length);
export function useSyncedCritique(workId:string,version:number,enabled:boolean,draft:CritiqueDraft,onRestore:(draft:CritiqueDraft)=>void){
 const payload=JSON.stringify(critiqueDraftInput.parse(cleanCritiqueDraft(draft)));
 const latest=useRef({payload,draft,onRestore}),stamp=useRef(0),saved=useRef(''),ready=useRef(false),saving=useRef(false);
 const [remote,setRemote]=useState<Saved|null>(null),[status,setStatus]=useState('Checking your saved critique…'),[retry,setRetry]=useState(0),[generation,setGeneration]=useState(0);
 useEffect(()=>{latest.current={payload,draft,onRestore};},[payload,draft,onRestore]);
 useEffect(()=>{if(!enabled)return;const c=new AbortController();ready.current=false;
  fetch('/api/workspace?section=drafts&workId='+encodeURIComponent(workId)+'&version='+version,{signal:c.signal}).then(async r=>{const d=await r.json() as {draft:Saved|null;error?:string};if(!r.ok)throw new Error(d.error);if(c.signal.aborted)return;const row=d.draft as Saved|null;stamp.current=row?.updatedAt||0;
   if(row&&hasText(latest.current.draft)&&latest.current.payload!==JSON.stringify(row.content)){setRemote(row);setStatus('A different saved copy needs your choice. Browser changes are preserved.');return;}
   if(row){saved.current=JSON.stringify(row.content);latest.current.onRestore(row.content);}else saved.current='';ready.current=true;setRemote(null);setStatus(row?'Saved privately across devices':'Browser copy ready to sync');setGeneration(n=>n+1);
  }).catch(e=>{if(!c.signal.aborted)setStatus(e.message+' Browser copy preserved.');});return()=>c.abort();
 },[workId,version,enabled,retry]);
 useEffect(()=>{if(!enabled||!ready.current||remote||saved.current===payload||(!hasText(JSON.parse(payload))&&stamp.current===0))return;let disposed=false;const c=new AbortController();const timer=setTimeout(async()=>{if(saving.current||!ready.current)return;saving.current=true;setStatus('Syncing critique privately…');try{const r=await fetch('/api/workspace',{method:'POST',signal:c.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'saveCritiqueDraft',workId,version,draft:JSON.parse(payload),expectedUpdatedAt:stamp.current})});const d=await r.json() as {updatedAt:number;error?:string};if(!r.ok){if(r.status===409){ready.current=false;setRetry(n=>n+1);}throw new Error(d.error);}if(!disposed){stamp.current=d.updatedAt;saved.current=payload;setStatus('Saved privately across devices');window.dispatchEvent(new Event('opendraft:critique-drafts'));}}catch(e){if(!disposed)setStatus((e as Error).message+' Browser copy preserved.');}finally{saving.current=false;}},1200);return()=>{disposed=true;clearTimeout(timer);c.abort();};
 },[payload,workId,version,enabled,remote,generation]);
 const choose=(useRemote:boolean)=>{if(!remote)return;stamp.current=remote.updatedAt;if(useRemote){saved.current=JSON.stringify(remote.content);latest.current.onRestore(remote.content);}else saved.current='';ready.current=true;setRemote(null);setStatus('Browser copy ready to sync');setGeneration(n=>n+1);};
 return {remote,status,choose,retry:()=>{saved.current='';setRetry(n=>n+1);},pause:()=>{ready.current=false;}};
}
