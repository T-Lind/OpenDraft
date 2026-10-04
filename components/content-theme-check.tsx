'use client';
import { useState } from 'react';
import { Button } from './ui/button';

type Suggestion={theme:string;uncertain:boolean};
export function ContentThemeCheck({content,selected,apply}:{content:string;selected:string[];apply:(themes:string[])=>void}) {
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<{content:string;suggestions:Suggestion[]}|null>(null);
  const current=result?.content===content?result:null;
  const missing=current?.suggestions.filter(item=>!selected.includes(item.theme))||[];
  const check=async()=>{
    if(!consent||busy||!content.trim())return;
    setBusy(true);setError('');setResult(null);setConsent(false);
    const checkedContent=content;
    try {
      const response=await fetch('/api/content-check',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(22000),body:JSON.stringify({content:checkedContent,consent:true})});
      const data=await response.json() as {error?:string;suggestions:Suggestion[]};if(!response.ok)throw new Error(data.error||'The optional check is unavailable.');
      setResult({content:checkedContent,suggestions:data.suggestions});
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  };
  return <details className="content-theme-check"><summary>Optional content-note check with Jev</summary><p className="fine-print">Jev can suggest the listed content notes, not determine whether writing is safe, human-written, or allowed. It can miss themes or make mistakes. Results stay in this editor and are not moderation evidence. No check is required to publish.</p><label className="preference-check"><input type="checkbox" checked={consent} disabled={busy} onChange={event=>setConsent(event.target.checked)}/><span>I agree to send this draft’s text to Vercel AI Gateway and TypeSafe AI for this one check.<small>OpenDraft requests no prompt training; provider processing/retention policies still apply. Your profile, title, and messages are not sent. Do not send confidential or identifying text.</small></span></label><Button type="button" variant="outline" disabled={busy||!consent||!content.trim()} onClick={()=>void check()}>{busy?'Checking content notes…':'Check content notes'}</Button><p className="fine-print">Limited to 5 checks per member per day; a shared daily limit also applies.</p>
    {error&&<p className="form-error" role="alert">{error} Your draft and content notes are unchanged.</p>}
    {current&&<div role="status"><p>{current.suggestions.length?'Consider these content notes:':'No listed themes were suggested. This is not a guarantee; review your draft yourself.'}</p>{current.suggestions.length>0&&<ul>{current.suggestions.map(item=><li key={item.theme}>{item.theme}{item.uncertain?' · uncertain, review yourself':''}{selected.includes(item.theme)?' · already selected':''}</li>)}</ul>}{missing.length>0&&<Button type="button" variant="outline" onClick={()=>apply([...new Set([...selected,...missing.map(item=>item.theme)])])}>Add suggested content notes</Button>}</div>}
    {result&&!current&&<p className="fine-print" role="status">Your text changed after this check. Check again with fresh consent or choose notes yourself.</p>}
  </details>;
}
