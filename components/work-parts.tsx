'use client';
import {useState} from 'react';
import {useJson} from '@/hooks/use-community';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from './ui/dialog';
import type {Work} from '@/app/data';
type Part={id:string;title:string;partNumber:number;status:string};
export function WorkParts({work,onRead}:{work:Work;onRead:(id:string)=>void}){
 const page=useJson<{group:{title:string};parts:Part[]}>('/api/workspace?section=largerWork&id='+encodeURIComponent(work.largerWorkId||''),!!work.largerWorkId);
 if(!work.largerWork)return null;
 const byNumber=new Map<number,Part>();for(const part of page.data?.parts||[]){if(!byNumber.has(part.partNumber)||(byNumber.get(part.partNumber)?.status==='draft'&&part.status!=='draft'))byNumber.set(part.partNumber,part);}
 const parts=[...byNumber.values()].sort((a,b)=>a.partNumber-b.partNumber),previous=parts.filter(p=>p.partNumber<(work.partNumber||1)).at(-1),next=parts.find(p=>p.partNumber>(work.partNumber||1));
 return <section className="panel-card work-parts"><h2>{work.largerWorkId?<a className="text-link" href={'#larger/'+work.largerWorkId}>{page.data?.group.title||work.largerWork}</a>:work.largerWork}</h2><p className="fine-print">Chapter / part {work.partNumber||1} · each post is reviewed separately</p><div className="chapter-navigation">{previous&&<Button variant="outline" onClick={()=>onRead(previous.id)}>← Previous chapter</Button>}{next&&<Button variant="outline" onClick={()=>onRead(next.id)}>Next chapter →</Button>}{work.largerWorkId&&<a className="text-link" href={'#larger/'+work.largerWorkId}>All chapters &amp; synopsis</a>}</div>{page.error&&<p className="form-error" role="alert">{page.error}</p>}</section>;
}
export function AttachWork({work,act,busy}:{work:Work;act:(body:Record<string,unknown>,message?:string)=>Promise<boolean>;busy:boolean}){
 const [open,setOpen]=useState(false),[title,setTitle]=useState(work.largerWork||''),[part,setPart]=useState(work.partNumber||1);
 return <><button className="row-action" type="button" onClick={()=>{setTitle(work.largerWork||'');setPart(work.partNumber||1);setOpen(true);}}>Attach to larger work</button><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Attach this post to a larger work</DialogTitle><DialogDescription>Use the same novel or collection title for each chapter. Leave it blank to detach this post. Rename the whole collection from its larger-work page.</DialogDescription></DialogHeader><label className="field-label">Larger work<Input maxLength={120} value={title} onChange={e=>setTitle(e.target.value)}/></label><label className="field-label">Chapter or part number<Input type="number" min={1} max={10000} value={part} onChange={e=>setPart(Number(e.target.value)||1)}/></label><DialogFooter><Button variant="outline" onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={busy||part<1||part>10000} onClick={async()=>{if(await act({action:'attachWork',workId:work.id,largerWork:title,partNumber:part},'Post grouping saved.'))setOpen(false);}}>Save grouping</Button></DialogFooter></DialogContent></Dialog></>;
}
