'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { Button } from './ui/button';
type Page<T>={items:T[];nextCursor:string|null};
export function usePagedList<T extends {id:string}>(url:string,enabled=true,revision=0){
 const [state,setState]=useState<Page<T>&{key:string;loading:boolean;error:string}>({items:[],nextCursor:null,key:'',loading:false,error:''});
 const controller=useRef<AbortController|null>(null);
 const key=url+':'+revision;
 const read=useCallback(async(cursor:string|null=null)=>{
  controller.current?.abort();const request=new AbortController();controller.current=request;
  setState(old=>({items:cursor?old.items:[],nextCursor:cursor?old.nextCursor:null,key,loading:true,error:''}));
  try{const response=await fetch(url+(cursor?'&cursor='+encodeURIComponent(cursor):''),{cache:'no-store',signal:request.signal});const page=await response.json() as Page<T>&{error?:string};if(!response.ok)throw new Error(page.error||'This list could not load.');
   if(!request.signal.aborted)setState(old=>({key,items:cursor?[...old.items,...page.items.filter(item=>!old.items.some(existing=>existing.id===item.id))]:page.items,nextCursor:page.nextCursor,loading:false,error:''}));
  }catch(error){if(!request.signal.aborted)setState(old=>({...old,key,loading:false,error:(error as Error).message}));}
 },[url,key]);
 useEffect(()=>{if(enabled)void read();return()=>controller.current?.abort();},[enabled,read]);
 const current=state.key===key?state:{items:[],nextCursor:null,loading:enabled,error:''};
 const refresh=useCallback(()=>void read(),[read]);
 const loadMore=useCallback(()=>void read(current.nextCursor),[read,current.nextCursor]);
 return {...current,loadMore,retry:refresh,refresh};
}
export function PageMore({page,label='Load more'}:{page:{loading:boolean;error:string;nextCursor:string|null;loadMore:()=>void;retry:()=>void};label?:string}){
 if(!page.loading&&!page.error&&!page.nextCursor)return null;
 return <div className="pagination-row" aria-live="polite">{page.error?<><span role="alert">{page.error}</span><Button variant="outline" onClick={page.retry}>Retry</Button></>:<Button variant="outline" disabled={page.loading} onClick={page.loadMore}>{page.loading?'Loading…':label}</Button>}</div>;
}
