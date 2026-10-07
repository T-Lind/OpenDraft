import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/focus-mode.ts'],outfile:'.sites-runtime/tests/focus-mode.mjs',bundle:true,format:'esm',platform:'node'});
const {createFocusMode}=await import('../.sites-runtime/tests/focus-mode.mjs');
function browser({refuse=false,supported=true,delayed=false}={}) {
  const doc=new EventTarget();doc.fullscreenEnabled=supported;doc.fullscreenElement=null;
  let requests=0,exits=0,grant;
  const root={dataset:{}};doc.documentElement=root;
  const show=()=>{doc.fullscreenElement=root;doc.dispatchEvent(new Event('fullscreenchange'));};
  if(supported)root.requestFullscreen=options=>{
    requests++;assert.equal(options.navigationUI,'hide');
    if(refuse)return Promise.reject(new Error('Browser denied fullscreen'));
    if(delayed)return new Promise(resolve=>{grant=()=>{show();resolve();};});
    show();return Promise.resolve();
  };
  doc.exitFullscreen=()=>{exits++;doc.fullscreenElement=null;doc.dispatchEvent(new Event('fullscreenchange'));return Promise.resolve();};
  const changes=[],session=createFocusMode(doc,active=>changes.push(active));
  return {doc,root,session,changes,requests:()=>requests,exits:()=>exits,grant:()=>grant()};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
{
 const b=browser();b.session.enter();assert.equal(b.requests(),1);assert.equal(b.root.dataset.opendraftFocus,'true');assert.equal(b.doc.fullscreenElement,b.root);
 b.session.toggle();assert.deepEqual(b.changes,[true,false]);assert.equal(b.exits(),1);assert.equal(b.root.dataset.opendraftFocus,undefined);b.session.dispose();
}
{
 const b=browser();b.session.enter();await b.doc.exitFullscreen();assert.deepEqual(b.changes,[true,false],'browser Escape/fullscreen exit restores the app layout');assert.equal(b.root.dataset.opendraftFocus,undefined);b.session.dispose();
}
for(const options of [{refuse:true},{supported:false}]) {
 const b=browser(options);b.session.enter();await tick();assert.equal(b.root.dataset.opendraftFocus,'true','focus layout survives unsupported or denied fullscreen');
 const escape=new Event('keydown');Object.defineProperty(escape,'key',{value:'Escape'});b.doc.dispatchEvent(escape);
 assert.deepEqual(b.changes,[true,false]);assert.equal(b.root.dataset.opendraftFocus,undefined);b.session.dispose();
}
{
 const b=browser();b.session.enter();b.session.dispose();assert.equal(b.root.dataset.opendraftFocus,undefined);assert.equal(b.doc.fullscreenElement,null,'leaving the view exits fullscreen');assert.deepEqual(b.changes,[true],'unmount does not update React state');
}
{
 const b=browser({delayed:true});b.session.enter();b.session.exit();b.grant();await tick();assert.equal(b.doc.fullscreenElement,null,'a late fullscreen grant is undone after leaving focus mode');assert.equal(b.root.dataset.opendraftFocus,undefined);b.session.dispose();
}
console.log('Focus mode lifecycle passed: click enter/exit, browser exit, denied/unsupported fullscreen, Escape fallback, navigation cleanup, and late fullscreen grants.');
