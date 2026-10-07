'use client';
import {useEffect,useRef,useState} from 'react';
import type {CritiqueDraft} from '@/lib/critique-quality';
export const CRITIQUE_DEBOUNCE_MS=5000;
export const CRITIQUE_MIN_INTERVAL_MS=5000;
export function critiqueCheckDelay(now:number,lastStarted:number,retryAt=0){return Math.max(CRITIQUE_DEBOUNCE_MS,lastStarted?lastStarted+CRITIQUE_MIN_INTERVAL_MS-now:0,retryAt-now);}
export function cleanCritiqueDraft(draft:CritiqueDraft):CritiqueDraft{return {...draft,annotations:draft.annotations.map(({kind,quote,body,para,start,end})=>({kind,quote,body,para,start,end}))};}
type Assessment={scores:Record<string,number>;credit:{mean:number|null;eligible:boolean;policy:string};mock?:boolean};
export function useAutoCritiqueCheck(workId:string,version:number,draft:CritiqueDraft,enabled:boolean){
  const payload=JSON.stringify({workId,version,draft:cleanCritiqueDraft(draft)});
  const hasText=[draft.overall,draft.strengths,draft.suggestions,...draft.annotations.map(a=>a.body)].some(s=>s.trim());
  const [state,setState]=useState<{key:string;busy?:boolean;result?:Assessment;error?:string}|null>(null);
  const lastStarted=useRef(0),completed=useRef('');
  useEffect(()=>{
    if(!enabled||!hasText||completed.current===payload)return;
    let disposed=false,timer:ReturnType<typeof setTimeout>|undefined,controller:AbortController|undefined,retries=0,retryAt=0,running=false;
    const schedule=()=>{
      clearTimeout(timer);
      if(disposed||document.visibilityState!=='visible'||completed.current===payload)return;
      timer=setTimeout(()=>void run(),critiqueCheckDelay(Date.now(),lastStarted.current,retryAt));
    };
    const run=async()=>{
      if(disposed||running||document.visibilityState!=='visible'||completed.current===payload)return;
      running=true;lastStarted.current=Date.now();controller=new AbortController();
      setState({key:payload,busy:true});
      const deadline=setTimeout(()=>controller?.abort(),22000);
      try{
        const response=await fetch('/api/critique-check',{method:'POST',headers:{'Content-Type':'application/json'},signal:controller.signal,body:payload});
        const data=await response.json() as Assessment&{error?:string};
        if(disposed)return;
        if(!response.ok){
          setState({key:payload,error:data.error||'The quality check is unavailable. You can still share your critique.'});
          if(response.status===429||response.status>=500){
            const retry=Number(response.headers.get('Retry-After'));
            retryAt=Date.now()+Math.max(response.status===429?2000:60000,Number.isFinite(retry)&&retry>0?retry*1000:60000*2**retries);
            if(retries++<2)schedule();
          }
          return;
        }
        completed.current=payload;setState({key:payload,result:data});
      }catch(e){
        if(disposed)return;
        setState({key:payload,error:(e as Error).name==='AbortError'?'The quality check took too long. You can still share your critique.':'The quality check is unavailable. You can still share your critique.'});
        retryAt=Date.now()+60000*2**retries;if(retries++<2)schedule();
      }finally{running=false;clearTimeout(deadline);}
    };
    document.addEventListener('visibilitychange',schedule);schedule();
    return()=>{disposed=true;clearTimeout(timer);controller?.abort();document.removeEventListener('visibilitychange',schedule);};
  },[payload,enabled,hasText]);
  return {current:enabled&&state?.key===payload?state:null,waiting:enabled&&hasText&&state?.key!==payload};
}
export type AutoCritiqueCheck = ReturnType<typeof useAutoCritiqueCheck>;
