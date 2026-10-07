import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdirSync} from 'node:fs';
mkdirSync('.sites-runtime/tests',{recursive:true});
await build({entryPoints:['lib/jev.ts'],outfile:'.sites-runtime/tests/zero-spend.mjs',bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'member-boundary',setup(b){b.onResolve({filter:/^\.\/member$/},()=>({path:'member',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const fail=(message,status)=>{throw Object.assign(new Error(message),{status})}',loader:'js'}));}}]});
const {evaluateCritique,evaluateContentThemes,evaluateShowcase}=await import('../.sites-runtime/tests/zero-spend.mjs');
const original=process.env.OPENDRAFT_PAID_CHECKS_ENABLED,originalKey=process.env.AI_GATEWAY_API_KEY,fetchOriginal=globalThis.fetch;
let requests=0;
try{
 process.env.OPENDRAFT_PAID_CHECKS_ENABLED='false';
 globalThis.fetch=async()=>{requests++;throw new Error('Paid request must never run');};
 const draft={overall:'Human feedback',strengths:'',suggestions:'',annotations:[]};
 for(const run of [()=>evaluateCritique('Manuscript','Request',draft,'synthetic-runtime-oidc'),()=>evaluateContentThemes('Manuscript','synthetic-runtime-oidc'),()=>evaluateShowcase('Manuscript','Request','synthetic-runtime-oidc')])await assert.rejects(run,error=>error.status===503&&error.message.startsWith('OpenDraft'));
 assert.equal(requests,0,'disabled checks block every paid path before token fallback or HTTP');
 process.env.OPENDRAFT_PAID_CHECKS_ENABLED='true';
 process.env.AI_GATEWAY_API_KEY='synthetic-test-key';
 globalThis.fetch=async(url,options)=>{
  requests++;
  const body=JSON.parse(options.body);
  assert.equal(url,'https://ai-gateway.vercel.sh/v1/evaluate');
  assert.equal(body.model,'typesafe-ai/jev','enabled checks must use Jev specifically');
  assert.deepEqual(body.providerOptions.gateway,{disallowPromptTraining:true,only:['typesafe-ai']});
  return Response.json({answers:Object.fromEntries(Object.keys(body.questions).map(key=>[key,{score:key.startsWith('theme')?0:3}]))});
 };
 const critique=await evaluateCritique('Manuscript','Request',draft,'synthetic-runtime-oidc');
 assert.equal(critique.credit.eligible,true,'enabled critique scoring restores credit eligibility');
 assert.deepEqual((await evaluateContentThemes('Manuscript','synthetic-runtime-oidc')).suggestions,[]);
 assert.equal((await evaluateShowcase('Manuscript','Request','synthetic-runtime-oidc')).model,'typesafe-ai/jev');
 assert.equal(requests,3,'enabling checks restores each Gateway evaluator');
}finally{globalThis.fetch=fetchOriginal;if(original===undefined)delete process.env.OPENDRAFT_PAID_CHECKS_ENABLED;else process.env.OPENDRAFT_PAID_CHECKS_ENABLED=original;if(originalKey===undefined)delete process.env.AI_GATEWAY_API_KEY;else process.env.AI_GATEWAY_API_KEY=originalKey;}
console.log('Gateway switch checks passed: disabled paths make no requests; enabled critique, theme and showcase checks use Jev with no-training routing.');
