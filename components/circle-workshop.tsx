'use client';
import { useState } from 'react';
import { CalendarDays, Clock, Link2, ListChecks, Plus, Trash2 } from 'lucide-react';
import type { Circle, CircleReading, Work } from '@/app/data';
import { readingTimeLabel } from '@/app/data';
import type { Act } from '@/app/workshop';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { usePagedList, PageMore } from './paged-list';

function localDateTime(value?: number) {
  if (!value) return '';
  const date = new Date(value);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0,16);
}
function WorkshopBriefEditor({ circle, act, busy, close }: { circle: Circle; act: Act; busy: boolean; close: () => void }) {
  const [form, setForm] = useState({ workshopPrompt: circle.workshopPrompt || '', workshopAgenda: circle.workshopAgenda || '', meetingPlace: circle.meetingPlace || '', meetingAt: localDateTime(circle.meetingAt), feedbackDueAt: localDateTime(circle.feedbackDueAt) });
  const [error, setError] = useState('');
  return <form className="workshop-brief-form" onSubmit={async event => {
    event.preventDefault(); setError('');
    // Let the browser manage segmented date entry; read the final native values at submit.
    const fields=new FormData(event.currentTarget);
    const meeting=String(fields.get('meetingAt')||''),due=String(fields.get('feedbackDueAt')||'');
    if (await act({ action: 'updateWorkshop', circleId: circle.id, ...form, meetingAt: meeting ? new Date(meeting).getTime() : 0, feedbackDueAt: due ? new Date(due).getTime() : 0 }, 'Workshop brief saved.', setError)) close();
  }}>
    <label className="field-label">Current workshop prompt<Textarea maxLength={1200} rows={4} placeholder="What are we exploring in this workshop? What should readers pay attention to?" value={form.workshopPrompt} onChange={event => setForm({ ...form, workshopPrompt: event.target.value })}/></label>
    <label className="field-label">Session agenda<Textarea maxLength={2000} rows={4} placeholder="For example: 10-minute check-in, two close reads, then revision plans." value={form.workshopAgenda} onChange={event => setForm({ ...form, workshopAgenda: event.target.value })}/></label>
    <div className="form-grid"><label className="field-label">Workshop meeting<Input name="meetingAt" type="datetime-local" max="2099-12-31T23:59" defaultValue={form.meetingAt}/></label><label className="field-label">Feedback due by<Input name="feedbackDueAt" type="datetime-local" max="2099-12-31T23:59" defaultValue={form.feedbackDueAt}/></label></div>
    <p className="fine-print">Enter times in your local time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Each member sees the time in their own zone. Clear a date to remove it.</p>
    <label className="field-label">Meeting place or call details<Input maxLength={240} placeholder="Room, meeting link, or where to find the call details" value={form.meetingPlace} onChange={event => setForm({ ...form, meetingPlace: event.target.value })}/></label>
    <p className="fine-print">Circles are open to signed-in workshop members. Do not put private addresses, meeting passwords, or confidential writing in the brief.</p>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><Button type="button" variant="outline" disabled={busy} onClick={close}>Cancel</Button><Button type="submit" disabled={busy} className="primary-button">{busy ? 'Saving…' : 'Save workshop brief'}</Button></div>
  </form>;
}

export function CircleWorkshop({ circle, uid, act, busy, revision, onOpenStory }: { circle: Circle; uid: string; act: Act; busy: boolean; revision?: number; onOpenStory: (id: string) => void }) {
  const owner = circle.ownerId === uid;
  const [edit, setEdit] = useState(false), [adding, setAdding] = useState(false), [query, setQuery] = useState(''), [selected, setSelected] = useState(''), [copyNotice, setCopyNotice] = useState(''), [shareUrl, setShareUrl] = useState('');
  const readings = usePagedList<CircleReading>('/api/workshop?collection=circleReadings&limit=24&id=' + encodeURIComponent(circle.id), !!circle.joined, revision);
  const works = usePagedList<Work>('/api/workshop?collection=works&' + new URLSearchParams({ mode: query.trim() ? 'explore' : 'mine', q: query, limit: '20', sort: 'Newest first' }), !!circle.joined && adding, revision);
  const choices = works.items.filter(work => !['draft','withdrawn'].includes(work.status) && !readings.items.some(reading => reading.workId === work.id));
  const hasBrief = !!(circle.workshopPrompt || circle.workshopAgenda || circle.meetingAt || circle.feedbackDueAt || circle.meetingPlace);
  const copy = async () => {
    const link = location.origin + '/#circle/' + encodeURIComponent(circle.id);
    setShareUrl(link);
    try { await navigator.clipboard.writeText(link); setCopyNotice('Circle link copied. New members will need to sign in and join.'); }
    catch { setCopyNotice('Copy the circle link below. New members will need to sign in and join.'); }
  };
  return <section className="circle-workshop" aria-label="Circle workshop">
    <header className="workshop-section-heading"><div><p className="eyebrow">At this workshop</p><h3>A shared plan for your next drafts.</h3></div><div className="workshop-buttons"><Button type="button" variant="outline" onClick={() => void copy()}><Link2 size={15}/>Copy circle link</Button>{owner && <Button type="button" variant="outline" aria-expanded={edit} onClick={() => setEdit(value => !value)}>{edit ? 'Close brief editor' : 'Edit workshop brief'}</Button>}</div></header>
    {copyNotice && <div className="workshop-share"><p className="fine-print" role="status">{copyNotice}</p><Input aria-label="Shareable circle link" readOnly value={shareUrl} onFocus={event => event.target.select()}/></div>}
    {edit && owner ? <WorkshopBriefEditor key={circle.id} circle={circle} act={act} busy={busy} close={() => setEdit(false)}/> : hasBrief ? <div className="workshop-brief">
      {circle.workshopPrompt && <div><h4>Current prompt</h4><p>{circle.workshopPrompt}</p></div>}
      {(circle.meetingAt || circle.feedbackDueAt || circle.meetingPlace) && <dl className="workshop-schedule">
        {!!circle.meetingAt && <><dt><CalendarDays size={16}/>Workshop meeting</dt><dd><time dateTime={new Date(circle.meetingAt).toISOString()}>{new Date(circle.meetingAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></dd></>}
        {!!circle.feedbackDueAt && <><dt><Clock size={16}/>Feedback due</dt><dd><time dateTime={new Date(circle.feedbackDueAt).toISOString()}>{new Date(circle.feedbackDueAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</time></dd></>}
        {circle.meetingPlace && <><dt>Meeting details</dt><dd>{circle.meetingPlace}</dd></>}
      </dl>}
      {(circle.meetingAt || circle.feedbackDueAt) ? <p className="fine-print">Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}.</p> : null}
      {circle.workshopAgenda && <div><h4>Session agenda</h4><p>{circle.workshopAgenda}</p></div>}
    </div> : <p className="workshop-empty">{owner ? 'Pin a prompt, a meeting time, and a feedback deadline to give your group a shared plan.' : 'The circle owner can pin the current prompt, meeting details, and feedback deadline here.'}</p>}
    <div className="workshop-section-heading"><h4><ListChecks size={17}/>Workshop reading list</h4>{circle.joined && <Button type="button" variant="outline" aria-expanded={adding} onClick={() => { setAdding(value => !value); setSelected(''); }}><Plus size={15}/>{adding ? 'Close reading picker' : 'Add a reading'}</Button>}</div>
    {circle.joined ? <>
      {adding && <form className="workshop-reading-picker" onSubmit={async event => { event.preventDefault(); if (await act({ action: 'addCircleReading', circleId: circle.id, workId: selected }, 'Reading added to the workshop.')) { setSelected(''); setAdding(false); } }}>
        <label className="field-label">Find published writing<Input type="search" placeholder="Search the workshop, or leave blank for your published work" value={query} onChange={event => { setQuery(event.target.value); setSelected(''); }}/></label>
        <label className="field-label">Choose a reading<select className="form-select" value={selected} onChange={event => setSelected(event.target.value)}><option value="">{works.loading ? 'Loading writing…' : 'Select a published work'}</option>{choices.map(work => <option value={work.id} key={work.id}>{work.title} · {work.author}</option>)}</select></label>
        {works.error && <p className="form-error" role="alert">{works.error}</p>}
        {!works.loading && !choices.length && <p className="fine-print">No available works here. Publish a draft first, or search for another member’s writing.</p>}
        <PageMore page={works} label="More writing choices"/>
        <p className="fine-print">Only writing already published to the workshop can be added. This does not expose anyone’s private drafts or change critique visibility.</p>
        <Button type="submit" className="primary-button" disabled={busy || !selected}>Add to reading list</Button>
      </form>}
      <div className="workshop-readings">{readings.items.map(reading => <article key={reading.id} className="workshop-reading"><div><button type="button" className="work-title" onClick={() => onOpenStory(reading.workId)}>{reading.title}</button><p className="fine-print">{reading.author} · {reading.genre} · {readingTimeLabel(reading.words)}</p></div><Button type="button" variant="outline" onClick={() => onOpenStory(reading.workId)}>Read &amp; critique</Button>{(owner || reading.addedBy === uid) && <Button type="button" variant="ghost" aria-label={'Remove reading ' + reading.title} disabled={busy} onClick={() => void act({ action: 'removeCircleReading', circleId: circle.id, readingId: reading.id }, 'Reading removed from the workshop list.')}><Trash2 size={16}/></Button>}</article>)}</div>
      <PageMore page={readings} label="More workshop readings"/>
      {!readings.loading && !readings.error && !readings.items.length && <p className="workshop-empty">Put the works for your next session here so every member knows what to read.</p>}
    </> : <p className="workshop-empty">Join this circle to see and contribute to the shared reading list.</p>}
    <p className="fine-print">Open circle · brief and discussion visible to workshop members. Send an inbox bulletin when the plan changes.</p>
  </section>;
}
