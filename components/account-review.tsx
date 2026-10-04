'use client';
import { useState } from 'react';
import { Button } from './ui/button';
import { usePagedList, PageMore } from './paged-list';

type AccountSignal={id:string;name:string;createdAt:number;workReports:number;messageReports:number;flaggedMessages:number;reporters:number};
type Evidence={id:string;createdAt:number;source:string;reason:string;workId:string|null;workTitle:string|null};
function AccountEvidence({id,onRead}:{id:string;onRead:(id:string)=>void}){
  const evidence=usePagedList<Evidence>('/api/admin?collection=accountEvidence&id='+encodeURIComponent(id));
  return <div>{evidence.items.map(item=><article className="community-case" key={item.source+item.id}><strong>{item.source==='work'?'Work report':item.source==='message'?'Incoming-message report':'Existing message flag'}</strong><p>{item.reason}</p><p className="fine-print">Reference {item.id} · {new Date(item.createdAt).toLocaleString()}</p>{item.workId&&<Button variant="outline" onClick={()=>onRead(item.workId!)}>Read {item.workTitle}</Button>}</article>)}<PageMore page={evidence} label="More account evidence"/><p className="fine-print">Use Community reports or Incoming-message reports below to examine the evidence and record a human decision. Reports are allegations, not confirmed violations.</p></div>;
}
export function AccountReview({onRead,onAuthor}:{onRead:(id:string)=>void;onAuthor:(id:string)=>void}){
  const accounts=usePagedList<AccountSignal>('/api/admin?collection=accountSignals');
  const [selected,setSelected]=useState('');
  return <section className="dash-section"><h2 className="section-title">Accounts needing review</h2><p className="fine-print">Open work/message reports and existing message flags from the last 30 days, ordered by most recent evidence. Counts and distinct reporters help prioritize review; coordinated or mistaken reports are possible. No automated bans, AI-authorship verdicts, or private-draft scanning.</p><Button variant="outline" onClick={()=>{accounts.refresh();setSelected('');}}>Refresh account review</Button>
    {!accounts.loading&&!accounts.items.length&&<p className="fine-print">No accounts have recent unresolved signals.</p>}
    {accounts.items.map(account=><article className="community-case" key={account.id}><header><button className="text-link" onClick={()=>onAuthor(account.id)}>{account.name}</button><small>{new Date(account.createdAt).toLocaleString()}</small></header><p>{account.workReports} open work reports · {account.messageReports} open message reports · {account.flaggedMessages} message flags · {account.reporters} distinct reporters</p><Button variant="outline" aria-expanded={selected===account.id} onClick={()=>setSelected(selected===account.id?'':account.id)}>{selected===account.id?'Close evidence':'Review evidence'}</Button>{selected===account.id&&<AccountEvidence id={account.id} onRead={onRead}/>}</article>)}<PageMore page={accounts} label="More accounts needing review"/>
  </section>;
}
