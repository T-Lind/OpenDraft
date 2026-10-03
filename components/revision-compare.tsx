'use client';
import {useMemo,useState} from 'react';
import {GitCompareArrows} from 'lucide-react';
import {Button} from './ui/button';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from './ui/dialog';
import {usePagedList,PageMore} from './paged-list';
import {useJson} from '@/hooks/use-community';
import {revisionDiff} from '@/lib/revision-diff';
import {inlineRuns} from '@/lib/manuscript';
import type {Work,Review} from '@/app/data';
type Version={id:string;title:string;version:number;createdAt:number;status:string;reviews:number};
function InlineText({text}:{text:string}){return <>{inlineRuns(text).map((run,i)=><span key={i} style={{fontWeight:run.style==='strong'?700:undefined,fontStyle:run.style==='em'?'italic':undefined,textDecoration:run.style==='u'?'underline':undefined}}>{run.text}</span>)}</>;}
function VersionFeedback({id,label}:{id:string;label:string}){
 const page=usePagedList<Review>('/api/workshop?collection=reviews&id='+encodeURIComponent(id));
 return <section><h3>{label} feedback</h3>{page.items.map(r=><article key={r.id} className="revision-feedback"><b>{r.author}</b>{[r.overall,r.strengths,r.suggestions].filter(Boolean).map((text,i)=><p key={i}><InlineText text={text}/></p>)}</article>)}{!page.loading&&!page.error&&!page.items.length&&<p className="fine-print">No feedback visible for this version.</p>}<PageMore page={page} label="More version feedback"/></section>;
}
export function RevisionCompare({work}:{work:Work}){
 const [open,setOpen]=useState(false),[left,setLeft]=useState(work.revisionOf||''),[right,setRight]=useState(work.id),[showSame,setShowSame]=useState(false);
 const versions=usePagedList<Version>('/api/community?section=revisions&id='+encodeURIComponent(work.id),open);
 const l=left||versions.items.find(v=>v.id!==right)?.id||'';
 const comparison=useJson<{left:Work;right:Work}>('/api/community?section=compare&left='+encodeURIComponent(l)+'&right='+encodeURIComponent(right),open&&!!l&&l!==right);
 const diff=useMemo(()=>comparison.data?revisionDiff(comparison.data.left.content,comparison.data.right.content):[],[comparison.data]);
 return <><Button variant="outline" onClick={()=>setOpen(true)}><GitCompareArrows size={14}/>Compare versions</Button><Dialog open={open} onOpenChange={setOpen}><DialogContent className="revision-dialog"><DialogTitle>Compare revisions</DialogTitle><DialogDescription>Saved manuscript differences and the feedback on each version. Unsaved editor changes are not included. Private versions remain private.</DialogDescription><div className="revision-selectors"><label>Earlier version<select className="form-select" value={l} onChange={e=>setLeft(e.target.value)}>{versions.items.map(v=><option key={v.id} value={v.id}>v{v.version} · {v.title} · {v.status} · {new Date(v.createdAt).toLocaleDateString()}</option>)}</select></label><label>Later version<select className="form-select" value={right} onChange={e=>setRight(e.target.value)}>{versions.items.map(v=><option key={v.id} value={v.id}>v{v.version} · {v.title} · {v.status} · {new Date(v.createdAt).toLocaleDateString()}</option>)}</select></label></div><PageMore page={versions} label="More versions"/>{!versions.loading&&!versions.error&&versions.items.length<2&&<p className="fine-print">This work has one saved version. Use New revision in Your writing to create a linked draft.</p>}{l===right&&<p className="fine-print">Choose two different versions.</p>}{comparison.error&&<p className="form-error" role="alert">{comparison.error}</p>}{comparison.loading&&open&&l&&l!==right&&<p role="status">Comparing saved versions…</p>}{comparison.data&&l!==right&&<><label className="settings-check"><input type="checkbox" checked={showSame} onChange={e=>setShowSame(e.target.checked)}/>Include unchanged paragraphs</label><p className="fine-print"><span className="diff-key removed">− Earlier text</span> · <span className="diff-key added">+ Later text</span></p><div className="revision-manuscript">{diff.filter(p=>showSame||p.kind!=='same').map((p,i)=><p className={'diff-paragraph '+p.kind} key={i}><span className="diff-marker" aria-label={p.kind}>{p.kind==='added'?'+':p.kind==='removed'?'−':' '}</span><InlineText text={p.text}/></p>)}{diff.every(p=>p.kind==='same')&&!showSame&&<p className="fine-print">The saved manuscript text is unchanged.</p>}</div><div className="revision-feedback-grid"><VersionFeedback key={l} id={l} label={'v'+comparison.data.left.version}/><VersionFeedback key={right} id={right} label={'v'+comparison.data.right.version}/></div></>}</DialogContent></Dialog></>;
}
