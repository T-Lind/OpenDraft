import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import {safePicture} from './avatar-fixture.mjs';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:{avatar:'lib/avatar.ts',history:'lib/annotation-history.ts',initials:'components/writer-avatar.tsx',manuscript:'lib/manuscript.ts'},outdir:'.sites-runtime/tests/unit',outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',packages:'external'});
const {screenAvatar,avatarPng}=await import('../.sites-runtime/tests/unit/avatar.mjs');
const {annotationHistory,editAnnotations,undoAnnotations,redoAnnotations}=await import('../.sites-runtime/tests/unit/history.mjs');
const {writerInitials}=await import('../.sites-runtime/tests/unit/initials.mjs');
const {inlineRuns,inlineSlice}=await import('../.sites-runtime/tests/unit/manuscript.mjs');
let assertions=0;
const ok=(value,message)=>{assert.ok(value,message);assertions++;};
const rejected=async(fn,status)=>{await assert.rejects(fn,e=>e.status===status);assertions++;};
const picture=safePicture();
ok(avatarPng(picture).length>33,'valid PNG accepted');
for(const bad of ['data:image/svg+xml;base64,PHN2Zz4=', 'data:image/png;base64,YWJj',picture.replace('base64,','base64,!!!')]) {assert.throws(()=>avatarPng(bad));assertions++;}
ok(writerInitials('Theo Morgan')==='TM'&&writerInitials('River')==='RI'&&writerInitials('')==='WR','two pen-name initials');
const runs=inlineRuns('A **quiet blue** morning, *again*, __underlined__. 2 * 3');
ok(runs.map(r=>r.text).join('')==='A quiet blue morning, again, underlined. 2 * 3','manuscript offsets follow visible formatting and preserve literal asterisks');
const slice=inlineSlice(runs,4,10);
ok(slice.map(r=>r.text).join('')==='iet bl'&&slice.every(r=>r.style==='strong'),'partial annotation preserves bold formatting without exposed markers');
let history=annotationHistory();
const first={id:'local-1',kind:'comment',body:'Clear image.',start:0,end:10};
history=editAnnotations(history,[first]);history=editAnnotations(history,[]);
history=undoAnnotations(history);ok(history.present[0]===first,'undo deletion restores full comment and anchor');
history=undoAnnotations(history);ok(history.present.length===0,'undo creation removes comment');
history=redoAnnotations(history);ok(history.present[0]===first,'redo recreates exact anchor');
history=editAnnotations(history,[first,{id:'local-2',kind:'highlight'}]);
ok(history.future.length===0,'new edit clears redo branch');
ok(redoAnnotations(history)===history,'redo boundary preserves state');
ok(undoAnnotations(annotationHistory()) .present.length===0,'empty undo is harmless');
const realFetch=globalThis.fetch, previousKey=process.env.GOOGLE_VISION_API_KEY;
try {
 delete process.env.GOOGLE_VISION_API_KEY;await rejected(()=>screenAvatar(picture),503);
 process.env.GOOGLE_VISION_API_KEY='mock-server-only-key';
 let likelihood={adult:'VERY_UNLIKELY',racy:'UNLIKELY',violence:'POSSIBLE'};
 globalThis.fetch=async(url,options)=>{ok(url==='https://vision.googleapis.com/v1/images:annotate'&&!url.includes(process.env.GOOGLE_VISION_API_KEY),'key stays out of URL');const request=JSON.parse(options.body);ok(request.requests[0].features[0].type==='SAFE_SEARCH_DETECTION','only SafeSearch requested');return Response.json({responses:[{safeSearchAnnotation:likelihood}]});};
 await screenAvatar(picture);assertions++;
 for(const category of ['adult','racy','violence']) {likelihood={adult:'UNLIKELY',racy:'UNLIKELY',violence:'UNLIKELY',[category]:'LIKELY'};await rejected(()=>screenAvatar(picture),422);}
 likelihood={adult:'UNKNOWN',racy:'UNLIKELY',violence:'UNLIKELY'};await rejected(()=>screenAvatar(picture),422);
 globalThis.fetch=async()=>Response.json({responses:[{error:{code:3}}]});await rejected(()=>screenAvatar(picture),422);
 globalThis.fetch=async()=>new Response('',{status:503});await rejected(()=>screenAvatar(picture),503);
 globalThis.fetch=async()=>new Response('not json');await rejected(()=>screenAvatar(picture),503);
 globalThis.fetch=async()=>{throw new Error('offline')};await rejected(()=>screenAvatar(picture),503);
 console.log(`${assertions} avatar/history assertions passed.`);
} finally {globalThis.fetch=realFetch;if(previousKey===undefined)delete process.env.GOOGLE_VISION_API_KEY;else process.env.GOOGLE_VISION_API_KEY=previousKey;}
