// Isolated browser fixture. All API responses and writes stay in memory.
import {build} from 'esbuild';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { transform } from 'lightningcss';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createServer} from 'node:http';
const directory='.sites-runtime/platform-preview';mkdirSync(directory,{recursive:true});
writeFileSync(`${directory}/entry.tsx`, `
import React from 'react';import {createRoot} from 'react-dom/client';import {ThemeProvider} from 'next-themes';import Workshop from '../../app/workshop';
function Fixture(){return <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} storageKey="theme" disableTransitionOnChange><Workshop/><div style={{position:'fixed',bottom:8,left:10,zIndex:80,fontSize:10}}><button onClick={()=>{const el=document.querySelector('[contenteditable="true"]');if(!el)return;el.focus();const data=new DataTransfer();data.setData('text/html','<h1 style="color:red"><b>Bold</b> <i>italic</i> <u>underline</u> <a href="javascript:alert(1)">plain link text</a><img src="x" onerror="alert(1)"><script>alert(1)</script></h1>');el.dispatchEvent(new ClipboardEvent('paste',{clipboardData:data,bubbles:true,cancelable:true}));}}>Paste formatting sample</button><span> · Isolated fixture</span></div></ThemeProvider>};
createRoot(document.getElementById('root')!).render(<Fixture/>);`);
await build({entryPoints:{fixture:`${directory}/entry.tsx`,data:'app/data.ts'},outdir:directory,outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'fixture-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import React from "react";export default function Link(props){return React.createElement("a",props)}',loader:'js',resolveDir:resolve('.')}));}}]});
const stylesheet=await postcss([tailwind()]).process(readFileSync('app/globals.css','utf8'),{from:resolve('app/globals.css')});writeFileSync(`${directory}/styles.css`,transform({code:Buffer.from(stylesheet.css),minify:true}).code);
const {sampleWorks,sampleCircles}=await import('../'+directory+'/data.mjs');
const user={id:'ui-fixture',name:'Test Writer',bio:'A synthetic writing profile.',credits:15,termsVersion:'2026-10-03',onboardingCompleted:true,currentStreak:1,longestStreak:1};
let avatar=null;
let works=[...sampleWorks,{...sampleWorks[0],id:'private-test',authorId:user.id,author:user.name,title:'Test Writing',content:'A quiet blue morning waits beyond the window.',status:'draft',words:8,revisionOf:'revision-source',version:2},{...sampleWorks[0],id:'revision-source',authorId:user.id,author:user.name,title:'Test Writing, first version',content:'A quiet morning waits beyond the window.\n\nThe light reaches the empty chair.',status:'open',words:15,version:1,showcaseOptIn:true,aiShowcaseConsent:false}];
const circles=[...sampleCircles.map(c=>({...c,ownerId:'system',joined:false})),{id:'fixture-circle',name:'The writing table',description:'A circle for testing owner bulletins and discussion.',genre:'Other writing',ownerId:user.id,joined:true,members:3}];
let failSave=false;
const friends=[{id:'friend-maya',userId:'maya',name:'Maya Chen',status:'pending',incoming:true}];const blocks=new Set();let friendsOnly=false;const ratings={};let cases=[];let legal=[];let audit=[];
const reviews=[{id:'critique-troy',workId:'revision-source',userId:'troy',author:'Troy Janus',overall:'The morning image works well. The final sentence could make the relationship more specific.',strengths:'The restrained voice makes space for the image.',suggestions:'Try a concrete gesture to connect the empty chair to the narrator.',annotation:'',quote:'',version:1,reward:1,helpful:0,createdAt:Date.now()-86400000}];
const messages=[
 ...Array.from({length:5},(_,i)=>({id:'fixture-message-'+i,senderId:i===3?user.id:'troy',sender:i===3?user.name:'Troy Janus',recipientId:i===3?'troy':user.id,recipient:i===3?'Troy Janus':user.name,body:['I liked the opening image.','Could you clarify the final paragraph?','The revised ending reads more clearly.','Thank you for reading!','Hey, thanks for the feedback!'][i],kind:'direct',createdAt:Date.now()-(5-i)*86400000,readAt:i<4?Date.now():null,conversationId:'troy',name:'Troy Janus'})),
 {id:'maya-message',senderId:'maya',sender:'Maya Chen',recipientId:user.id,recipient:user.name,body:'Would you like to discuss the dialogue in your story?',kind:'direct',createdAt:Date.now(),readAt:null,conversationId:'maya',name:'Maya Chen'}
];
const posts=Array.from({length:5},(_,i)=>({id:'post-'+i,circleId:'fixture-circle',userId:user.id,author:user.name,body:'A discussion note about writing and revision '+i,createdAt:Date.now()-i*1000}));
const unread=()=>messages.filter(m=>m.recipientId===user.id&&!m.readAt).length;
const conversations=()=>[...new Set(messages.map(m=>m.conversationId))].map(id=>{const all=messages.filter(m=>m.conversationId===id).sort((a,b)=>b.createdAt-a.createdAt);return{...all[0],unread:all.filter(m=>m.recipientId===user.id&&!m.readAt).length};}).sort((a,b)=>b.createdAt-a.createdAt);
const snapshot=()=>({user,works:works.map(w=>({...w,content:''})),reviews,bookmarks:[],circles,posts:[],events:[],annotations:[],analytics:{totalReads:0,uniqueReaders:0,works:[],age:{},sex:{},locations:{},recentReaders:[]},messages:[],stats:{works:works.filter(w=>w.authorId===user.id).length,words:8,given:0,received:0},unreadMessages:unread(),googleConfigured:true,isAdmin:true});
const paged=(items,params)=>{const start=Number(params.get('cursor')||0),size=Number(params.get('limit')||2);return{items:items.slice(start,start+size),nextCursor:items.length>start+size?String(start+size):null};};
createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1:5182'),params=url.searchParams;const send=(data,status=200)=>{res.statusCode=status;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));};
 if(req.method==='POST'){
  if(url.pathname==='/__fixture/fail-save'){failSave=true;send({ok:true});return;}
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
  if(url.pathname==='/api/community'){
   const person=body.id==='troy'?{userId:'troy',name:'Troy Janus'}:{userId:'maya',name:'Maya Chen'};
   if(body.action==='acceptTerms')user.termsVersion=body.version;
   if(body.action==='settings')friendsOnly=body.friendsOnly;
   if(body.action==='friendRequest')friends.push({id:'friend-'+body.id,...person,status:'pending',incoming:false});
   if(body.action==='acceptFriend'||body.action==='rejectFriend'){const f=friends.find(f=>f.userId===body.id);if(f)f.status=body.action==='acceptFriend'?'accepted':'rejected';}
   if(['cancelFriend','removeFriend','block'].includes(body.action)){const i=friends.findIndex(f=>f.userId===body.id);if(i>=0)friends.splice(i,1);}
   if(body.action==='block')blocks.add(body.id);if(body.action==='unblock')blocks.delete(body.id);
   if(body.action==='rateCritique')ratings[body.id]={usefulness:body.usefulness,specificity:body.specificity,actionability:body.actionability,created_at:Date.now()};
   if(body.action==='removeRating')delete ratings[body.id];
   if(body.action==='reportMessage')cases.push({id:'case-'+Date.now(),userId:user.id,senderId:'troy',body:messages.find(m=>m.id===body.id)?.body||'Fixture evidence',reason:body.reason,status:'open',resolution:'',createdAt:Date.now()});
   if(body.action==='resolveCase'||body.action==='resolveLegal'){const item=(body.action==='resolveCase'?cases:legal).find(c=>c.id===body.id);if(item){item.status='resolved';item.resolution=body.reason;item.resolvedAt=Date.now();}}
   if(body.action==='showcaseConsent'){const w=works.find(w=>w.id===body.id);w.showcaseOptIn=body.optIn;w.aiShowcaseConsent=body.aiConsent;}
   if(body.action==='deleteAccount'){send({ok:true,deleted:true});return;}
   audit.push({id:'audit-'+Date.now(),adminName:user.name,action:body.action,targetId:body.id||'',reason:body.reason||'',createdAt:Date.now()});
   send({ok:true});return;
  }
  if(body.action==='uploadAvatar'){avatar=body.image;user.avatarUpdatedAt=Date.now();}if(body.action==='removeAvatar'){avatar=null;user.avatarUpdatedAt=0;}
  if(body.action==='readMessage'){messages.filter(m=>m.recipientId===user.id&&m.senderId===body.userId).forEach(m=>m.readAt=Date.now());if(body.quiet){send({unreadMessages:unread()});return;}}
  if(body.action==='sendMessage'){messages.push({id:'sent-'+Date.now(),senderId:user.id,sender:user.name,recipientId:body.recipientId,recipient:body.recipientId==='troy'?'Troy Janus':'Maya Chen',name:body.recipientId==='troy'?'Troy Janus':'Maya Chen',conversationId:body.recipientId,body:body.body,kind:'direct',createdAt:Date.now(),readAt:null});}
  if(['saveDraft','autosaveDraft','publish'].includes(body.action)){
   if(body.action==='autosaveDraft'&&failSave){failSave=false;send({error:'Isolated test: save connection unavailable.'},503);return;}
   const old=works.find(w=>w.id===body.work.id);if(old&&body.expectedSavedAt!==undefined&&old.createdAt!==body.expectedSavedAt){send({error:'This draft changed in another tab.'},409);return;}
   const work={...body.work,title:body.work.title.trim()||'Untitled draft',authorId:user.id,author:user.name,status:body.action==='publish'?'queued':'draft',words:body.work.content.trim().split(/\s+/).filter(Boolean).length,reviews:0,version:1,createdAt:Math.max(Date.now(),(old?.createdAt||0)+1)};
   works=[...works.filter(w=>w.id!==work.id),work];if(body.action==='publish')user.credits-=5;
   if(body.action==='autosaveDraft'){send({id:work.id,savedAt:work.createdAt});return;}
  }
  send(snapshot());return;
 }
 if(url.pathname==='/api/workshop'){const collection=params.get('collection');if(!collection){send(snapshot());return;}if(collection==='work'){send({work:works.find(w=>w.id===params.get('id'))});return;}if(collection==='circle'){send({circle:circles.find(c=>c.id===params.get('id'))});return;}const lists={works:works.filter(w=>params.get('mode')==='mine'?w.authorId===user.id:w.status!=='draft').sort((a,b)=>b.createdAt-a.createdAt),circles,posts,conversations:conversations().filter(m=>params.get('unread')!=='1'||m.unread>0),messages:messages.filter(m=>m.conversationId===params.get('id')).sort((a,b)=>b.createdAt-a.createdAt),reviews:reviews.filter(r=>!params.get('id')||r.workId===params.get('id')),annotations:[],events:[],analytics:[]};send(paged(lists[collection]||[],params));return;}
 if(url.pathname==='/api/community'){
  const section=params.get('section'),id=params.get('id');
  if(section==='reputation'){send({items:(params.get('ids')||'').split(',').map(id=>({id,ratings:12,writers:6,eligible:true,combined:86,usefulness:90,specificity:84,actionability:84}))});return;}
  if(section==='showcase'){const w=works.find(w=>w.id==='revision-source');send({showcase:w.showcaseOptIn?{...w,note:'A thoughtful opening with room for a promising revision.',day:new Date().toISOString().slice(0,10)}:null});return;}
  if(section==='status'){send({friendsOnly,requests:friends.filter(f=>f.incoming&&f.status==='pending').length});return;}
  if(section==='relationship'){const f=friends.find(f=>f.userId===id);send({available:true,status:f?.status||'none',incoming:f?.incoming||false,blocked:blocks.has(id),unavailable:false});return;}
  if(section==='friends'){const mode=params.get('mode');const list=mode==='blocked'?[...blocks].map(id=>({id,userId:id,name:id==='troy'?'Troy Janus':'Maya Chen',status:'blocked'})):friends.filter(f=>mode==='accepted'?f.status==='accepted':mode==='incoming'?f.status==='pending'&&f.incoming:f.status==='pending'&&!f.incoming);send(paged(list,params));return;}
  if(section==='rating'){send({rating:ratings[id]||null});return;}
  if(section==='revisions'){send(paged(works.filter(w=>['private-test','revision-source'].includes(w.id)),params));return;}
  if(section==='compare'){send({left:works.find(w=>w.id===params.get('left')),right:works.find(w=>w.id===params.get('right'))});return;}
  if(section==='cases'||section==='legal'){const status=params.get('status');send(paged((section==='cases'?cases:legal).filter(c=>status==='all'||c.status===status),params));return;}
  if(section==='candidates'){send(paged(works.filter(w=>w.showcaseOptIn).map(w=>({...w,aiAssessment:''})),params));return;}
  if(section==='scheduled'){send({items:[],nextCursor:null});return;}
  if(section==='orphanedCircles'){send(paged(circles.filter(c=>c.ownerId==='system'),params));return;}
 }
 if(url.pathname==='/api/author'){const id=params.get('id'),name=id==='troy'?'Troy Janus':id==='maya'?'Maya Chen':user.name;if(params.has('section')){send(paged(params.get('section')==='works'?works.filter(w=>w.authorId===id&&w.status!=='draft'):[],params));return;}send({profile:{id,name,bio:'A synthetic workshop member.',credits:5,currentStreak:1,longestStreak:1,location:'',interests:'',createdAt:Date.now()},stats:{works:0,words:0,critiquesGiven:12,helpfulReceived:0,currentStreak:1,longestStreak:1},works:[],circles:[]});return;}
 if(url.pathname==='/api/admin'){const collection=params.get('collection');if(collection){send(paged(collection==='audit'?audit:[],params));return;}send({counts:{members:3,works:works.length,worksByStatus:{open:1,draft:1},readingRoom:4,queued:2,reviews:1,messages:messages.length,flaggedMessages:0,reports:0,openFeedback:0},reports:[],feedback:[],works:[],flaggedMessages:[],queues:[]});return;}
 if(url.pathname==='/api/notifications'){send({adminRequests:{cases:cases.filter(c=>c.status==='open').length,legal:legal.filter(c=>c.status==='open').length},friendRequests:friends.filter(f=>f.incoming&&f.status==='pending').length,unread:unread(),latest:{id:messages.at(-1).id,sender:messages.at(-1).sender}});return;}
 if(url.pathname==='/api/search'){const q=(params.get('q')||'').toLowerCase();send({works:works.filter(w=>w.status!=='draft'&&(w.title+' '+w.author).toLowerCase().includes(q)).slice(0,8),authors:q.includes('troy')?[{id:'troy',name:'Troy Janus'}]:[],circles:circles.filter(c=>c.name.toLowerCase().includes(q)),nextCursors:{}});return;}
 if(url.pathname==='/api/avatar'){if(avatar){res.setHeader('Content-Type','image/png');res.end(Buffer.from(avatar.split(',')[1],'base64'));}else{res.statusCode=404;res.end();}return;}
 if(url.pathname==='/fixture.mjs'||url.pathname==='/styles.css'){res.setHeader('Content-Type',(url.pathname.endsWith('.css')?'text/css':'text/javascript')+'; charset=utf-8');res.end(readFileSync(directory+url.pathname));return;}
 res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html><head><meta charset="utf-8"><title>OpenDraft platform fixture</title><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script type="module" src="/fixture.mjs"></script></body></html>');
}).listen(5182,'127.0.0.1',()=>console.log('Platform fixture: http://127.0.0.1:5182'));
