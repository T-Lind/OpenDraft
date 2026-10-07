import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/jev.ts'],outfile:'.sites-runtime/tests/zero-spend.mjs',bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'member-boundary',setup(b){b.onResolve({filter:/^\.\/member$/},()=>({path:'member',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const fail=(message,status)=>{throw Object.assign(new Error(message),{status})}',loader:'js'}));}}]});
const {evaluateCritique,evaluateContentThemes,evaluateShowcase}=await import('../.sites-runtime/tests/zero-spend.mjs');
const original=process.env.OPENDRAFT_PAID_CHECKS_ENABLED,fetchOriginal=globalThis.fetch;
let requests=0;
try{
 process.env.OPENDRAFT_PAID_CHECKS_ENABLED='false';
 globalThis.fetch=async()=>{requests++;throw new Error('Paid request must never run');};
 const draft={overall:'Human feedback',strengths:'',suggestions:'',annotations:[]};
 for(const run of [()=>evaluateCritique('Manuscript','Request',draft,'synthetic-runtime-oidc'),()=>evaluateContentThemes('Manuscript','synthetic-runtime-oidc'),()=>evaluateShowcase('Manuscript','Request','synthetic-runtime-oidc')])await assert.rejects(run,error=>error.status===503&&error.message.startsWith('OpenDraft'));
 assert.equal(requests,0,'disabled checks block every paid path before token fallback or HTTP');
}finally{globalThis.fetch=fetchOriginal;if(original===undefined)delete process.env.OPENDRAFT_PAID_CHECKS_ENABLED;else process.env.OPENDRAFT_PAID_CHECKS_ENABLED=original;}
console.log('Zero-spend checks passed: critique, content themes and showcase make no Gateway requests, including OIDC fallback.');
