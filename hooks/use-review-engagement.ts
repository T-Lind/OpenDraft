'use client';
import {useEffect,useRef,useState,type RefObject} from 'react';
import {engagementTick,engagementInput,manuscriptParagraphs,REGION_COUNT,type Engagement} from '@/lib/critique-quality';

export function useReviewEngagement(key:string,version:number,content:string,root:RefObject<HTMLElement|null>,record=true) {
  const [session,setSession] = useState<{key:string;summary:Engagement}|null>(null);
  const current = session?.key===key ? session.summary : null;
  const live = useRef<Engagement|null>(null);
  const enabled = !!current;
  useEffect(()=>{
    if(!record)return;
    let summary:Engagement={consent:true,version,activeMs:0,readingMs:0,regionsMs:Array(REGION_COUNT).fill(0)};
    try { const stored=engagementInput.safeParse(JSON.parse(localStorage.getItem(key+':reading')||'null'));if(stored.success&&stored.data.version===version)summary=stored.data; }catch{/* Start fresh if recovery is unavailable. */}
    live.current=summary;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore this version's browser reading checks.
    setSession({key,summary});
  },[key,version,record]);
  useEffect(()=>{
    if(!enabled||!record) {live.current=null;return;}
    live.current=current;
    const paragraphs = manuscriptParagraphs(content), total=paragraphs.reduce((n,p)=>n+p.words,0);
    let last=performance.now(), activity=last;
    const touch=()=>{activity=performance.now();};
    const events=['pointerdown','keydown','scroll','touchstart'] as const;
    events.forEach(e=>window.addEventListener(e,touch,{passive:true,capture:true}));
    const timer=window.setInterval(()=>{
      const now=performance.now(),elapsed=now-last;last=now;
      const regions=new Set<number>();
      root.current?.querySelectorAll<HTMLElement>('p[data-para]').forEach(element=>{
        const p=paragraphs[Number(element.dataset.para)],rect=element.getBoundingClientRect();
        const top=Math.max(rect.top,0),bottom=Math.min(rect.bottom,window.innerHeight);
        if(!p||!total||rect.height<=0||bottom-top<Math.min(40,rect.height*.5))return;
        // Coarse word regions approximate the visible part of long paragraphs.
        const first=p.startWord+p.words*(top-rect.top)/rect.height;
        const end=p.startWord+p.words*(bottom-rect.top)/rect.height;
        for(let i=Math.floor(first/total*REGION_COUNT);i<=Math.floor(Math.max(first,end-0.001)/total*REGION_COUNT);i++)regions.add(Math.min(REGION_COUNT-1,i));
      });
      if(live.current) {
        live.current=engagementTick(live.current,elapsed,document.visibilityState==='visible',document.hasFocus(),now-activity,[...regions]);
        setSession({key,summary:live.current});
        try{localStorage.setItem(key+':reading',JSON.stringify(live.current));}catch{/* Draft submission remains available without credits. */}
      }
    },1000);
    return()=>{clearInterval(timer);events.forEach(e=>window.removeEventListener(e,touch,true));live.current=null;};
  // The live ref owns ticks; restarting on every summary update would lose time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[enabled,key,content,root,record]);
  const start=()=>{const summary:Engagement={consent:true,version,activeMs:0,readingMs:0,regionsMs:Array(REGION_COUNT).fill(0)};live.current=summary;setSession({key,summary});};
  const clear=()=>{live.current=null;setSession(null);try{localStorage.removeItem(key+':reading');}catch{/* ignore */}};
  return {summary:current,start,clear};
}
