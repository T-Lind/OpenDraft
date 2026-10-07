'use client';
import {WorkParts} from '@/components/work-parts';
import {WorkReadingOptions} from '@/components/work-reading-options';
import {WorkUpdateFeed} from '@/components/work-update-feed';
import { useState, useEffect, useRef, useCallback, useMemo, type ReactNode } from 'react';
import { BookOpen, Feather, Sparkles, FileText, MessageSquare, Users, Bookmark, Clock, ChevronRight, ChevronDown, Plus, Check, ArrowLeft, Flag, Download, Upload,Maximize2, LoaderCircle, Star, Highlighter, Strikethrough, MessageSquarePlus, X, CornerDownLeft, MapPin, ListChecks, Bold, Italic, Underline, Search, Send, AlertTriangle, Flame, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogTitle, DialogDescription,DialogHeader,DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Kbd } from '@/components/ui/kbd';
import { Work, Review, Circle, genres, wordCount, workKinds, workStages, matureThemes, writingProcessOptions, writingProcessDescription, type WritingProcess, formatCredits, readingTimeLabel, WorkAnnotation, AnnotationKind, AuthorProfileData, WorkMessage, Analytics } from './data';
import type { Snapshot, Act } from './workshop';
import { Empty } from './workshop';
import { WriterAvatar } from '@/components/writer-avatar';
import { AvatarUpload } from '@/components/avatar-upload';
import { annotationHistory, editAnnotations, undoAnnotations, redoAnnotations, type AnnotationHistory } from '@/lib/annotation-history';
import { inlineRuns, inlineSlice, type InlineRun } from '@/lib/manuscript';
import { clipboardMarkup } from '@/lib/editor-html';
import { usePagedList,PageMore } from '@/components/paged-list';
import {AccountControls,FriendControls,CritiqueRating,ReviewerScore} from '@/components/community';
import {ShowcaseConsent} from '@/components/showcase';
import {RevisionCompare} from '@/components/revision-compare';
import {communityAction} from '@/hooks/use-community';
import { useDraftAutosave } from '@/hooks/use-draft-autosave';
import { ReadingSettings, useReadingPreferences, prefersReducedMotion } from '@/components/reading-preferences';
import { CritiqueReservation, useCritiqueReservation } from '@/components/critique-reservation';
import { CircleWorkshop } from '@/components/circle-workshop';
import { CircleMembers } from '@/components/circle-members';
import { ContentThemeCheck } from '@/components/content-theme-check';
import {QueueProgress} from '@/components/queue-progress';
import {CritiqueQuality} from '@/components/critique-quality';
import {useAutoCritiqueCheck} from '@/hooks/use-auto-critique-check';
import {MIN_CRITIQUE_WORDS,CRITIQUE_CREDIT_RULE} from '@/lib/critique-rubric';
import {TERMS_VERSION} from '@/lib/workshop-policy';
import {useReviewEngagement} from '@/hooks/use-review-engagement';
import {readingComplete} from '@/lib/critique-quality';

function FieldSelect({ label, value, options, change }: { label: string; value: string; options: string[]; change: (v: string) => void }) {
  return <label className="field-label">{label}<select className="form-select" value={value} onChange={e => change(e.target.value)}>{options.map(o => <option key={o}>{o}</option>)}</select></label>;
}

function WritingProcessField({ value, change }: { value?: WritingProcess; change: (value: WritingProcess) => void }) {
  const selected = value === 'ai-assisted' ? 'ai-collaborative' : value || 'not-declared';
  const option = writingProcessOptions.find(item => item.value === selected) || writingProcessOptions.at(-1)!;
  const level = selected === 'not-declared' ? 0 : Math.max(0, writingProcessOptions.findIndex(item => item.value === selected) + 1);
  return <label className="field-label writing-process-field">Writing process
    <select className="form-select" value={selected} onChange={event => change(event.target.value as WritingProcess)}>
      {writingProcessOptions.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}
    </select>
    <span className="process-scale-preview">
      <span className="process-scale-dots" aria-hidden="true">{[1, 2, 3, 4, 5].map(step => <i key={step} className={level > 0 && step <= level ? 'filled' : ''} />)}</span>
      <span>{option.description}</span>
    </span>
    <span className="field-hint">This is a process disclosure, not a quality score. Human writing is the workshop norm; AI-written work is discouraged, but honest disclosure is more useful than unreliable detection.</span>
  </label>;
}

/* ---------------------------------------------------------- Inline formatting */

function formatInline(text: string): ReactNode {
  return renderInlineRuns(inlineRuns(text));
}
function renderInlineRuns(runs: InlineRun[]): ReactNode {
  return runs.map((run, index) => run.style === 'strong' ? <strong key={index}>{run.text}</strong> : run.style === 'u' ? <u key={index}>{run.text}</u> : run.style === 'em' ? <em key={index}>{run.text}</em> : run.text);
}

/* ------------------------------------------------- Rich text manuscript input */

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function markersToHtml(text: string): string {
  return text.split(/\n{2,}/).map(paragraph => {
    let html = escapeHtml(paragraph)
      .replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_\n]+)__/g, '<u>$1</u>')
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    html = html.replace(/\n/g, '<br>');
    return '<p>' + html + '</p>';
  }).join('');
}

function serializeNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent || '').replace(/\u00a0/g, ' ');
  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  if (tag === 'br') return '\n';
  let inner = '';
  el.childNodes.forEach(child => { inner += serializeNode(child); });
  if (tag === 'strong' || tag === 'b') return inner ? `**${inner}**` : '';
  if (tag === 'em' || tag === 'i') return inner ? `*${inner}*` : '';
  if (tag === 'u') return inner ? `__${inner}__` : '';
  if (tag === 'p' || tag === 'div' || tag === 'li') return inner + '\n\n';
  return inner;
}

function htmlToMarkers(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  let out = '';
  doc.body.childNodes.forEach(node => { out += serializeNode(node); });
  return out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function RichTextEditor({ value, onChange, placeholder, ariaLabel, disabled=false }: { value: string; onChange: (v: string) => void; placeholder: string; ariaLabel: string; disabled?:boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string>('');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (document.activeElement !== el && value !== last.current) { el.innerHTML = markersToHtml(value); last.current = value; }
  }, [value]);
  useEffect(() => {
    const el = ref.current;
    if (el && last.current === '' && value) { el.innerHTML = markersToHtml(value); last.current = value; }
  }, [value]);
  const emit = () => { const markers = htmlToMarkers(ref.current?.innerHTML || ''); last.current = markers; onChange(markers); };
  const exec = (cmd: string) => { ref.current?.focus(); document.execCommand(cmd, false); emit(); };
  return (
    <div className="rich-editor">
      <div className="format-toolbar" role="toolbar" aria-label="Formatting">
        <button type="button" disabled={disabled} onClick={() => exec('bold')} title="Bold (Ctrl+B)" aria-label="Bold"><Bold size={14} /></button>
        <button type="button" disabled={disabled} onClick={() => exec('italic')} title="Italic (Ctrl+I)" aria-label="Italic"><Italic size={14} /></button>
        <button type="button" disabled={disabled} onClick={() => exec('underline')} title="Underline (Ctrl+U)" aria-label="Underline"><Underline size={14} /></button>
        <span className="format-hint">Rich text — select words and format them. No markers needed.</span>
      </div>
      <div ref={ref} className="manuscript-input rich-manuscript" contentEditable={!disabled} suppressContentEditableWarning spellCheck role="textbox" aria-multiline="true" aria-disabled={disabled} aria-label={ariaLabel} data-placeholder={placeholder} onInput={emit} onBlur={emit}
        onPaste={event => { event.preventDefault(); document.execCommand('insertHTML', false, clipboardMarkup(event.clipboardData, document)); emit(); }}
        onDrop={event => { event.preventDefault(); if (!event.dataTransfer.files.length) { ref.current?.focus(); document.execCommand('insertHTML', false, clipboardMarkup(event.dataTransfer, document)); emit(); } }} />
    </div>
  );
}

/* -------------------------------------------------------------------- Editor */

export function Editor({ initial, credits, act, busy, onDone, close, onSaved,revisionAnnotations=[] }: { initial: Work; credits: number; act: Act; busy: boolean; onDone: () => void; close: () => void; onSaved?:()=>void;revisionAnnotations?:WorkAnnotation[] }) {
  const [confirmPublish, setConfirmPublish] = useState(false), [leaving, setLeaving] = useState(false), [leaveAnyway, setLeaveAnyway] = useState(false);
  const [focusMode,setFocusMode]=useState(false),[responses,setResponses]=useState<Record<string,string>>({});
  const [toolNotice,setToolNotice]=useState('');
  const importRef=useRef<HTMLInputElement>(null);
  const draft = useDraftAutosave(initial, busy || leaving || confirmPublish, onSaved);
  const { work, update } = draft;
  const locked = busy || leaving;
  const count = wordCount(work.content);
  const valid = !!work.title.trim() && !!work.content.trim() && work.request.trim().length >= 5 && count <= 3500;
  const themes = (work.themes || '').split(',').map(s => s.trim()).filter(Boolean);
  const toggleTheme = (t: string) => { const set = new Set(themes); if (set.has(t)) set.delete(t); else set.add(t); update('themes', Array.from(set).join(', ')); };
  const cost = 5 + 2 * ((work.targetReviews || 2) - 2);
  const canAfford = credits >= cost;
  const save = async (publish: boolean) => {
    setLeaving(true);
    try { if (!await draft.flush()) { setConfirmPublish(false); return; }
      if (publish && await act({ action: 'publish', work: { ...work, words: count, mature: !!work.mature }, expectedSavedAt: draft.serverStamp() }, `Your writing is in the workshop. ${cost} credits spent.`)) { draft.published(); setConfirmPublish(false); onDone(); }
    } finally { setLeaving(false); }
  };
  const leave = async () => { setLeaving(true); try { if (await draft.flush()) close(); else setLeaveAnyway(true); } finally { setLeaving(false); } };
  const downloadDraft = () => {
    const text=[work.title||'Untitled draft',work.genre+' · '+work.kind+' · '+work.stage,'',work.content,'','Feedback requested: '+work.request,work.warning?'Content notes: '+work.warning:''].join('\n');
    const url=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const link=document.createElement('a');link.href=url;link.download=(work.title||'Untitled draft').replace(/[^\p{L}\p{N} _-]/gu,'').slice(0,80)+'.txt';document.body.appendChild(link);link.click();link.remove();setToolNotice(`Downloaded ${link.download}`);setTimeout(()=>URL.revokeObjectURL(url),1000);
  };
  const importDraft=async(file:File|undefined)=>{if(!file)return;setToolNotice('');if(!/\.(txt|md|markdown)$/i.test(file.name)){setToolNotice('Choose a .txt, .md, or .markdown file.');return;}if(file.size>250_000){setToolNotice('Choose a text or Markdown file under 250 KB.');return;}try{const text=await file.text();update('content',text);if(!work.title.trim())update('title',file.name.replace(/\.(txt|md|markdown)$/i,''));setToolNotice(`Imported ${file.name}. Review the draft before sharing.`);}catch{setToolNotice('That file could not be read. Try another text or Markdown file.');}finally{if(importRef.current)importRef.current.value='';}};
  const respond=async(note:WorkAnnotation,status:NonNullable<WorkAnnotation['writerStatus']>)=>{if(await act({action:'annotationResponse',annotationId:note.id,status,response:responses[note.id]||note.writerResponse||''},'Revision note updated.'))onSaved?.();};
  const status = !draft.backupAvailable&&draft.dirty&&draft.state!=='saving'?'Changes not saved yet · browser recovery unavailable':{ local:'Start writing — drafts save automatically', waiting:'Changes kept on this browser · sync pending', saving:'Saving privately…', saved:'Saved privately', offline:'Offline · changes kept on this browser', error:'Could not sync · local copy preserved', conflict:'Another saved version exists · local copy preserved' }[draft.state];
  return (
    <form className={'editor-form'+(focusMode?' focus-mode':'')} onSubmit={e => { e.preventDefault(); void save(false); }}>
      {draft.recovery && <div className="draft-recovery" role="status"><div><strong>Unsaved changes found on this browser</strong><p>“{draft.recovery.work.title || 'Untitled draft'}” · {new Date(draft.recovery.editedAt).toLocaleString()}. Restore them, or keep the saved version.</p></div><Button type="button" onClick={draft.restore}>Restore changes</Button><Button type="button" variant="outline" onClick={draft.discardRecovery}>Keep current draft</Button></div>}
      <div className="editor-tool-row"><Button type="button" variant="ghost" onClick={()=>setFocusMode(value=>!value)}><Maximize2 size={14}/>{focusMode?'Exit focus mode':'Focus mode'}</Button><input ref={importRef} hidden type="file" accept=".txt,.md,.markdown,text/plain,text/markdown" onChange={event=>void importDraft(event.target.files?.[0])}/><Button type="button" variant="ghost" onClick={()=>importRef.current?.click()}><Upload size={14}/>Import .txt or .md</Button><Button type="button" variant="ghost" onClick={downloadDraft}><Download size={14}/>Export</Button></div>
      {toolNotice&&<p className="editor-tool-notice" role="status">{toolNotice}</p>}
      <div className={'draft-save-status '+draft.state} role="status" aria-live="polite"><span>{draft.state==='saving'?<LoaderCircle size={14} className="animate-spin" />:draft.state==='saved'?<Check size={14}/>:<FileText size={14}/>} {status}</span>{draft.state==='saved'&&draft.savedAt>0&&<time dateTime={new Date(draft.savedAt).toISOString()}>Last saved {new Date(draft.savedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time>}</div>
      {draft.error && <div className="draft-save-error" role="alert"><p>{draft.error}</p>{draft.state==='conflict'?<Button type="button" variant="outline" onClick={() => setLeaveAnyway(true)}>Keep local copy &amp; reopen saved draft</Button>:<Button type="button" variant="outline" disabled={locked} onClick={() => void draft.retry()}>Retry save</Button>}<Button type="button" variant="outline" onClick={downloadDraft}>Download this draft</Button></div>}
      {!draft.backupAvailable && draft.dirty && <p className="form-error" role="alert">Browser recovery storage is unavailable. Keep this tab open until your draft saves.</p>}
      {!!initial.revisionOf&&<section className="revision-workspace"><div><p className="eyebrow">Writer-side revision loop</p><h2>Notes from the previous draft</h2><p>Keep feedback beside the draft and mark what you resolved. Reviewers do not see these private working statuses.</p></div>{revisionAnnotations.length?<div className="revision-note-list">{revisionAnnotations.map(note=><article className={'revision-note status-'+(note.writerStatus||'open')} key={note.id}><header><b>{note.kind==='comment'?'Comment':note.kind==='delete'?'Suggested cut':note.kind==='insert'?'Suggested addition':'Highlight'} · {note.author}</b><span className="tag">{(note.writerStatus||'open').replaceAll('-',' ')}</span></header>{note.quote&&<q>{note.quote}</q>}{note.body&&<p>{note.body}</p>}<Input aria-label={'Response to '+note.author} maxLength={500} placeholder="Private revision note (optional)" value={responses[note.id]??note.writerResponse??''} onChange={event=>setResponses(current=>({...current,[note.id]:event.target.value}))}/><div className="revision-note-actions"><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void respond(note,'open')}>Open</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void respond(note,'resolved')}>Resolved</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void respond(note,'kept')}>Keep as written</Button><Button type="button" size="sm" variant="outline" disabled={busy} onClick={()=>void respond(note,'not-this-draft')}>Not this draft</Button></div></article>)}</div>:<p className="fine-print">This version has no line notes yet. Broader critiques remain available in the comparison view.</p>}</section>}
      <fieldset className="editor-fields" disabled={locked || !!draft.recovery}>
      <label className="field-label">A title for your work<Input maxLength={120} autoFocus placeholder="Every story needs a beginning…" value={work.title} onChange={e => update('title', e.target.value)} /></label>
      <div className="form-grid"><label className="field-label">Larger work <span className="optional">(optional)</span><Input maxLength={120} placeholder="Novel or collection title" value={work.largerWork||''} onChange={e=>update('largerWork',e.target.value)}/></label><label className="field-label">Chapter or part number<Input type="number" min={1} max={10000} value={work.partNumber||1} onChange={e=>update('partNumber',Math.max(1,Math.min(10000,Number(e.target.value)||1)))}/></label></div><p className="fine-print">Use the same larger-work title to link your chapters in order. Each post has its own feedback and a 3,500-word limit.</p>
      <div className="field-label">Your writing
        <RichTextEditor value={work.content} disabled={locked || !!draft.recovery} onChange={v => update('content', v)} placeholder="The first sentence is a small act of courage." ariaLabel="Your writing" />
      </div>
      <div className={'word-meter ' + (count > 3500 ? 'over-limit' : '')}>
        <span>{count.toLocaleString()} / 3,500 words · {readingTimeLabel(count)}</span>
        <span>Private drafts are free. Nothing is published automatically.</span>
      </div>
      <label className="field-label">What would you like feedback on?<Textarea maxLength={800} placeholder="For example: Is the opening engaging? Does the dialogue feel natural?" value={work.request} onChange={e => update('request', e.target.value)} /></label>
      <details className="editor-settings"><summary>Submission settings <span>genre, visibility, content notes, and process</span></summary><div className="editor-settings-body"><div className="form-grid three">
        <FieldSelect label="Genre" value={work.genre} options={genres.slice(1)} change={v => update('genre', v)} />
        <FieldSelect label="Type of work" value={work.kind} options={workKinds} change={v => update('kind', v)} />
        <FieldSelect label="Draft stage" value={work.stage} options={workStages} change={v => update('stage', v)} />
      </div><label className="field-label">Notes for readers <span className="optional">(optional)</span><Input maxLength={300} placeholder="Other context about this work…" value={work.warning} onChange={e => update('warning', e.target.value)} /></label>
      <WritingProcessField value={work.aiProcess} change={value => update('aiProcess', value)} />
      <div className="mature-box">
        <label className="check-row"><input type="checkbox" checked={!!work.mature} onChange={e => update('mature', e.target.checked)} /><span><AlertTriangle size={13} /> Contains mature themes</span></label>
        {work.mature && (
          <div className="theme-checks">
            {matureThemes.map(t => <label key={t} className="check-chip"><input type="checkbox" checked={themes.includes(t)} onChange={() => toggleTheme(t)} />{t}</label>)}
          </div>
        )}
      </div>
      <div className="reviewers-box">
        <ContentThemeCheck content={work.content} selected={themes} apply={next=>{update('mature',true);update('themes',next.join(', '));}}/>
        <div className="form-grid">
          <FieldSelect label="Reviewers to request" value={String(work.targetReviews || 2)} options={['2', '3', '4', '5']} change={v => update('targetReviews', Number(v))} />
          <label className="field-label">Who can see the critiques
            <select className="form-select" value={work.critiqueVisibility || 'public'} onChange={e => update('critiqueVisibility', e.target.value)}>
              <option value="public">Everyone (public)</option>
              <option value="private">Only me (private)</option>
            </select>
          </label>
        </div>
        <p className="fine-print">Publishing costs <strong>{cost} credits</strong>. The first two reviewers are included; each extra reviewer adds 2 credits. A work leaves the reading room after {work.targetReviews || 2} critiques.</p>
      </div></div></details>
      <div className="editor-note"><Sparkles size={15} /><span>Publishing costs {cost} credits. Your work enters the fair, first-in-first-out reading room. Your balance: <strong>{formatCredits(credits)} credits.</strong></span></div>
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={() => void leave()}>Close editor</Button>
        <span className="disabled-wrap" title="Save this draft privately, even if it is unfinished. It costs nothing.">
          <Button variant="outline" type="submit" disabled={locked || !draft.dirty || draft.state==='conflict'}>{locked ? <LoaderCircle size={15} className="animate-spin" /> : <FileText size={15} />}Save now</Button>
        </span>
        <span className="disabled-wrap" title={!valid ? 'Add a title, some writing, and a feedback request before publishing.' : !canAfford ? `You have ${formatCredits(credits)} credits but need ${cost}. Critique another writer’s work to earn more.` : busy ? 'Publishing…' : `Publish to the reading room for ${cost} credits.`}>
          <Button type="button" className="primary-button" disabled={locked || !valid || !canAfford || draft.state==='conflict'} onClick={() => setConfirmPublish(true)}>Request {work.targetReviews||2} critiques · {cost} credits</Button>
        </span>
      </div>
      {!canAfford && <p className="fine-print">Sharing is grayed out because you have {formatCredits(credits)} of the {cost} credits needed. Your draft can stay private for free — critique other writing to earn publishing credits.</p>}
      {!valid && <p className="fine-print">Add a title, some writing, and a short note about the feedback you want before you can share.</p>}
      </fieldset>
      <Dialog open={confirmPublish} onOpenChange={open => {if(!locked)setConfirmPublish(open);}}>
        <DialogContent className="compact-dialog">
          <DialogTitle>Ready for fresh eyes?</DialogTitle>
          <DialogDescription>“{work.title}” will be visible to members of this workshop. {cost} credits will be deducted from your balance. You can withdraw it later.</DialogDescription>
          <div className="form-actions">
            <Button variant="outline" type="button" disabled={locked} onClick={() => setConfirmPublish(false)}>Keep editing</Button>
            <Button type="button" disabled={locked} onClick={() => void save(true)}>Publish writing</Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={leaveAnyway} onOpenChange={setLeaveAnyway}><DialogContent className="compact-dialog"><DialogTitle>Your changes haven’t synced</DialogTitle><DialogDescription>{draft.backupAvailable?'A recovery copy remains on this browser. Reopen this draft to compare it with the saved version. If you leave, these changes won’t be available on other devices yet.':'Browser recovery storage is unavailable. Keep this tab open and download your draft before leaving.'}</DialogDescription><div className="form-actions"><Button type="button" variant="outline" onClick={() => setLeaveAnyway(false)}>Keep editing</Button><Button type="button" variant="outline" onClick={downloadDraft}>Download this draft</Button><Button type="button" disabled={!draft.backupAvailable} onClick={close}>Leave with local copy</Button></div></DialogContent></Dialog>
    </form>
  );
}

/* --------------------------------------------------------------- Annotations */

type ToolMode = 'menu' | 'comment';
type Pending = { para: number; start: number; end: number; quote: string; collapsed: boolean; left: number; top: number; editorLeft: number; editorTop: number };

function offsetWithin(root: HTMLElement, node: Node, offset: number): number {
  let total = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const el = (n as Text).parentElement;
      if (el?.closest('[data-anno-ui]') || el?.closest('ins.anno-insert')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let current: Node | null;
  while ((current = walker.nextNode())) {
    if (current === node) return total + offset;
    total += (current.textContent || '').length;
  }
  return total + offset;
}

function selectionInfo(root: HTMLElement, plains: string[]): Pending | null {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const startEl = range.startContainer.nodeType === Node.ELEMENT_NODE ? range.startContainer as Element : range.startContainer.parentElement;
  const endEl = range.endContainer.nodeType === Node.ELEMENT_NODE ? range.endContainer as Element : range.endContainer.parentElement;
  const startPara = startEl?.closest('p[data-para]');
  const endPara = endEl?.closest('p[data-para]');
  if (!startPara || !endPara || startPara !== endPara || !root.contains(startPara)) return null;
  const para = Number(startPara.getAttribute('data-para'));
  const start = offsetWithin(startPara as HTMLElement, range.startContainer, range.startOffset);
  const end = offsetWithin(endPara as HTMLElement, range.endContainer, range.endOffset);
  const lo = Math.min(start, end), hi = Math.max(start, end);
  const collapsed = hi <= lo;
  const text = plains[para] || '';
  const rect = range.getBoundingClientRect();
  const rootRect = root.getBoundingClientRect();
  const toolbarLeft = rootRect.left >= 70 ? rootRect.left - 50 : Math.min(rect.right + 10, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 50);
  const toolbarTop = Math.max(60, Math.min(rect.top, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220));
  return {
    para, start: lo, end: hi, collapsed,
    quote: collapsed ? '' : text.slice(lo, hi),
    left: toolbarLeft,
    top: toolbarTop,
    editorLeft: Math.max(10, Math.min(rect.left, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 380)),
    editorTop: Math.max(60, Math.min(rect.bottom + 8, (typeof window !== 'undefined' ? window.innerHeight : 800) - 220)),
  };
}

function InlineInsert({ onCommit, onCancel }: { onCommit: (text: string) => void; onCancel: () => void }) {
  const ref = useRef<HTMLModElement>(null);
  const canceled = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);
  return (
    <ins
      ref={ref}
      data-anno-ui
      className="anno anno-insert editing"
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={() => { if (canceled.current) return; const t = (ref.current?.textContent || '').trim(); if (t) onCommit(t); else onCancel(); }}
      onKeyDown={e => {
        if (e.key === 'Escape') { e.preventDefault(); canceled.current = true; onCancel(); }
        else if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); }
      }}
    />
  );
}

type InlineDraft = { para: number; offset: number; start: number; end: number; quote: string };
function renderParagraph(plain: string, runs: InlineRun[], para: number, annos: WorkAnnotation[], selectedId:string,canRemove: boolean, onRemove: (id: string) => void, onSelect: (a: WorkAnnotation) => void, draft: InlineDraft | null, onCommitInline: (text: string) => void, onCancelInline: () => void): ReactNode[] {
  const relevant = annos.filter(a => a.para === para && a.start >= 0 && a.start <= plain.length && a.end >= a.start && a.end <= plain.length);
  const boundaries = [...new Set([0, plain.length, ...relevant.flatMap(a => [a.start, a.end]), ...(draft?.para === para ? [draft.offset] : [])])].sort((a, b) => a - b);
  const out: ReactNode[] = [];
  const props = (a: WorkAnnotation) => a.id === '__pending__' ? {} : {
    'data-annotation-id': a.id, role: 'button' as const, tabIndex: 0, 'aria-label': `${a.kind} by ${a.author}`,'aria-current':selectedId===a.id?true:undefined,
    onClick: (event: React.MouseEvent<HTMLElement>) => { event.stopPropagation(); onSelect(a); },
    onDoubleClick: (event: React.MouseEvent<HTMLElement>) => { event.stopPropagation(); if (canRemove && a.id.startsWith('local-')) onRemove(a.id); },
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(a); }
      if ((event.key === 'Delete' || event.key === 'Backspace') && canRemove && a.id.startsWith('local-')) { event.preventDefault(); onRemove(a.id); }
    },
  };
  // Split at range boundaries so overlapping notes never duplicate manuscript text.
  for (let i = 0; i < boundaries.length; i++) {
    const start = boundaries[i];
    for (const a of relevant.filter(a => a.kind === 'insert' && a.end === start)) {
      out.push(<ins key={a.id} data-anno-ui className={`anno anno-insert${selectedId===a.id?' selected':''}`} {...props(a)}>{formatInline(a.body)}</ins>);
    }
    if (draft?.para === para && draft.offset === start) out.push(<InlineInsert key="__draft__" onCommit={onCommitInline} onCancel={onCancelInline} />);
    const end = boundaries[i + 1];
    if (end === undefined || end <= start) continue;
    let text: ReactNode = renderInlineRuns(inlineSlice(runs, start, end));
    for (const a of relevant.filter(a => a.start <= start && a.end >= end && a.end > a.start)) {
      const kind = a.kind === 'insert' ? 'delete' : a.kind;
      const className = `anno anno-${kind}${a.id === '__pending__' ? ' pending-comment' : ''}${selectedId===a.id?' selected':''}`;
      text = kind === 'delete' ? <del key={`${a.id}-${start}`} className={className} {...props(a)}>{text}</del> : <mark key={`${a.id}-${start}`} className={className} {...props(a)}>{text}</mark>;
    }
    out.push(<span key={`text-${start}`}>{text}</span>);
    for (const a of relevant.filter(a => a.kind === 'comment' && a.end === end && a.id !== '__pending__' && a.body.trim())) {
      out.push(
        <button
          type="button"
          key={`chip-${a.id}`}
          data-anno-ui
          data-note-id={a.id}
          className={`annotation-chip${selectedId===a.id?' selected':''}`}
          {...props(a)}
          aria-label={`Comment by ${a.author}: ${a.body}`}
        >
          <MessageSquare size={11} aria-hidden="true" />
          <span className="annotation-chip-body">{formatInline(a.body)}</span>
        </button>,
      );
    }
  }
  return out;
}

export function AnnotatedManuscript({ content, isPoem, annotations, canAnnotate, onAdd, onRemove, canUndo = false, canRedo = false, onUndo, onRedo }: {
  content: string;
  isPoem: boolean;
  annotations: WorkAnnotation[];
  canAnnotate: boolean;
  onAdd: (a: Omit<WorkAnnotation, 'id' | 'createdAt' | 'userId' | 'author' | 'workId'>) => void;
  onRemove: (id: string) => void;
  canUndo?: boolean; canRedo?: boolean; onUndo?: () => void; onRedo?: () => void;
}) {
  const paragraphs = useMemo(() => content.split('\n\n'), [content]);
  const plains = useMemo(() => paragraphs.map(p => { const runs = inlineRuns(p); return { runs, plain: runs.map(run => run.text).join('') }; }), [paragraphs]);
  const rootRef = useRef<HTMLDivElement>(null);
  const { preferences } = useReadingPreferences();
  const [pending, setPending] = useState<Pending | null>(null);
  const [mode, setMode] = useState<ToolMode>('menu');
  const [draft, setDraft] = useState('');
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const [inlineInsert, setInlineInsert] = useState<InlineDraft | null>(null);
  const [selectedId, setSelectedId] = useState('');

  const clear = useCallback(() => { setPending(null); setSelectedId(''); setMode('menu'); setDraft(''); setInlineInsert(null); window.getSelection()?.removeAllRanges(); }, []);

  const evaluate = useCallback((e?: { target: EventTarget | null }) => {
    if (!canAnnotate || !rootRef.current) { setPending(null); return; }
    const target = e?.target as HTMLElement | null;
    if (target?.closest('.anno, [data-anno-ui]')) return;
    setSelectedId('');
    const info = selectionInfo(rootRef.current, plains.map(p => p.plain));
    if (!info) { setPending(null); return; }
    if (info.collapsed) {
      if (window.matchMedia('(pointer: coarse)').matches) return;
      setInlineInsert({ para: info.para, offset: info.start, start: info.start, end: info.start, quote: '' });
      setPending(null); setMode('menu'); setDraft('');
      return;
    }
    setInlineInsert(null); setPending(info); setMode('menu'); setDraft('');
  }, [canAnnotate, plains]);

  useEffect(() => {
    if (!canAnnotate) return;
    let timer: ReturnType<typeof setTimeout>;
    const selected = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!rootRef.current || document.activeElement?.closest('.annotate-pop')) return;
        const info = selectionInfo(rootRef.current, plains.map(p => p.plain));
        if (info && !info.collapsed) { setInlineInsert(null); setPending(info); setMode('menu'); setDraft(''); }
      }, 180);
    };
    document.addEventListener('selectionchange', selected);
    return () => { clearTimeout(timer); document.removeEventListener('selectionchange', selected); };
  }, [canAnnotate, plains]);

  const commitComment = useCallback(() => {
    if (!pending || !draft.trim()) return;
    onAdd({ kind: 'comment', quote: pending.quote, body: draft.trim(), para: pending.para, start: pending.start, end: pending.end });
    clear();
  }, [pending, draft, onAdd, clear]);

  const startAddition = useCallback(() => {
    if (!pending) return;
    setInlineInsert({ para: pending.para, offset: pending.end, start: pending.start, end: pending.end, quote: pending.quote });
    setPending(null); setMode('menu'); setDraft('');
    window.getSelection()?.removeAllRanges();
  }, [pending]);

  const commitInline = useCallback((text: string) => {
    if (!inlineInsert || !text.trim()) { setInlineInsert(null); return; }
    onAdd({ kind: 'insert', quote: inlineInsert.quote, body: text.trim(), para: inlineInsert.para, start: inlineInsert.start, end: inlineInsert.end });
    setInlineInsert(null);
  }, [inlineInsert, onAdd]);

  const applyKind = useCallback((kind: AnnotationKind) => {
    if (!pending) return;
    if (kind === 'comment') { setMode('comment'); setDraft(''); return; }
    if (kind === 'insert') { startAddition(); return; }
    onAdd({ kind, quote: pending.quote, body: '', para: pending.para, start: pending.start, end: pending.end });
    clear();
  }, [pending, onAdd, clear, startAddition]);

  useEffect(() => { if (mode === 'comment') editorRef.current?.focus(); }, [mode]);

  useEffect(() => {
    const outside = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (!target?.closest('[data-annotation-id]')) setSelectedId('');
      if (!rootRef.current?.contains(target) && !target?.closest('.annotate-pop, .annotate-rail')) { setPending(null); setMode('menu'); setDraft(''); }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { clear(); return; }
      if (!canAnnotate || !(event.ctrlKey || event.metaKey) || (event.target as Element)?.closest('input, textarea, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'z' || key === 'y') { event.preventDefault(); clear(); if (key === 'y' || event.shiftKey) onRedo?.(); else onUndo?.(); }
    };
    document.addEventListener('pointerdown', outside);
    window.addEventListener('keydown', keyboard);
    return () => { document.removeEventListener('pointerdown', outside); window.removeEventListener('keydown', keyboard); };
  }, [canAnnotate, clear, onUndo, onRedo]);

  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); clear(); return; }
      if (mode === 'comment') { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commitComment(); } return; }
      const k = e.key.toLowerCase();
      if (!preferences.keyboardShortcuts || e.altKey || e.ctrlKey || e.metaKey || (e.target as Element)?.closest('input, textarea, [contenteditable="true"]')) return;
      if (k === 'h') { e.preventDefault(); applyKind('highlight'); }
      else if (k === 'c') { e.preventDefault(); applyKind('comment'); }
      else if (k === 'd') { e.preventDefault(); applyKind('delete'); }
      else if (k === 'i') { e.preventDefault(); applyKind('insert'); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pending, mode, clear, commitComment, applyKind, preferences.keyboardShortcuts]);

  const visibleAnnotations = pending && mode === 'comment' ? [...annotations, { ...pending, id: '__pending__', workId: '', userId: '', author: 'You', kind: 'comment' as const, body: '', createdAt: 0 }] : annotations;
  const selectNote = (annotation: WorkAnnotation) => {
    setPending(null); setMode('menu'); setDraft('');
    setSelectedId(annotation.id);
  };

  return (
    <div className="manuscript-wrap">
      {canAnnotate && (
        <div className="annotate-hint">
          <Highlighter size={13} />
          <span>Select text for line notes, or click in the text to add words.</span>
          {preferences.keyboardShortcuts && <span className="annotate-hint-keys"><Kbd>H</Kbd> highlight <Kbd>C</Kbd> comment <Kbd>D</Kbd> delete <Kbd>I</Kbd> addition</span>}
          <div className="annotation-history"><Button size="sm" variant="ghost" disabled={!canUndo} onClick={() => { clear(); onUndo?.(); }}>Undo</Button><Button size="sm" variant="ghost" disabled={!canRedo} onClick={() => { clear(); onRedo?.(); }}>Redo</Button></div>
        </div>
      )}
      <div ref={rootRef} className={'reader-text ' + (isPoem ? 'poetry' : '')} onMouseUp={evaluate} onKeyUp={event => { if (event.shiftKey && event.key.startsWith('Arrow')) evaluate(event); }}>
        {plains.map((p, i) => <p data-para={i} key={i}>{renderParagraph(p.plain, p.runs, i, visibleAnnotations,selectedId, canAnnotate, (id) => { onRemove(id); clear(); }, selectNote, inlineInsert, commitInline, clear)}</p>)}
      </div>

      {pending && mode === 'menu' && (
        <div className="annotate-rail" style={{ left: pending.left, top: pending.top }} role="toolbar" aria-label="Inline critique tools" onMouseDown={event => event.preventDefault()}>
          <button type="button" className="annotate-rail-btn hl" aria-label="Highlight selected text" onClick={() => applyKind('highlight')} title="Highlight (H)"><Highlighter size={18} /><span>Highlight</span></button>
          <button type="button" className="annotate-rail-btn cm" aria-label="Comment on selected text" onClick={() => applyKind('comment')} title="Comment (C)"><MessageSquarePlus size={18} /><span>Comment</span></button>
          <button type="button" className="annotate-rail-btn del" aria-label="Suggest deletion" onClick={() => applyKind('delete')} title="Suggest deletion (D)"><Strikethrough size={18} /><span>Cut</span></button>
          <button type="button" className="annotate-rail-btn ins" aria-label="Suggest addition" onClick={() => applyKind('insert')} title="Add addition (I)"><Plus size={18} /><span>Add</span></button>
          <button type="button" className="annotate-rail-close" onClick={clear} aria-label="Cancel"><X size={13} /></button>
        </div>
      )}

      {pending && mode === 'comment' && (
        <div className="annotate-pop" style={{ left: pending.editorLeft, top: pending.editorTop }} role="dialog" aria-label="Add a comment">
          <div className="annotate-editor-label"><MessageSquarePlus size={13} /> Comment on “{pending.quote.length > 40 ? pending.quote.slice(0, 40) + '…' : pending.quote}”</div>
          <textarea ref={editorRef} aria-label="Comment text" value={draft} onChange={e => setDraft(e.target.value)} rows={3} placeholder="Share a thought on this passage…" />
          <div className="annotate-editor-actions">
            <Button size="sm" variant="outline" onClick={clear}>Cancel</Button>
            <span className="fine-print"><CornerDownLeft size={12} /> <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> save · <Kbd>Esc</Kbd> cancel</span>
            <Button size="sm" className="primary-button" disabled={!draft.trim()} onClick={commitComment}>Add comment</Button>
          </div>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- Reader */

const MIN_REVIEW_WORDS = MIN_CRITIQUE_WORDS;

export function Reader({ work: w, data, act, busy, back, onSignIn, onAuthor,onRead }: { work: Work; data: Snapshot; act: Act; busy: boolean; back: () => void; onSignIn: () => void; onAuthor: (id: string) => void;onRead:(id:string)=>void }) {
  const [readingFocus, setReadingFocus] = useState(false);
  const critiqueRef = useRef<HTMLElement>(null);
  const manuscriptRef = useRef<HTMLElement>(null);
  const [form, setForm] = useState({ overall: '', strengths: '', suggestions: '' }), [report, setReport] = useState(false), [reason, setReason] = useState(''), [feedbackTab, setFeedbackTab] = useState('Write a critique');
  const [history, setHistory] = useState(() => annotationHistory<WorkAnnotation>());
  const localAnnotations = history.present;
  const tracked = useRef('');
  const uid = data.user?.id;
  const own = w.authorId === uid;
  const done = w.hasReviewed || data.reviews.some(r => r.workId === w.id && r.userId === uid && r.version === w.version);
  const reviews = data.reviews.filter(r => r.workId === w.id);
  const canAnnotate = !!uid && !own && !done;
  const reservation = useCritiqueReservation(w.id, canAnnotate, data.revision, w.version);
  const [critiqueStorageAvailable,setCritiqueStorageAvailable]=useState(true);
  const key = 'opendraft:temporary-critique:' + w.id + ':' + (uid || 'guest') + ':' + w.version;
  const engagement=useReviewEngagement(key,w.version,w.content,manuscriptRef,canAnnotate&&data.user?.termsVersion===TERMS_VERSION);
  const qualityEnabled=canAnnotate&&data.user?.termsVersion===TERMS_VERSION&&!!w.jevReviewAvailable;
  const critiqueDraft={...form,annotations:localAnnotations};
  const critiqueCheck=useAutoCritiqueCheck(w.id,w.version,critiqueDraft,qualityEnabled);

  // Restore this writer's temporary browser draft after hydration or a work change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore this account's persisted browser draft after hydration.
    setForm({ overall: '', strengths: '', suggestions: '' }); setHistory(annotationHistory());
    try {
      const text=localStorage.getItem(key)||sessionStorage.getItem(key);
      if(text){
        const parsed=JSON.parse(text) as typeof form & {annotations?:WorkAnnotation[]};
        const safe=(value:unknown)=>typeof value==='string'?value.slice(0,12000):'';
        const restored={overall:safe(parsed.overall),strengths:safe(parsed.strengths),suggestions:safe(parsed.suggestions)};
        const annotations=Array.isArray(parsed.annotations)?parsed.annotations.filter(a=>a.workId===w.id&&a.userId===uid&&typeof a.id==='string'&&a.id.startsWith('local-')).slice(0,300):[];
        setForm(restored);setHistory(annotationHistory(annotations));
        localStorage.setItem(key,JSON.stringify({...restored,annotations,workId:w.id,title:w.title,version:w.version,updatedAt:Date.now()}));
      }
    }catch{setCritiqueStorageAvailable(false);}
  },[key,w.id,w.title,w.version,uid]);

  useEffect(() => {
    if (!uid || own || tracked.current === w.id) return;
    tracked.current = w.id;
    void fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'view', workId: w.id }) }).catch(() => { /* ignore */ });
  }, [uid, own, w.id]);

  const update = (name: string, value:string|boolean) => { const next={...form,[name]:value};setForm(next);try { localStorage.setItem(key, JSON.stringify({ ...next, annotations: localAnnotations,workId:w.id,title:w.title,version:w.version,updatedAt:Date.now() }));setCritiqueStorageAvailable(true); } catch { setCritiqueStorageAvailable(false); } };
  const changeHistory = (change: (current: AnnotationHistory<WorkAnnotation>) => AnnotationHistory<WorkAnnotation>) => {
    const next = change(history); setHistory(next);
    try { localStorage.setItem(key, JSON.stringify({ ...form, annotations: next.present,workId:w.id,title:w.title,version:w.version,updatedAt:Date.now() }));setCritiqueStorageAvailable(true); } catch { setCritiqueStorageAvailable(false); }
  };
  const totalWords = wordCount(form.overall + ' ' + form.strengths + ' ' + form.suggestions + ' ' + localAnnotations.map(a => a.body).join(' '));
  const valid = totalWords > 0;
  const inRoom = w.status === 'spotlight';
  const baseCredit = inRoom ? 1 : 0;
  const perWord = inRoom ? 0.005 : 0;
  const reward = totalWords < MIN_REVIEW_WORDS ? 0 : Math.round((baseCredit + (totalWords - MIN_REVIEW_WORDS) * perWord) * 1000) / 1000;
  const [confirmNoCredits,setConfirmNoCredits]=useState(false);
  const allGreen=readingComplete(engagement.summary)&&critiqueCheck.current?.result?.credit.eligible===true;
  const submit = async (withoutCredits=false) => { if(!withoutCredits&&(!inRoom||totalWords<MIN_REVIEW_WORDS||!allGreen)){setConfirmNoCredits(true);return;} const payload = { ...form, withoutCredits, attested:true, workId: w.id,version:w.version, ...(engagement.summary?{engagement:engagement.summary}:{}), annotations: localAnnotations.map(a => ({ kind: a.kind, quote: a.quote, body: a.body, para: a.para, start: a.start, end: a.end })) }; if (await act({ action: 'review', review: payload }, 'Critique shared.')) { try{localStorage.removeItem(key);sessionStorage.removeItem(key);}catch{/* The server submission succeeded even if tab storage is unavailable. */} setForm({ overall: '', strengths: '', suggestions: '' }); setHistory(annotationHistory()); engagement.clear(); setFeedbackTab('All feedback'); } };
  const saved = data.bookmarks.includes(w.id);

  const serverAnnotations: WorkAnnotation[] = (data.annotations || []).filter(a => a.workId === w.id).map(a => ({ ...a, start: a.startPos ?? a.start, end: a.endPos ?? a.end }));
  const annotations = [...serverAnnotations, ...localAnnotations];

  const addAnnotation = (a: Omit<WorkAnnotation, 'id' | 'createdAt' | 'userId' | 'author' | 'workId'>) => {
    changeHistory(current => editAnnotations(current, [...current.present, { ...a, id: 'local-' + crypto.randomUUID(), workId: w.id, userId: uid || 'guest', author: data.user?.name || 'You', createdAt: Date.now() }]));
  };
  const removeAnnotation = (id: string) => changeHistory(current => editAnnotations(current, current.present.filter(a => a.id !== id)));

  return (
    <div className={'reader' + (readingFocus ? ' reading-focus' : '')}>
      <div className="breadcrumb">
        <button onClick={() => onAuthor(w.authorId)}>{w.author}</button>
        <span>›</span>
        <button onClick={back}>Writing</button>
        <span>›</span>
        <strong>{w.title}</strong>
      </div>
      <h1 className="write-title">Write a critique</h1>
      <div className="reading-tools"><ReadingSettings/>{data.user&&!['draft','withdrawn'].includes(w.status)&&<WorkReadingOptions key={w.id+data.user.id} workId={w.id} uid={data.user.id} version={w.version}/>}<button type="button" className="reading-settings-button" aria-pressed={readingFocus} onClick={() => setReadingFocus(value => !value)}><Maximize2 size={16}/>{readingFocus ? 'Show reading details' : 'Focus on the text'}</button><button type="button" className="reading-settings-button" onClick={() => { critiqueRef.current?.scrollIntoView({ behavior: prefersReducedMotion() ? 'instant' : 'smooth', block: 'start' }); critiqueRef.current?.focus({ preventScroll: true }); }}><MessageSquare size={16}/>Jump to feedback</button></div>
      {canAnnotate && <CritiqueReservation reservation={reservation} workId={w.id}/>}
      {canAnnotate && !critiqueStorageAvailable && <p className="form-error" role="alert">Browser draft storage is unavailable. Keep this page open or copy your feedback elsewhere until you submit it; it cannot be recovered after a reload.</p>}
      <WorkParts key={w.id} work={w} onRead={onRead}/><div className="reader-grid">
        <div>
          <article ref={manuscriptRef} className="reader-manuscript">
            <div className="reader-kicker">
              <span className="tag">{w.genre}</span>
              <span>{w.kind} · {w.stage}</span>
              {w.authorId.startsWith('sample-') && <span className="tag">Example story</span>}
            </div>
            <h1>{w.title}</h1>
            <div className="reader-byline">
              <WriterAvatar name={w.author} userId={w.authorId.startsWith('sample-') ? undefined : w.authorId} className="avatar peach" />
              <span>By <button className="author-link" onClick={() => onAuthor(w.authorId)}>{w.author}</button></span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} />{Math.max(1, Math.ceil(w.words / 200))} min read</span>
              <button className={'icon-button' + (saved ? ' is-saved' : '')} aria-label={saved ? 'Remove bookmark' : 'Bookmark work'} aria-pressed={saved} disabled={busy} onClick={() => void act({ action: 'bookmark', workId: w.id, saved: !saved }, saved ? 'Bookmark removed.' : 'Work saved.')}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>
            </div>
            <div className="reader-request">
              <strong>Critique guidance from {w.author}</strong>
              <p>{w.request}</p>
            </div>
            <div className="ai-process-note"><strong>Writing process</strong><span>{writingProcessDescription(w.aiProcess)}</span></div>
            {w.warning && <div className="content-warning"><Flag size={14} style={{ marginRight: 6, verticalAlign: '-2px' }} /><strong>Content note:</strong> {w.warning}</div>}
            {(w.mature || w.themes) && <div className="mature-note"><AlertTriangle size={13} /><strong>Mature themes:</strong> {w.themes || 'Mature content'}</div>}
            <AnnotatedManuscript content={w.content} isPoem={w.kind === 'Poem'} annotations={annotations} canAnnotate={canAnnotate} onAdd={addAnnotation} onRemove={removeAnnotation} canUndo={!!history.past.length} canRedo={!!history.future.length} onUndo={() => changeHistory(undoAnnotations)} onRedo={() => changeHistory(redoAnnotations)} />
            <div className="reader-end">
              <Feather size={16} />
              <span>{w.words} words · {reviews.length} {reviews.length === 1 ? 'critique' : 'critiques'}{annotations.length ? ` · ${annotations.length} line notes` : ''}</span>
              <button className="text-link" onClick={() => setReport(true)}><Flag size={13} />Report a concern</button>
            </div>
          </article>

          <section ref={critiqueRef} tabIndex={-1} className="panel-card critique-composer-panel" style={{ marginTop: 16 }} aria-label="Your critique">
            <div className="critique-panel-heading"><Sparkles size={16} /><h2>{own?'Feedback on your writing':'Your critique'}</h2>{!own&&<span className="reward-badge">{formatCredits(allGreen?reward:0)} credits</span>}</div>
            <p className="critique-intro">{own?'Critiques from readers of your writing.':`Your critique is for ${w.author}. Use the line tools, then add as much or as little prose as you like.`}</p>
            <Tabs value={own?'All feedback':feedbackTab} onValueChange={setFeedbackTab}>
              <TabsList className="feedback-tabs">
                {!own&&<TabsTrigger value="Write a critique">Write a critique</TabsTrigger>}
                <TabsTrigger value="All feedback">{own?'Feedback for you':`Feedback for ${w.author}`} {reviews.length ? `(${reviews.length})` : ''}</TabsTrigger>
              </TabsList>
              <TabsContent value="Write a critique">
                {own ? <div className="notice-box">This is your work. Read the feedback from your readers.</div>
                  : done ? <div className="notice-box"><Check size={20} /><h3>Your perspective is in.</h3><p>You’ve already critiqued this version. Thank you for helping the next draft.</p><Button variant="outline" onClick={() => setFeedbackTab('All feedback')}>Read your critique</Button></div>
                    : <form className="critique-form" onSubmit={e => { e.preventDefault(); if (data.user) void submit(); else onSignIn(); }}>
                      <label className="field-label">Your critique<span className="field-hint">What stayed with you? What should the writer try next?</span><Textarea maxLength={12000} rows={6} value={form.overall} onChange={e => update('overall', e.target.value)} placeholder="A few sentences, or a long, careful read…" /></label>
                      <details className="optional-structured">
                        <summary>Add structured feedback <span className="optional">(optional)</span></summary>
                        <label className="field-label">What’s working?<Textarea maxLength={12000} rows={4} value={form.strengths} onChange={e => update('strengths', e.target.value)} placeholder="A moment, image, or choice that stayed with you." /></label>
                        <label className="field-label">What could be stronger?<Textarea maxLength={12000} rows={4} value={form.suggestions} onChange={e => update('suggestions', e.target.value)} placeholder="A possibility to consider." /></label>
                      </details>
                      <div className="critique-wordcount"><span>{totalWords} words</span><span>{totalWords >= MIN_REVIEW_WORDS ? critiqueCheck.current?.result?.credit.eligible===false?'Below quality requirement · 0 credits':`${formatCredits(reward)} potential credits` : 'Short critique · 0 credits'}</span></div>
                      <div className="word-progress"><span style={{ width: Math.min(100, (totalWords / MIN_REVIEW_WORDS) * 100) + '%' }} /></div>
                      <p className="fine-print">{CRITIQUE_CREDIT_RULE} Shorter critiques are welcome without credits.</p>
                      <CritiqueQuality key={key} content={w.content} draft={critiqueDraft} enabled={qualityEnabled} check={critiqueCheck}/><p className="fine-print human-critique-reminder">Write your critique yourself. Generative AI may not write or rewrite it. The evaluator scores only.</p>
                      <span className="disabled-wrap" title={!data.user ? 'Sign in to share a critique.' : !totalWords ? 'Add some feedback first. Short critiques are welcome.' : busy ? 'Sharing and checking credit eligibility…' : reward ? 'Credits depend on the final server quality check.' : 'Share this shorter critique without earning credits.'}>
                        <Button type="submit" className="primary-button submit-critique" disabled={busy || (!!data.user && !valid)}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : <MessageSquare size={15} />} {data.user ? `${reward&&critiqueCheck.current?.result?.credit.eligible===false?'Share without credits':'Share your critique'}${localAnnotations.length ? ` (+${localAnnotations.length} line notes)` : ''}` : 'Sign in to critique'}</Button>
                      </span>
                      <p className="fine-print" role="status">{critiqueStorageAvailable?'Critique draft autosaved on this browser. Return from My critiques to continue, even after closing this tab.':''}</p>
                      <Dialog open={confirmNoCredits} onOpenChange={setConfirmNoCredits}><DialogContent><DialogHeader><DialogTitle>Share without credits?</DialogTitle><DialogDescription>{!inRoom?'This work is outside the reading room; credit earning is locked.':'Read more carefully and revise your feedback. Credits require careful reading, at least 175 words, and a passing OpenDraft quality check.'} You can revise, or share this critique for zero credits.</DialogDescription></DialogHeader><DialogFooter><Button type="button" variant="outline" onClick={()=>setConfirmNoCredits(false)}>Keep reviewing</Button><Button type="button" disabled={busy} onClick={()=>{setConfirmNoCredits(false);void submit(true);}}>Confirm: share for zero credits</Button></DialogFooter></DialogContent></Dialog>
                      <p className="privacy-note">{w.critiqueVisibility==='private'?'Your critique is private between you and the writer.':'Your critique will be visible to workshop members.'}</p>
                    </form>}
              </TabsContent>
              <TabsContent value="All feedback">
                {reviews.length ? <div style={{ padding: '4px 14px 14px' }}>{reviews.map(r => <FeedbackCard key={r.id} review={r} own={own} act={act} busy={busy} onAuthor={onAuthor} annotations={serverAnnotations.filter(a => a.reviewId === r.id)} />)}</div>
                  : <div className="notice-box"><MessageSquare size={22} /><h3>{own?'No feedback on your writing yet.':w.critiqueVisibility==='private'?'You haven’t critiqued this work yet.':`No feedback for ${w.author} yet.`}</h3><p>{own?`Readers’ critiques of your work will appear here.${w.critiqueVisibility==='private'?' Only you and each reviewer can see their critique.':''}`:w.critiqueVisibility==='private'?`Your critique will be shared with ${w.author}. Other readers’ critiques are private.`:`Critiques here are for ${w.author}, and are visible to workshop members.`}</p></div>}
              </TabsContent>
            </Tabs>
          </section>
        </div>

        <aside className="critique-panel">
          <div className="panel-card this-work">
            <div className="panel-head">This work</div>
            <div className="panel-body">
              <dl>
                <dt>Words</dt><dd>{w.words.toLocaleString()}</dd>
                <dt>Reading time</dt><dd>{readingTimeLabel(w.words)}</dd>
                <dt>Genre</dt><dd>{w.genre}</dd>
                <dt>Type</dt><dd>{w.kind}</dd>
                <dt>Stage</dt><dd>{w.stage}</dd>
                <dt>Critiques</dt><dd>{reviews.length}</dd>
                <dt>Line notes</dt><dd>{annotations.length}</dd>
              </dl>
            </div>
          </div>
          <div className="panel-card">
            <div className="panel-head">Credit earnings</div>
            <div className="panel-body">
              <table className="earnings">
                <tbody>
                  <tr><td>Fewer than {MIN_REVIEW_WORDS} words</td><td>0 credits</td></tr>
                  <tr><td>{MIN_REVIEW_WORDS} words or more {inRoom ? '(reading room)' : '(outside reading room · no credits)'}</td><td className="credit-plus">{baseCredit} {baseCredit === 1 ? 'credit' : 'credits'}</td></tr>
                  <tr><td>Each word over {MIN_REVIEW_WORDS}</td><td className="credit-plus">+{perWord}</td></tr>
                  <tr><td>Per 100 extra words (same conversion)</td><td className="credit-plus">+{formatCredits(perWord * 100)} credits</td></tr>
                </tbody>
              </table><p className="fine-print">The 100-word amount is another way to express the per-word rate, not an extra bonus.</p>
              {!inRoom && <p className="fine-print" style={{ marginTop: 8 }}>Credit earning is locked because this work is outside the reading room. You can still share your saved critique for zero credits.</p>}
            </div>
          </div>
          <div className="panel-card">
            <div className="panel-head">Critique legend</div>
            <div className="panel-body">
              <ul className="legend">
                <li><span className="legend-swatch hl" /> Highlight — a passage worth noticing</li>
                <li><span className="legend-swatch cm" /> Comment — a thought attached inline</li>
                <li><span className="legend-swatch del" /> Deletion — text you would cut</li>
                <li><span className="legend-swatch ins" /> Addition — words you would add</li>
              </ul>
            </div>
          </div>
        </aside>
      </div>
      <Dialog open={report} onOpenChange={setReport}>
        <DialogContent className="compact-dialog">
          <DialogTitle>Report a concern</DialogTitle>
          <DialogDescription>Reports are stored for the workshop operator to review. Describe plagiarism, harassment, or another community concern.</DialogDescription>
          <form onSubmit={async e => { e.preventDefault(); if (await act({ action: 'report', workId: w.id, reason }, 'Your report has been recorded for operator review.')) { setReport(false); setReason(''); } }}>
            <label className="field-label">What should the operator know?<Textarea required minLength={10} maxLength={1000} value={reason} onChange={e => setReason(e.target.value)} /></label>
            <Button type="submit" disabled={busy} className="primary-button" style={{ marginTop: 12 }}>Submit report</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ------------------------------------------------------------- Story page */

export function StoryPage({ work: w, data, act, onCritique, onAuthor, analytics, onAnalytics,onChanged,onRead }: { work: Work; data: Snapshot; act: Act; busy: boolean; onCritique: () => void; onAuthor: (id: string) => void; analytics: Analytics | null; onAnalytics: () => void;onChanged?:()=>void;onRead:(id:string)=>void }) {
  const [expanded, setExpanded] = useState(false);
  const [readingFocus, setReadingFocus] = useState(false);
  const reviews = data.reviews.filter(r => r.workId === w.id);
  const annotations = (data.annotations || []).filter(a => a.workId === w.id);
  const uid = data.user?.id;
  const own = w.authorId === uid;
  const done = w.hasReviewed || data.reviews.some(r => r.workId === w.id && r.userId === uid && r.version === w.version);
  const saved = w.bookmarked || data.bookmarks.includes(w.id);
  const workStats = own && analytics ? analytics.works.find(x => x.workId === w.id) : undefined;
  const paragraphs = w.content.split('\n\n');
  const preview = paragraphs.slice(0, 2).join('\n\n');
  const body = expanded ? w.content : preview;
  return (
    <div className={'sheet wide story-sheet' + (readingFocus ? ' reading-focus' : '')}>
      <div className="sheet-toolbar story-toolbar">
        <span className="breadcrumb" style={{ padding: 0 }}>
          <button onClick={onCritique}>Writing</button><span>›</span><strong>{w.title}</strong>
        </span>
        <span className="toolbar-spacer" />
        <RevisionCompare key={w.id} work={w}/>{own&&<ShowcaseConsent work={w} onChanged={onChanged}/>}
        <button className={'row-action' + (saved ? ' is-saved' : '')} onClick={() => void act({ action: 'bookmark', workId: w.id, saved: !saved }, saved ? 'Bookmark removed.' : 'Work saved.')}><Bookmark size={13} fill={saved ? 'currentColor' : 'none'} />{saved ? 'Saved' : 'Save'}</button>
      </div>
      <div className="sheet-body">
        <WorkParts key={w.id} work={w} onRead={onRead}/>
        <div className="story-head">
          <span className="story-kicker">{w.genre} · {w.kind}</span>
          <h1 className="story-title">{formatInline(w.title)}</h1>
          <div className="story-byline">by <button className="author-link" onClick={() => onAuthor(w.authorId)}>{w.author}</button> · {w.words.toLocaleString()} words · {readingTimeLabel(w.words)} · {w.stage}</div>
        </div>
        <div className="reader-grid story-grid">
          <div>
            <div className="story-cta">
              <div>
                <strong>{own?'Feedback on your writing':done?'Your critique':'Write a critique'}</strong>
                {own?<p className="fine-print">Read what other writers have said about your work.</p>:<p className="fine-print">Your critique is for {w.author}. Short critiques are welcome; credits start at {MIN_REVIEW_WORDS} words.</p>}
              </div>
              <Button className="primary-button" onClick={onCritique} title={own ? 'Read the critiques on your own work' : done ? 'You have already critiqued this version' : 'Read closely and leave line notes'}>{own ? 'Read feedback for you' : done ? 'Read your critique' : 'Write a critique'} <ChevronRight size={14} /></Button>
            </div>

            <h2 className="section-title">About this work</h2>
            <p className="story-request"><strong>The writer asks:</strong> {formatInline(w.request)}</p>
            <div className="ai-process-note"><strong>Writing process</strong><span>{writingProcessDescription(w.aiProcess)}</span></div>
            {(w.warning || w.mature || w.themes) && <div className="mature-note"><AlertTriangle size={13} /><strong>Content note:</strong> {[w.warning, w.themes].filter(Boolean).join(' · ')}</div>}

            <h2 className="section-title" style={{ marginTop: 20 }}>Read</h2>
            <div className="reading-tools"><ReadingSettings/>{data.user&&!['draft','withdrawn'].includes(w.status)&&<WorkReadingOptions key={w.id+data.user.id} workId={w.id} uid={data.user.id} version={w.version}/>}<button type="button" className="reading-settings-button" aria-pressed={readingFocus} onClick={() => setReadingFocus(value => !value)}><Maximize2 size={16}/>{readingFocus ? 'Show reading details' : 'Focus on the text'}</button></div>
            <div className="reader-text story-read">{body.split('\n\n').map((p, i) => <p key={i}>{formatInline(p)}</p>)}</div>
            {!expanded && paragraphs.length > 2 && (
              <button className="continue-reading" onClick={() => setExpanded(true)}>Continue reading ({w.words.toLocaleString()} words) <ChevronDown size={14} /></button>
            )}

            <h2 className="section-title" style={{ marginTop: 22 }}>{own?'Feedback on your writing':`Feedback for ${w.author}`} {reviews.length ? `(${reviews.length})` : ''}</h2>
            {reviews.length ? (
              <div className="story-critiques">
                {reviews.map(r => (
                  <article className="story-critique" key={r.id}>
                    <div className="feedback-author"><WriterAvatar name={r.author} userId={r.userId} className="avatar tone-1" /><button className="author-link feedback-author-name" onClick={() => onAuthor(r.userId)}>{r.author}</button><small>{new Date(r.createdAt).toLocaleDateString()}</small></div>
                    <ReviewerScore id={r.userId}/><p>{r.overall || r.strengths || r.suggestions}</p><span className="process-disclosure">{r.processDisclosure==='assistive-tools'?'Assistive tools disclosed':r.processDisclosure==='human-only'?'Human-written critique':'Process not declared'}</span>{own&&<CritiqueRating id={r.id}/>}
                    <div className="story-critique-foot"><span className="tag">{formatCredits(r.reward)} credits</span><button className="text-link" onClick={onCritique}>Read the full critique <ChevronRight size={13} /></button></div>
                  </article>
                ))}
              </div>
            ) : <p className="fine-print">{own?'No feedback on your writing yet. Readers’ critiques will appear here.':w.critiqueVisibility==='private'?`You haven’t critiqued this work yet. Your critique will be shared with ${w.author}; other readers’ critiques are private.`:`No feedback for ${w.author} yet. Your critique could be the first.`}</p>}
          </div>

          <aside className="critique-panel">
            <div className="panel-card this-work">
              <div className="panel-head">The work</div>
              <div className="panel-body">
                <div className="tag-row" style={{ marginBottom: 10 }}><span className="tag">{w.genre}</span><span className="tag">{w.kind.toLowerCase()}</span><span className="tag">{w.stage.toLowerCase()}</span></div>
                <dl>
                  <dt>Words</dt><dd>{w.words.toLocaleString()}</dd>
                  <dt>Reading time</dt><dd>{readingTimeLabel(w.words)}</dd>
                  <dt>Critiques</dt><dd>{reviews.length} of {w.targetReviews || 2}</dd>
                  <dt>Line notes</dt><dd>{annotations.length}</dd>
                  <dt>Status</dt><dd>{w.status === 'spotlight' ? 'Reading room' : w.status === 'queued' ? 'In queue' : w.status === 'open' ? 'Open' : w.status}<QueueProgress work={w}/></dd>
                </dl>
              </div>
            </div>
            {own && workStats && (
              <div className="panel-card">
                <div className="panel-head">Your analytics</div>
                <div className="panel-body">
                  <div className="mini-stats"><div><strong>{workStats.views}</strong><span>reads</span></div><div><strong>{workStats.readers}</strong><span>readers</span></div></div>
                  <button className="text-link" style={{ marginTop: 10 }} onClick={onAnalytics}>Full analytics <ChevronRight size={13} /></button>
                </div>
              </div>
            )}
            <div className="panel-card">
              <div className="panel-head">Want to help?</div>
              <div className="panel-body">
                <p className="fine-print" style={{ marginBottom: 10 }}>Read closely, leave line notes, and tell the writer what you noticed. {w.critiqueVisibility === 'private' ? 'Critiques are private between you and the writer.' : 'Critiques are visible to workshop members.'}</p>
                <Button variant="outline" onClick={onCritique}>Write a critique <ChevronRight size={13} /></Button>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Feedback */

const ANNO_LABEL: Record<string, string> = { highlight: 'Highlight', comment: 'Comment', delete: 'Deletion', insert: 'Addition' };

function FeedbackCard({ review: r, own, onAuthor, annotations }: { review: Review & { helpful: number; reward: number }; own?: boolean; act: Act; busy: boolean; onAuthor: (id: string) => void; annotations?: WorkAnnotation[] }) {
  return (
    <article className="feedback-card">
      <div className="feedback-author"><WriterAvatar name={r.author} userId={r.userId} className="avatar tone-1" /><button className="author-link feedback-author-name" onClick={() => onAuthor(r.userId)}>{r.author}</button><small>{new Date(r.createdAt).toLocaleDateString()} · {formatCredits(r.reward)} credits</small></div>
      <ReviewerScore id={r.userId}/>
      <span className="process-disclosure">{r.processDisclosure==='assistive-tools'?'Assistive tools disclosed':r.processDisclosure==='human-only'?'Human-written critique':'Process not declared'}</span>
      {r.overall && <><h4>Critique</h4><p>{formatInline(r.overall)}</p></>}
      {r.strengths && <><h4>What’s working</h4><p>{formatInline(r.strengths)}</p></>}
      {r.suggestions && <><h4>Room to grow</h4><p>{formatInline(r.suggestions)}</p></>}
      {!!annotations?.length && (
        <div className="inline-feedback">
          <h4><ListChecks size={12} /> Line notes ({annotations.length})</h4>
          <ul>
            {annotations.map(a => (
              <li key={a.id} className={'inline-note kind-' + a.kind}>
                <span className="inline-note-kind">{ANNO_LABEL[a.kind] || a.kind}</span>
                {a.quote && <q>{a.quote}</q>}
                {a.body && <span className="inline-note-body">{a.body}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {r.quote && <><blockquote>{r.quote}</blockquote><p>{r.annotation}</p></>}
      <div className="feedback-rating-actions">{own&&<CritiqueRating id={r.id}/>}</div>
    </article>
  );
}

export function FeedbackList({ reviews, data, act, busy, onRead, received, onExplore, onAuthor }: { reviews: Snapshot['reviews']; data: Snapshot; act: Act; busy: boolean; onRead: (id: string) => void; received: boolean; onExplore: () => void; onAuthor: (id: string) => void }) {
  if (!reviews.length) {
    return (
      <div className="sheet">
        <div className="sheet-head"><h1>{received ? 'Critique feedback' : 'Critiques you have given'}</h1></div>
        <div className="sheet-body"><Empty title={received ? 'No critiques yet.' : 'Good feedback starts with a good read.'} description={received ? 'Publish a draft to the reading room to begin receiving critiques.' : 'Pick a work, read it closely, and share what you notice.'} label="Explore writing" action={onExplore} /></div>
      </div>
    );
  }
  return (
    <div className="sheet">
      <div className="sheet-head"><h1>{received ? 'Critique feedback' : 'Critiques you have given'}</h1></div>
      <div className="sheet-toolbar"><span className="fine-print">{reviews.length} {reviews.length === 1 ? 'critique' : 'critiques'} · private between each reader and writer</span></div>
      <div style={{ padding: '4px 24px 20px' }}>
        {reviews.map(r => (
          <div key={r.id} style={{ paddingTop: 8 }}>
            <button className="feedback-work-title" onClick={() => onRead(r.workId)}>{(r as Review & {workTitle?:string}).workTitle || data.works.find(w => w.id === r.workId)?.title || 'A withdrawn work'}<ChevronRight size={15} /></button>
            <FeedbackCard review={r} own={received} act={act} busy={busy} onAuthor={onAuthor} annotations={(data.annotations || []).filter(a => a.reviewId === r.id).map(a => ({ ...a, start: a.startPos ?? a.start, end: a.endPos ?? a.end }))} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Messages */

export function MessagesView({ data, act, busy, onAuthor, onOpenStory, onUnreadChange,initialWith='' }: { data: Snapshot; act: Act; busy: boolean; onAuthor: (id: string) => void; onOpenStory: (id: string) => void; onUnreadChange?: (count:number)=>void;initialWith?:string }) {
  const uid = data.user?.id || '';
  const [tab, setTab] = useState('Inbox');
  const [openWith, setOpenWith] = useState(initialWith);
  const [compose, setCompose] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [active, setActive] = useState<WorkMessage|null>(null);
  const [drafts, setDrafts] = useState<Record<string,string>>({});
  const draftRef = useRef<Record<string,string>>({});
  const [sendError, setSendError] = useState('');
  const [readError, setReadError] = useState('');
  const [latestHidden, setLatestHidden] = useState(false);
  const scroll = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  const historyPosition = useRef<{height:number;top:number}|null>(null);
  const previous = useRef({conversation:'',latest:''});
  const marked = useRef('');
  const draftKey = 'opendraft:message-drafts:'+uid;
  const inbox = usePagedList<WorkMessage>('/api/workshop?collection=conversations'+(unreadOnly?'&unread=1':''),tab==='Inbox',data.revision);
  const refreshInbox = inbox.refresh;
  const thread = usePagedList<WorkMessage>('/api/workshop?collection=messages&id='+encodeURIComponent(openWith),!!openWith&&tab==='Inbox',data.revision);
  const feedback = usePagedList<Snapshot['reviews'][number]>('/api/workshop?collection=reviews&mode=received',tab==='Critique feedback',data.revision);
  const messages = useMemo(()=>[...thread.items].reverse(),[thread.items]);
  const draft = drafts[openWith] || '';

  useEffect(()=>{
    if(!initialWith)return;const controller=new AbortController();
    fetch('/api/author?id='+encodeURIComponent(initialWith),{signal:controller.signal}).then(async response=>{const result=await response.json() as AuthorProfileData&{error?:string};if(!response.ok)throw new Error(result.error||'This writer is unavailable.');if(controller.signal.aborted)return;setOpenWith(initialWith);setTab('Inbox');setActive({id:'new-conversation',senderId:uid,sender:data.user?.name||'You',recipientId:initialWith,recipient:result.profile.name,name:result.profile.name,kind:'direct',body:'',flagged:0,readAt:null,createdAt:Date.now()});}).catch(error=>{if(!controller.signal.aborted)setSendError(error.message);});
    return()=>controller.abort();
  },[initialWith,uid,data.user?.name]);

  useEffect(()=>{
    try { const stored=JSON.parse(sessionStorage.getItem(draftKey)||'{}') as Record<string,unknown>; const values=Object.fromEntries(Object.entries(stored).filter(([key,value])=>key.length<=110&&typeof value==='string'&&value.length<=4000).slice(-20)) as Record<string,string>; draftRef.current=values;
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Restore external tab-scoped message drafts.
      setDrafts(values);
    } catch { /* Optional draft recovery. */ }
  },[draftKey]);
  const writeDraft = (id:string,value:string) => {
    const next={...draftRef.current};delete next[id]; if(value)next[id]=value;
    const bounded=Object.fromEntries(Object.entries(next).slice(-20));draftRef.current=bounded;setDrafts(bounded);
    try{sessionStorage.setItem(draftKey,JSON.stringify(bounded));}catch{/* Keep the visible composer usable. */}
  };
  const send = async (recipientId:string,body:string,onError?:(error:string)=>void,name?:string) => {
    setSendError('');
    if(await act({action:'sendMessage',recipientId,body},'Message sent.',onError||setSendError)){
      if(draftRef.current[recipientId]===body)writeDraft(recipientId,'');
      if(compose){setOpenWith(recipientId);setActive({id:'sent',senderId:uid,sender:data.user?.name||'You',recipientId,recipient:name||'Writer',name:name||'Writer',conversationId:recipientId,kind:'direct',body,flagged:0,readAt:null,createdAt:Date.now()});}
      setCompose(false);stick.current=true;return true;
    }
    return false;
  };
  useEffect(()=>{
    const unread=thread.items.find(message=>message.recipientId===uid&&!message.readAt);
    if(!unread||marked.current===unread.id)return;
    marked.current=unread.id;
    let alive=true;
    fetch('/api/workshop',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(unread.kind==='bulletin'?{action:'readMessage',circleId:unread.circleId,quiet:true}:{action:'readMessage',userId:unread.senderId,quiet:true}),signal:AbortSignal.timeout(15000)})
      .then(async response=>{const result=await response.json() as {unreadMessages:number;error?:string};if(!response.ok)throw new Error(result.error||'Read status could not update.');return result;})
      .then(result=>{if(alive){setReadError('');onUnreadChange?.(result.unreadMessages);refreshInbox();}})
      .catch(error=>{if(alive){marked.current='';setReadError(error.message);}});
    return()=>{alive=false;};
  },[thread.items,uid,onUnreadChange,refreshInbox]);
  useEffect(()=>{
    const element=scroll.current;if(!element||!messages.length)return;
    const newest=messages.at(-1)!;
    if(historyPosition.current){element.scrollTop=historyPosition.current.top+element.scrollHeight-historyPosition.current.height;historyPosition.current=null;}
    else if(previous.current.conversation!==openWith||stick.current||(newest.id!==previous.current.latest&&newest.senderId===uid)){element.scrollTop=element.scrollHeight;stick.current=true;setLatestHidden(false);}
    else if(newest.id!==previous.current.latest)setLatestHidden(true);
    previous.current={conversation:openWith,latest:newest.id};
  },[messages,openWith,uid]);
  const openConversation = (conversation:WorkMessage)=>{setOpenWith(conversation.conversationId||'');setActive(conversation);setSendError('');setReadError('');stick.current=true;historyPosition.current=null;};
  const refresh = ()=>{inbox.refresh();if(openWith)thread.refresh();};

  return <div className="sheet wide messages-sheet">
    <div className="sheet-head"><h1>Messages</h1></div>
    <Tabs value={tab} onValueChange={setTab}>
      <TabsList className="work-tabs"><TabsTrigger value="Inbox">Inbox{data.unreadMessages?<span className="tab-count">{data.unreadMessages}</span>:null}</TabsTrigger><TabsTrigger value="Work updates">Work updates{data.unreadUpdates?<span className="tab-count">{data.unreadUpdates}</span>:null}</TabsTrigger><TabsTrigger value="Critique feedback">Critique feedback</TabsTrigger></TabsList>
      <TabsContent value="Work updates">{tab==='Work updates'&&<WorkUpdateFeed revision={data.revision||0} onRead={onOpenStory}/>}</TabsContent><TabsContent value="Inbox">
        <div className="sheet-toolbar"><Button className="primary-button" onClick={()=>setCompose(true)}><Send size={14}/>New message</Button><span className="toolbar-spacer"/><Button variant="ghost" aria-label="Refresh messages" disabled={inbox.loading||thread.loading} onClick={refresh}><RefreshCw size={14}/>Refresh</Button></div>
        <div className={'message-layout'+(openWith?' has-conversation':'')}>
          <aside className="message-conversations" aria-label="Conversations">
            <div className="message-filters"><button className={!unreadOnly?'active':''} aria-pressed={!unreadOnly} onClick={()=>setUnreadOnly(false)}>All conversations</button><button className={unreadOnly?'active':''} aria-pressed={unreadOnly} onClick={()=>setUnreadOnly(true)}>Unread</button></div>
            {inbox.items.length?<div className="inbox-list">{inbox.items.map(conversation=><button key={conversation.conversationId} className={'inbox-row'+(openWith===conversation.conversationId?' selected':'')+(conversation.unread?' unread':'')} aria-current={openWith===conversation.conversationId?'true':undefined} onClick={()=>openConversation(conversation)}><WriterAvatar name={conversation.name||conversation.sender} userId={conversation.kind==='bulletin'?undefined:conversation.conversationId} className="inbox-avatar"/><span className="inbox-body"><span className="inbox-sender">{conversation.name||conversation.sender}{conversation.unread?<span className="message-unread" aria-label={conversation.unread+' unread messages'}>{conversation.unread}</span>:null}</span><span className="inbox-preview">{conversation.senderId===uid?'You: ':conversation.kind==='bulletin'?'Bulletin: ':''}{conversation.body}</span><time className="inbox-time" dateTime={new Date(conversation.createdAt).toISOString()}>{new Date(conversation.createdAt).toLocaleDateString([], {month:'short',day:'numeric'})}</time></span></button>)}</div>:!inbox.loading&&!inbox.error?<div className="message-list-empty"><MessageSquare size={22}/><p>{unreadOnly?'You’re all caught up.':'No conversations yet.'}</p><span className="fine-print">{unreadOnly?'Incoming messages appear here.':'Start with a pen name and a hello.'}</span></div>:null}
            <PageMore page={inbox} label="More conversations"/>
          </aside>
          <section className="message-conversation" aria-label={active?.name?'Conversation with '+active.name:'Conversation'}>
            {active&&openWith?<>
              <header className="message-thread-heading"><button className="message-back" aria-label="All conversations" onClick={()=>setOpenWith('')}><ArrowLeft size={18}/></button><WriterAvatar name={active.name||active.sender} userId={active.kind==='bulletin'?undefined:openWith}/><div><h2>{active.name||active.sender}</h2><span className="fine-print">{active.kind==='bulletin'?'Circle announcements':'Private conversation'}</span></div>{active.kind!=='bulletin'&&<button className="text-link" onClick={()=>onAuthor(openWith)}>View profile<ChevronRight size={13}/></button>}</header>
              {active.kind!=='bulletin'&&<div className="message-member-controls"><FriendControls id={openWith} uid={uid}/></div>}{readError&&<p className="form-error" role="alert">{readError}</p>}
              <div ref={scroll} className="thread-body message-scroll" onScroll={event=>{const element=event.currentTarget;stick.current=element.scrollHeight-element.scrollTop-element.clientHeight<80;if(stick.current)setLatestHidden(false);}}>
                {thread.nextCursor&&<Button type="button" className="message-earlier" variant="outline" disabled={thread.loading} onClick={()=>{const element=scroll.current;if(element)historyPosition.current={height:element.scrollHeight,top:element.scrollTop};thread.loadMore();}}>{thread.loading?'Loading…':'Earlier messages'}</Button>}
                {thread.loading&&!messages.length&&<p className="fine-print" role="status">Loading conversation…</p>}
                {thread.error&&<div className="message-thread-error"><p role="alert">{thread.error}</p><Button type="button" variant="outline" onClick={thread.retry}>Retry</Button></div>}
                {messages.map((message,index)=>{
                  const day=new Date(message.createdAt).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'});
                  const earlier=index?new Date(messages[index-1].createdAt).toLocaleDateString([], {weekday:'short',month:'short',day:'numeric',year:'numeric'}):'';
                  const mine=message.senderId===uid;
                  return <div className="message-entry" key={message.id}>{day!==earlier&&<div className="message-day">{day}</div>}<div className={'bubble '+(mine?'mine':'theirs')}>{message.kind==='bulletin'&&<small className="bulletin-label">Circle bulletin · {message.sender}</small>}<p>{message.body}</p><small><time dateTime={new Date(message.createdAt).toISOString()}>{new Date(message.createdAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})}</time>{mine&&message.kind!=='bulletin'?' · '+(message.readAt?'Read':'Sent'):''}</small>{!mine&&message.kind!=='bulletin'&&<ReportMessage message={message}/>}</div></div>;
                })}
              </div>
              {latestHidden&&<button className="message-latest" onClick={()=>{if(scroll.current)scroll.current.scrollTop=scroll.current.scrollHeight;stick.current=true;setLatestHidden(false);}}>New messages · jump to latest<ChevronDown size={14}/></button>}
              {active.kind==='bulletin'?<div className="message-bulletin-note"><p className="fine-print">Only the circle owner can send bulletins. Discuss this announcement in your circle.</p><Button type="button" variant="outline" onClick={()=>{location.hash='circle/'+encodeURIComponent(active.circleId||openWith.slice(7));}}>Open circle<ChevronRight size={13}/></Button></div>:<form className="message-composer" onSubmit={async event=>{event.preventDefault();if(!busy&&draft.trim().length>=2)await send(openWith,draft);}}>
                <label className="sr-only" htmlFor="message-reply">Message to {active.name}</label><Textarea id="message-reply" value={draft} onChange={event=>writeDraft(openWith,event.target.value)} onKeyDown={event=>{if((event.ctrlKey||event.metaKey)&&event.key==='Enter'&&!event.nativeEvent.isComposing){event.preventDefault();if(!busy&&draft.trim().length>=2)void send(openWith,draft);}}} rows={3} maxLength={4000} placeholder={'Write to '+active.name+'…'}/>
                {sendError&&<p className="form-error" role="alert">{sendError}</p>}
                <div className="message-compose-footer"><span className="fine-print">{draft?'Unsent draft kept in this tab · ':''}Ctrl/⌘ + Enter to send</span><span className="fine-print">{draft.length.toLocaleString()}/4,000</span><Button type="submit" className="primary-button" disabled={busy||draft.trim().length<2}>{busy?<LoaderCircle size={14} className="animate-spin"/>:<Send size={14}/>}Send</Button></div>
              </form>}
            </>:<div className="message-welcome"><MessageSquare size={32}/><h2>Your conversations, in one place.</h2><p>Choose a conversation, or start a new one with a workshop member.</p><Button variant="outline" onClick={()=>setCompose(true)}>New message</Button></div>}
          </section>
        </div>
      </TabsContent>
      <TabsContent value="Critique feedback"><FeedbackList reviews={feedback.items} data={data} act={act} busy={busy} onRead={onOpenStory} received onExplore={()=>setTab('Inbox')} onAuthor={onAuthor}/><PageMore page={feedback} label="More feedback"/></TabsContent>
    </Tabs>
    <NewMessageDialog open={compose} onOpenChange={setCompose} onSend={send} busy={busy}/>
  </div>;
}

function ReportMessage({message}:{message:WorkMessage}){
 const [open,setOpen]=useState(false),[reason,setReason]=useState(''),[block,setBlock]=useState(false),[pending,setPending]=useState(false),[error,setError]=useState(''),[sent,setSent]=useState(false);
 const send=async()=>{setPending(true);setError('');try{await communityAction({action:'reportMessage',id:message.id,reason});setSent(true);if(block){try{await communityAction({action:'block',id:message.senderId});window.dispatchEvent(new Event('opendraft:friends'));}catch(e){setError('Report saved. Blocking could not complete: '+(e as Error).message);return;}}setOpen(false);}catch(e){setError((e as Error).message);}finally{setPending(false);}};
 return <><button className="message-report" onClick={()=>{setOpen(true);setError('');}}><Flag size={11}/>{sent?'Report saved':'Report'}</button><Dialog open={open} onOpenChange={v=>{if(!pending)setOpen(v);}}><DialogContent className="compact-dialog"><DialogTitle>Report this message</DialogTitle><DialogDescription>The message and your explanation are shared privately with the operator for review. You can also block the sender.</DialogDescription><blockquote className="report-evidence">{message.body}</blockquote><label className="field-label">What happened?<Textarea rows={4} minLength={10} maxLength={1000} value={reason} onChange={e=>setReason(e.target.value)}/></label><label className="settings-check"><input type="checkbox" checked={block} onChange={e=>setBlock(e.target.checked)}/>Also block this writer</label>{error&&<p className="form-error" role="alert">{error}</p>}<div className="form-actions"><Button variant="outline" disabled={pending} onClick={()=>setOpen(false)}>Cancel</Button><Button disabled={pending||reason.trim().length<10} onClick={()=>void send()}>Send report</Button></div></DialogContent></Dialog></>;
}
function NewMessageDialog({ open, onOpenChange, onSend, busy }: { open: boolean; onOpenChange: (v: boolean) => void; onSend: (id: string, body: string, onError?: (error: string) => void,name?:string) => Promise<boolean>; busy: boolean }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; location?: string }[]>([]);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(null);
  const [body, setBody] = useState('');
  const [error, setError] = useState('');
  const [searchState,setSearchState]=useState({query:'',error:''});

  useEffect(() => {
    if (!open || query.trim().length<2 || selected) { return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch('/api/search?recipient=1&q=' + encodeURIComponent(query), { signal: controller.signal }).then(async r => {const d=await r.json() as {error?:string;authors?:{id:string;name:string;location?:string}[]};if(!r.ok)throw new Error(d.error||'Writers could not load.');return d;}).then((d) => {if(!controller.signal.aborted){setResults((d.authors || []).filter(a => !a.id.startsWith('sample-')));setSearchState({query:query.trim(),error:''});}}).catch(err => {if(!controller.signal.aborted)setSearchState({query:query.trim(),error:err.message});});
    }, 170);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, open, selected]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="compact-dialog message-new-dialog">
        <DialogTitle>New message</DialogTitle>
        <DialogDescription>Search for a writer by their pen name and send them a private message.</DialogDescription>
        {selected ? (
          <div className="recipient-chip"><WriterAvatar name={selected.name} userId={selected.id}/>To: <strong>{selected.name}</strong><button type="button" disabled={busy} onClick={() => setSelected(null)} aria-label="Change recipient"><X size={12} /></button></div>
        ) : (
          <>
            <label className="field-label"><Search size={12} /> Writer’s pen name<Input disabled={busy} maxLength={80} value={query} onChange={e => { setQuery(e.target.value); setResults([]); }} placeholder="Start typing a name…" /></label>
            <p className="fine-print">Example authors are fictional and cannot receive messages.</p>
            {query.trim().length>=2&&searchState.query!==query.trim()&&<p className="fine-print" role="status">Finding writers…</p>}
            {query.trim().length>=2&&searchState.query===query.trim()&&searchState.error&&<p className="form-error" role="alert">{searchState.error}</p>}
            {query.trim().length>=2&&searchState.query===query.trim()&&!searchState.error&&!results.length&&<p className="fine-print">No writers found. Try another pen name.</p>}
            {!!results.length && <ul className="recipient-results">{results.map(a => <li key={a.id}><button type="button" onClick={() => { setSelected({ id: a.id, name: a.name }); setResults([]); }}>{a.name}{a.location ? <small>{a.location}</small> : null}</button></li>)}</ul>}
          </>
        )}
        <label className="field-label">Message<Textarea disabled={busy} value={body} onChange={e => setBody(e.target.value)} rows={5} maxLength={4000} placeholder="Say hello, ask about their work, or suggest a trade…" /></label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="form-actions">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Close</Button>
          <Button className="primary-button" disabled={busy || !selected || body.trim().length < 2} onClick={async () => { if (!selected) return; setError(''); if(await onSend(selected.id, body.trim(), setError,selected.name)){setBody('');setSelected(null);setQuery('');setResults([]);} }}><Send size={14} />{busy?'Sending…':'Send message'}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------- Circles */

export function Circles({ data, act, busy,initialSelected='',onOpenStory,onVisit }: { data: Snapshot; act: Act; busy: boolean;initialSelected?:string;onOpenStory:(id:string)=>void;onVisit:(id:string)=>void }) {
  const selected=initialSelected;
  const [body, setBody] = useState(''), [create, setCreate] = useState(false), [form, setForm] = useState({ name: '', description: '', genre: 'Literary fiction',access:'open' });
  const [bulletin,setBulletin]=useState('');
  const circles=usePagedList<Circle>('/api/workshop?collection=circles',!selected,data.revision);
  const [detail,setDetail]=useState<Circle|null>(null);
  const [circleError,setCircleError]=useState('');
  useEffect(()=>{if(!selected)return;const controller=new AbortController();fetch('/api/workshop?collection=circle&id='+encodeURIComponent(selected),{signal:controller.signal}).then(async response=>{const result=await response.json() as {circle:Circle;error?:string};if(!response.ok)throw new Error(result.error||'This circle is unavailable.');setDetail(result.circle);setCircleError('');}).catch(error=>{if(!controller.signal.aborted)setCircleError(error.message);});return()=>controller.abort();},[selected,data.revision]);
  const circle = detail?.id===selected?detail:circles.items.find(c=>c.id===selected)||data.circles.find(c=>c.id===selected);
  const canReadDiscussion=!!circle&&(circle.access!=='approval'||!!circle.joined);
  const discussion=usePagedList<Snapshot['posts'][number]>('/api/workshop?collection=posts&id='+encodeURIComponent(selected),!!selected&&canReadDiscussion,data.revision);
  const posts = discussion.items;
  if (circle) return (
    <div className="circle-room">
      <button className="text-link" onClick={() => onVisit('')} style={{ marginBottom: 12 }}><ArrowLeft size={14} />All writing circles</button>
      <div className="circle-room-heading">
        <span className="circle-symbol tone-1">{circle.name[0]}</span>
        <div><h2>{circle.name}</h2><p>{circle.description}</p><small>{circle.members} {circle.members === 1 ? 'member' : 'members'} · {circle.genre} · {circle.access==='approval'?'Approval-only':'Open'}</small></div>
        <Button variant={circle.joined||circle.requested ? 'outline' : 'default'} disabled={busy||circle.ownerId===data.user?.id} onClick={() => void act({ action: 'join', circleId: circle.id, joined: !circle.joined&&!circle.requested }, circle.joined ? 'You left the circle.' : circle.requested?'Membership request cancelled.':circle.access==='approval'?'Membership request sent to the circle owner.':'Welcome to the circle.')}>{circle.ownerId===data.user?.id?'Circle owner':circle.joined ? 'Leave circle' : circle.requested?'Cancel membership request':circle.access==='approval'?'Request to join':'Join circle'}</Button>
      </div>
      <CircleWorkshop circle={circle} uid={data.user?.id || ''} act={act} busy={busy} revision={data.revision} onOpenStory={onOpenStory}/>
      {circle.ownerId===data.user?.id&&<CircleMembers circle={circle} act={act} busy={busy} revision={data.revision}/>}
      <div className="discussion-heading"><h3>Around the table</h3><span>Talk craft, trade ideas, get unstuck.</span></div>
      {circle.ownerId===data.user?.id&&<details className="workshop-bulletin"><summary>Send an inbox bulletin to your circle</summary><form className="discussion-form bulletin-form" onSubmit={async event=>{event.preventDefault();if(await act({action:'bulletin',circleId:circle.id,body:bulletin},'Bulletin delivered to your circle members.'))setBulletin('');}}><label className="field-label">Send a circle bulletin<Textarea value={bulletin} onChange={event=>setBulletin(event.target.value)} minLength={5} maxLength={4000} required placeholder="An announcement for every current member’s inbox…" /></label><Button type="submit" className="primary-button" disabled={busy||bulletin.trim().length<5}><Send size={14} />Send to all members</Button></form></details>}
      {circle.joined ? <form className="discussion-form" onSubmit={async e => { e.preventDefault(); if (await act({ action: 'post', circleId: circle.id, body }, 'Your note is on the table.')) setBody(''); }}><label className="field-label">Start a conversation<Textarea required minLength={5} maxLength={5000} value={body} onChange={e => setBody(e.target.value)} placeholder="What are you working on? What’s keeping you up at the writing desk?" /></label><Button type="submit" disabled={busy || body.trim().length < 5} className="primary-button">Post to the circle</Button></form> : <div className="notice-box">Join this circle to take part in the conversation.</div>}
      {canReadDiscussion&&<>{posts.length ? posts.map(p => <article className="discussion-post" key={p.id}><div className="feedback-author"><WriterAvatar name={p.author} userId={p.userId} className="avatar tone-0" /><strong>{p.author}</strong><small>{new Date(p.createdAt).toLocaleDateString()}</small></div><p>{p.body}</p></article>) : <div style={{ marginTop: 12 }}><Empty title="Pull up a chair." description="Be the first to start a conversation in this circle." /></div>}<PageMore page={discussion} label="Earlier circle notes" /></>}
    </div>
  );
  if(selected)return <div className="notice-box" role={circleError?'alert':'status'}>{circleError||'Loading your circle…'}<Button variant="outline" onClick={()=>onVisit('')}>All writing circles</Button></div>;
  return (
    <>
      <div className="circle-toolbar"><span>Find your writing circle</span><Button variant="outline" onClick={() => setCreate(true)}><Plus size={14} />Start a circle</Button></div>
      <div className="circle-grid">
        {circles.items.map((c, i) => (
          <article className="circle-card" key={c.id}>
            <span className={'circle-symbol tone-' + (i % 3)}>{c.name[0]}</span>
            <span className="genre-tag" style={{ position: 'absolute', top: 16, right: 16 }}>{c.genre}</span>
            <h2>{c.name}</h2><p>{c.description}</p><p className="fine-print">{c.access==='approval'?'Approval-only · members-only brief and discussion':'Open · anyone can join'}</p>
            <div className="circle-card-bottom"><span><Users size={14} />{c.members} {c.members === 1 ? 'member' : 'members'}</span><Button variant="outline" onClick={() => onVisit(c.id)}>{c.joined ? <><Check size={14} />Your circle</> : 'Visit circle'}</Button></div>
          </article>
        ))}
      </div>
      <PageMore page={circles} label="More circles" />
      <Dialog open={create} onOpenChange={setCreate}>
        <DialogContent className="compact-dialog">
          <DialogTitle>A new table for your people.</DialogTitle>
          <DialogDescription>Create a writing circle around a genre, a shared project, or the way you like to write.</DialogDescription>
          <form onSubmit={async e => { e.preventDefault(); if (await act({ action: 'createCircle', circle: form }, 'Your circle is ready.')) { setCreate(false); setForm({ name: '', description: '', genre: 'Literary fiction',access:'open' }); } }} className="circle-create-form" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label className="field-label">Circle name<Input required minLength={3} maxLength={80} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></label>
            <label className="field-label">What brings you together?<Textarea required minLength={15} maxLength={600} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
            <FieldSelect label="Genre" value={form.genre} options={genres.slice(1)} change={genre => setForm(f => ({ ...f, genre }))} />
            <label className="field-label">Membership<select aria-label="Membership" className="form-select" value={form.access} onChange={event=>setForm(f=>({...f,access:event.target.value}))}><option value="open">Open · anyone can join</option><option value="approval">Approval-only · owner accepts requests</option></select></label><p className="fine-print">Name and description stay discoverable. Approval-only briefs and discussions are members-only; published writing remains public.</p>
            <Button disabled={busy} type="submit" className="primary-button">Create your circle</Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ------------------------------------------------------------- Guide */

export function Guide({ onExplore, onWrite, onAbout }: { onExplore: () => void; onWrite: () => void; onAbout: () => void }) {
  return (
    <div className="guide">
      <div className="guide-steps">
        {[{ number: '01', icon: BookOpen, title: 'Read something new.', body: 'Browse the reading room for stories, poems, and chapters looking for a fresh perspective. Every writer leaves a note about the feedback they need.' }, { number: '02', icon: MessageSquare, title: 'Give a thoughtful critique.', body: 'Leave line notes and as much prose as you like. Short feedback is welcome without credits. In the reading room, eligible critiques of at least 175 words earn 1 credit, plus 0.5 credits for every additional 100 words (0.005 per word). Read the whole work carefully. The OpenDraft quality average must exceed 2/4, with every category at least 2/4. Share useful detail, without padding.' }, { number: '03', icon: Feather, title: 'Share your next draft.', body: 'Publishing costs 5 credits. Each genre keeps four works in its reading room; the rest wait in that genre’s queue, oldest first. After the requested critiques, a piece makes room for the next writer.' }].map(({ number, icon: Icon, title, body }) => (
          <article key={number}><span className="step-number">{number}</span><Icon size={22} /><h2>{title}</h2><p>{body}</p></article>
        ))}
      </div>
      <div className="guide-inline">
        <h2 className="section-title">Critique inline</h2>
        <p className="fine-print">While you read, select any passage to leave a line note. On a phone, long-press and adjust the selection handles, then use the line tools. Comments appear as chips directly after the passage. Highlights mark what catches your eye, deletions strike text you would cut, and additions show the words you would place in green. On desktop, press <Kbd>H</Kbd> <Kbd>C</Kbd> <Kbd>D</Kbd> <Kbd>I</Kbd>, or click in the text to add words.</p>
      </div>
      <div className="guide-principles">
        <h2>A few things we believe in.</h2>
        <div>
          <section><h3>Attention is the currency.</h3><p>Everyone starts with five credits. You earn more by giving feedback. No subscriptions or paid shortcuts. A piece can receive one rewarded critique per reader.</p></section>
          <section><h3>Specific is kind.</h3><p>Show where a sentence sings, or where you lost the thread. Explain why. Offer possibilities. Respect the writer’s goals, their voice, and their ownership.</p></section>
          <section><h3>Your drafts belong to you.</h3><p>Private drafts are only visible to you. Published work and critiques are shared with workshop members. Export your writing and feedback at any time, or withdraw a work.</p></section>
          <section><h3>Room for the next writer.</h3><p>Each genre’s reading room is a rotating list of four works, not a popularity contest; everything else waits in that genre’s queue. Posting is limited to 3,500 words per post so reviewers can give it the attention it deserves.</p></section>
          <section><h3>Human judgment, honestly disclosed.</h3><p>Human writing and critique are the norm. AI-assisted manuscripts are discouraged but may be disclosed; reviewers must read the work and stand behind every point. OpenDraft uses member reports and human moderation, not unreliable AI detectors.</p></section>
        </div>
      </div>
      <div className="guide-cta">
        <Button className="primary-button" onClick={onExplore}>Find a work to critique</Button>
        <Button variant="outline" onClick={onWrite}>Start your own draft</Button>
        <button className="text-link" onClick={onAbout}>About the open-source project</button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Author profile */

export function AuthorProfile({ id,uid,onMessage, onBack, onOpenStory }: { id: string;uid:string;onMessage:(id:string)=>void; onBack: () => void; onOpenStory: (id: string) => void }) {
  const writing=usePagedList<Work>('/api/author?section=works&id='+encodeURIComponent(id));
  const groups=usePagedList<Circle>('/api/author?section=circles&id='+encodeURIComponent(id));
  const [state, setState] = useState<{ loading: boolean; error: string; data: AuthorProfileData | null }>({ loading: true, error: '', data: null });
  useEffect(() => {
    let active = true;
    // Synchronize the loading state with this external profile request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState({ loading: true, error: '', data: null });
    fetch('/api/author?id=' + encodeURIComponent(id))
      .then(async r => { const d = await r.json() as AuthorProfileData & { error?: string }; if (!r.ok) throw new Error(d.error || 'Unavailable'); return d; })
      .then(d => { if (active) setState({ loading: false, error: '', data: d }); })
      .catch(e => { if (active) setState({ loading: false, error: (e as Error).message, data: null }); });
    return () => { active = false; };
  }, [id]);

  if (state.loading) return <div className="sheet"><div className="sheet-body"><div className="loading-indicator"><LoaderCircle size={14} className="animate-spin" />Loading profile…</div></div></div>;
  if (state.error || !state.data) return <div className="sheet"><div className="sheet-body"><Empty title="This profile isn’t available." description={state.error || 'The writer could not be found.'} label="Back" action={onBack} /></div></div>;
  const { profile, stats } = state.data;const works=writing.items,circles=groups.items;
  return (
    <div className="sheet wide">
      <div className="sheet-toolbar"><button className="text-link" onClick={onBack}><ArrowLeft size={14} />Back</button></div>
      <div className="sheet-body">
        <div className="profile-grid">
          <aside className="profile-side">
            <WriterAvatar name={profile.name} userId={profile.id.startsWith('sample-') ? undefined : profile.id} version={profile.avatarUpdatedAt} className="profile-avatar" />
            <h2 style={{ font: '20px Georgia, serif', fontWeight: 700, marginTop: 14 }}>{profile.name}</h2>
            {profile.location && <p className="fine-print" style={{ marginTop: 4 }}><MapPin size={12} /> {profile.location}</p>}
            <p className="fine-print" style={{ marginTop: 6 }}>{profile.id.startsWith('sample-') ? 'Fictional example author. This profile demonstrates the workshop and cannot receive messages.' : profile.bio || 'No introduction yet.'}</p>
            <div className="profile-stats">
              <div><strong>{stats.works}</strong><span>works</span></div>
              <div><strong>{stats.words.toLocaleString()}</strong><span>words</span></div>
              <div><strong>{stats.critiquesGiven}</strong><span>critiques</span></div>
            </div>
          </aside>
          <div className="profile-main">
            <h1>{profile.name}</h1>
            <div className="profile-rank"><span>{formatCredits(profile.credits)} credits · Workshop member</span></div><FriendControls id={profile.id} uid={uid} onMessage={onMessage}/>
            <div className="profile-streak" title="Consecutive days this writer has taken part in the workshop"><Flame size={14}/><span>{stats.currentStreak||0}-day streak</span><span className="fine-print">· longest {stats.longestStreak||0} {(stats.longestStreak||0)===1?'day':'days'}</span></div>
            <ReviewerScore id={profile.id} full/>
        <h2 className="section-title">Just the facts</h2>
            <dl className="facts">
              <dt>Name</dt><dd>{profile.name}</dd>
              {profile.age ? <><dt>Age</dt><dd>{profile.age}</dd></> : null}
              {profile.sex ? <><dt>Sex</dt><dd>{profile.sex}</dd></> : null}
              <dt>Location</dt><dd>{profile.location || 'Not shared'}</dd>
              {profile.interests ? <><dt>Interests</dt><dd>{profile.interests}</dd></> : null}
              <dt>Works</dt><dd>{stats.works}</dd>
              <dt>Words written</dt><dd>{stats.words.toLocaleString()}</dd>
              <dt>Critiques given</dt><dd>{stats.critiquesGiven}</dd>
              <dt>Current streak</dt><dd>{stats.currentStreak || 0} days</dd>
              <dt>Longest streak</dt><dd>{stats.longestStreak || 0} days</dd>
            </dl>
            <h2 className="section-title" style={{ marginTop: 22 }}>Writing</h2>
            {works.length ? (
              <div className="work-list" style={{ borderTop: '1px solid #ededed' }}>
                {works.map(w => (
                  <article className="work-row" key={w.id}>
                    <WriterAvatar name={profile.name} userId={profile.id.startsWith('sample-') ? undefined : profile.id} version={profile.avatarUpdatedAt} className="work-thumb" />
                    <div className="work-body">
                      <button className="work-title" onClick={() => onOpenStory(w.id)}>{w.title}</button>
                      <div className="work-byline">{w.genre} · {w.stage} · {w.words.toLocaleString()} words · {readingTimeLabel(w.words)}</div>
                    </div>
                    <div className="work-stats"><span className="crit-count"><span className="crit-mark" />{w.reviews} critiques</span></div>
                  </article>
                ))}
              </div>
            ) : <p className="fine-print">No published work yet.</p>}
            <PageMore page={writing} label="More writing" />
            {!!circles.length && <>
              <h2 className="section-title" style={{ marginTop: 22 }}>Circles</h2>
              <div className="tag-row">{circles.map(c => <span className="tag" key={c.id}>{c.name}</span>)}</div>
            </>}
            <PageMore page={groups} label="More circles" />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------- Profile */

export function Profile({ data, act, busy, onSignIn }: { data: Snapshot; act: Act; busy: boolean; onSignIn: () => void }) {
  const user = data.user as (Snapshot['user'] & { age?: number | null; sex?: string; location?: string; interests?: string }) | null;
  const [name, setName] = useState(user?.name || ''), [bio, setBio] = useState(user?.bio || ''), [age, setAge] = useState<string>(user?.age ? String(user.age) : ''), [sex, setSex] = useState(user?.sex || ''), [location, setLocation] = useState(user?.location || ''), [interests, setInterests] = useState(user?.interests || '');
  // Reflect an externally refreshed account in the editable profile form.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setName(user?.name || ''); setBio(user?.bio || ''); setAge(user?.age ? String(user.age) : ''); setSex(user?.sex || ''); setLocation(user?.location || ''); setInterests(user?.interests || ''); }, [user?.id, user?.name, user?.bio, user?.age, user?.sex, user?.location, user?.interests]);
  if (!data.user) return <Empty title="A space of your own." description="Sign in to keep writing, share feedback, and join your circles." label="Sign in" action={onSignIn} />;
  const uid = data.user.id;
  const myWorks = data.works.filter(w => w.authorId === uid);
  const words = data.stats?.words??myWorks.reduce((s, w) => s + w.words, 0);
  const given = data.stats?.given??data.reviews.filter(r => r.userId === uid).length;
  const received = data.stats?.received??data.reviews.filter(r => data.works.some(w => w.id === r.workId && w.authorId === uid)).length;

  return (
    <div className="profile-grid">
      <aside className="profile-side">
        <AvatarUpload user={data.user} act={act} busy={busy} portrait />
        <h2 style={{ font: '20px Georgia, serif', fontWeight: 700, marginTop: 14 }}>{name}</h2>
        <p className="fine-print" style={{ marginTop: 6 }}>{bio || 'No introduction yet. Tell the workshop a little about your writing.'}</p>
        <div className="profile-stats">
          <div><strong>{data.stats?.works??myWorks.length}</strong><span>works</span></div>
          <div><strong>{given}</strong><span>critiques given</span></div>
          <div><strong>{formatCredits(data.user.credits)}</strong><span>credits</span></div>
          <div><strong><Flame size={13} />{data.user.currentStreak || 0}</strong><span>day streak</span></div>
        </div>
      </aside>
      <div className="profile-main">
        <h1>{name}</h1>
        <div className="profile-rank"><Star size={13} style={{ verticalAlign: '-2px', color: '#e0b521' }} fill="#e0b521" /> <b>{formatCredits(data.user.credits)}</b> credits · Workshop member</div>
        <div className="profile-streak" title="Your streak is public on your profile. Take part each day to keep it going."><Flame size={14}/><span>{data.user.currentStreak||0}-day streak</span><span className="fine-print">· longest {data.user.longestStreak||0} {(data.user.longestStreak||0)===1?'day':'days'}</span></div>
        <ReviewerScore id={uid} full/>
        <h2 className="section-title">Just the facts</h2>
        <dl className="facts">
          <dt>Name</dt><dd>{name}</dd>
          {age ? <><dt>Age</dt><dd>{age}</dd></> : null}
          {sex ? <><dt>Sex</dt><dd>{sex}</dd></> : null}
          <dt>Location</dt><dd>{location || 'Not shared'}</dd>
          {interests ? <><dt>Interests</dt><dd>{interests}</dd></> : null}
          <dt>Works written</dt><dd>{myWorks.length}</dd>
          <dt>Words written</dt><dd>{words.toLocaleString()}</dd>
          <dt>Critiques given</dt><dd>{given}</dd>
          <dt>Critiques received</dt><dd>{received}</dd>
          <dt>Credits</dt><dd>{formatCredits(data.user.credits)}</dd>
          <dt>Current streak</dt><dd>{data.user.currentStreak || 0} days</dd>
          <dt>Longest streak</dt><dd>{data.user.longestStreak || 0} days</dd>
        </dl>
        <h2 className="section-title" style={{ marginTop: 22 }}>About {name}</h2>
        <form className="profile-form" onSubmit={e => { e.preventDefault(); void act({ action: 'profile', name, bio, age: age === '' ? '' : Number(age), sex, location, interests }, 'Your profile has been updated.'); }}>
          <label className="field-label">Pen name<Input required minLength={2} maxLength={60} autoComplete="nickname" value={name} onChange={e => setName(e.target.value)} /></label>
          <div className="form-grid three">
            <label className="field-label">Age <span className="optional">(optional)</span><Input type="number" min={13} max={120} value={age} onChange={e => setAge(e.target.value)} placeholder="—" /></label>
            <label className="field-label">Sex <span className="optional">(optional)</span>
              <select className="form-select" value={sex} onChange={e => setSex(e.target.value)}>
                <option value="">Prefer not to say</option>
                <option value="Female">Female</option>
                <option value="Male">Male</option>
              </select>
            </label>
            <label className="field-label">Location <span className="optional">(optional)</span><Input maxLength={80} value={location} onChange={e => setLocation(e.target.value)} placeholder="City, Country" /></label>
          </div>
          <label className="field-label">A little about your writing<Textarea maxLength={1000} rows={5} value={bio} onChange={e => setBio(e.target.value)} placeholder="The stories you love, the work you’re making, and the questions you’re following." /></label>
          <label className="field-label">Interests <span className="optional">(comma separated)</span><Input maxLength={400} value={interests} onChange={e => setInterests(e.target.value)} placeholder="Gothic fiction, worldbuilding, short stories" /></label>
          <Button className="primary-button" type="submit" disabled={busy} style={{ alignSelf: 'flex-start' }}>Save your profile</Button>
        </form>
        <div className="profile-data">
          <h2 className="section-title tight">Your words are yours.</h2>
          <p className="fine-print" style={{ marginBottom: 12 }}>Take your writing, critiques, and credit history with you. Your export includes private drafts and all received feedback.</p>
          <a className="export-link" href="/api/export"><Download size={14} />Export my writing &amp; feedback</a>
          <AccountControls uid={uid}/>
        </div>
      </div>
    </div>
  );
}
