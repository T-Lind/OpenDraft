'use client';
import { useState } from 'react';
import { Button } from './ui/button';

type Suggestion={theme:string;uncertain:boolean};
export function ContentThemeCheck({content,selected,apply}:{content:string;selected:string[];apply:(themes:string[])=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [result,setResult]=useState<{content:string;suggestions:Suggestion[]}|null>(null);
  const current=result?.content===content?result:null;
  const missing=current?.suggestions.filter(item=>!selected.includes(item.theme))||[];
  const check=async()=>{
    if(busy||!content.trim())return;
    setBusy(true);setError('');setResult(null);
    const checkedContent=content;
    try {
      const response=await fetch('/api/content-check',{method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(22000),body:JSON.stringify({content:checkedContent})});
      const data=await response.json() as {error?:string;suggestions:Suggestion[]};if(!response.ok)throw new Error(data.error||'The optional check is unavailable.');
      setResult({content:checkedContent,suggestions:data.suggestions});
    } catch(e) {setError((e as Error).message);} finally {setBusy(false);}
  };
  return <details className="content-theme-check"><summary>Optional content-note check</summary><p className="fine-print">Automated checks can suggest the listed content notes, not determine whether writing is safe, human-written, or allowed. It can miss themes or make mistakes. Results stay in this editor and are not moderation evidence. No check is required to publish.</p><p className="fine-print">This check sends the current draft to Vercel AI Gateway and TypeSafe AI under the workshop terms. No-training routing is required; provider retention still applies.</p><Button type="button" variant="outline" disabled={busy||!content.trim()} onClick={()=>void check()}>{busy?'Checking content notes…':'Check content notes'}</Button><p className="fine-print">Limited to 5 checks per member per day; a shared daily limit also applies.</p>
    {error&&<p className="form-error" role="alert">{error} Your draft and content notes are unchanged.</p>}
    {current&&<div role="status"><p>{current.suggestions.length?'Consider these content notes:':'No listed themes were suggested. This is not a guarantee; review your draft yourself.'}</p>{current.suggestions.length>0&&<ul>{current.suggestions.map(item=><li key={item.theme}>{item.theme}{item.uncertain?' · uncertain, review yourself':''}{selected.includes(item.theme)?' · already selected':''}</li>)}</ul>}{missing.length>0&&<Button type="button" variant="outline" onClick={()=>apply([...new Set([...selected,...missing.map(item=>item.theme)])])}>Add suggested content notes</Button>}</div>}
    {result&&!current&&<p className="fine-print" role="status">Your text changed after this check. Check again or choose notes yourself.</p>}
  </details>;
}
