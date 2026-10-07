'use client';
import {useState} from 'react';
import {usePagedList,PageMore} from './paged-list';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from './ui/dialog';
import type {Work} from '@/app/data';
type Part={id:string;title:string;partNumber:number;status:string};
export function WorkParts({work,onRead}:{work:Work;onRead:(id:string)=>void}){
  const page=usePagedList<Part>('/api/workshop?collection=parts&id='+encodeURIComponent(work.id),!!work.largerWork);
  if(!work.largerWork)return null;
  return <section className="panel-card work-parts"><h2>{work.largerWork}</h2><p className="fine-print">Chapter / part {work.partNumber||1} · each post is reviewed separately</p><ol>{page.items.map(part=><li key={part.id}>{part.id===work.id?<strong aria-current="page">{part.partNumber}. {part.title}</strong>:part.status==='draft'?<span>{part.partNumber}. {part.title} · private draft</span>:<button type="button" className="text-link" onClick={()=>onRead(part.id)}>{part.partNumber}. {part.title}</button>}</li>)}</ol><PageMore page={page} label="More chapters"/></section>;
}
export function AttachWork({work,act,busy}:{work:Work;act:(body:Record<string,unknown>,message?:string)=>Promise<boolean>;busy:boolean}){
  const [open,setOpen]=useState(false),[title,setTitle]=useState(work.largerWork||''),[part,setPart]=useState(work.partNumber||1);
  return <><button className="row-action" type="button" onClick={()=>setOpen(true)}>Attach to larger work</button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Attach this post to a larger work</DialogTitle><DialogDescription>Use the same novel or collection title for each chapter. Leave it blank to detach this post.</DialogDescription></DialogHeader><label className="field-label">Larger work<Input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field-label">Chapter or part number<Input type="number" min={1} max={10000} value={part} onChange={e=>setPart(Number(e.target.value)||1)}/></label><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy||part<1||part>10000} onClick={async()=>{if(await act({action:'attachWork',workId:work.id,largerWork:title,partNumber:part},'Post grouping saved.'))setOpen(false);}}>Save grouping</Button></DialogFooter></DialogContent></Dialog></>;
}
