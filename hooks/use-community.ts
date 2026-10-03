'use client';
import {useCallback,useEffect,useState} from 'react';
export async function communityAction<T extends object=Record<string,unknown>>(body:Record<string,unknown>){
 const r=await fetch('/api/community',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
 const data=await r.json() as T&{error?:string};if(!r.ok)throw new Error(data.error||'This action could not complete.');return data;
}
export function useJson<T>(url:string,enabled=true){
 const [state,setState]=useState<{key:string;data:T|null;error:string;loading:boolean}>({key:'',data:null,error:'',loading:false});
 const [revision,setRevision]=useState(0);
 const refresh=useCallback(()=>setRevision(n=>n+1),[]);
 useEffect(()=>{
  if(!enabled)return;
  const controller=new AbortController();
  const read=async()=>{try{const r=await fetch(url,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(20000)])});const data=await r.json() as T&{error?:string};if(!r.ok)throw new Error(data.error||'This information could not load.');if(!controller.signal.aborted)setState({key:url,data,error:'',loading:false});}catch(e){if(!controller.signal.aborted)setState({key:url,data:null,error:(e as Error).message,loading:false});}};
  void read();return()=>controller.abort();
 },[url,enabled,revision]);
 return {...(state.key===url?state:{data:null,error:'',loading:enabled}),refresh};
}
