'use client';
import { useState } from 'react';
import type { Circle } from '@/app/data';
import type { Act } from '@/app/workshop';
import { Button } from './ui/button';
import { usePagedList, PageMore } from './paged-list';

type CircleMember = { id:string;userId:string;name:string;createdAt:number };
export function CircleMembers({circle,act,busy,revision}:{circle:Circle;act:Act;busy:boolean;revision?:number}) {
  const [confirmOpen,setConfirmOpen]=useState(false);
  const requests=usePagedList<CircleMember>('/api/workshop?collection=circleRequests&id='+encodeURIComponent(circle.id),true,revision);
  const members=usePagedList<CircleMember>('/api/workshop?collection=circleMembers&id='+encodeURIComponent(circle.id),true,revision);
  return <details className="workshop-bulletin"><summary>Circle access &amp; membership</summary><div className="circle-members">
    <p className="fine-print">Names and descriptions stay discoverable. Open circles let any signed-in member join and read the brief/discussion. Approval-only circles protect those details for members; published manuscripts remain public. Existing members stay when access changes.</p>
    <label className="field-label">Membership<select className="form-select" value={circle.access||'open'} disabled={busy} onChange={event=>{if(event.target.value==='open')setConfirmOpen(true);else void act({action:'circleAccess',circleId:circle.id,access:'approval'},'Circle is now approval-only.');}}><option value="open">Open · anyone can join</option><option value="approval">Approval-only · owner accepts requests</option></select></label>
    {confirmOpen&&<div className="notice-box"><p>Opening this circle makes its existing brief, meeting details, and discussions visible to every signed-in member. Pending requests will be cleared; those writers can join themselves.</p><div className="form-actions"><Button variant="outline" disabled={busy} onClick={()=>setConfirmOpen(false)}>Keep approval-only</Button><Button disabled={busy} onClick={async()=>{if(await act({action:'circleAccess',circleId:circle.id,access:'open',confirmOpening:true},'Circle is now open.'))setConfirmOpen(false);}}>Confirm opening circle</Button></div></div>}
    <h4>Pending membership requests</h4>{!requests.loading&&!requests.items.length&&<p className="fine-print">No pending requests.</p>}{requests.items.map(person=><article key={person.id} className="circle-member"><div><strong>{person.name}</strong><small>{new Date(person.createdAt).toLocaleDateString()}</small></div><div className="form-actions"><Button variant="outline" disabled={busy} onClick={()=>void act({action:'circleRequest',circleId:circle.id,userId:person.userId,approve:true},'Member approved.')}>Approve {person.name}</Button><Button variant="ghost" disabled={busy} onClick={()=>void act({action:'circleRequest',circleId:circle.id,userId:person.userId,approve:false},'Request declined.')}>Decline {person.name}</Button></div></article>)}<PageMore page={requests} label="More membership requests"/>
    <h4>Current members</h4>{members.items.map(person=><article className="circle-member" key={person.id}><strong>{person.name}</strong>{person.userId===circle.ownerId?<small>Owner</small>:<Button variant="outline" disabled={busy} onClick={()=>void act({action:'removeCircleMember',circleId:circle.id,userId:person.userId},'Member removed. They may request to join again; in open circles they can rejoin.')}>Remove {person.name}</Button>}</article>)}<PageMore page={members} label="More circle members"/>
  </div></details>;
}
