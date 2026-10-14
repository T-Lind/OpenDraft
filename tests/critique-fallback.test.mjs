import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {build} from 'esbuild';
mkdirSync('.sites-runtime/tests/fallback',{recursive:true});
await build({entryPoints:['lib/critique-fallback.ts'],outfile:'.sites-runtime/tests/fallback/fallback.mjs',bundle:true,format:'esm',platform:'node'});
const {evaluateCritiqueStructurally,structuralFallbackEnabled}=await import('../.sites-runtime/tests/fallback/fallback.mjs');

const content='The light stays on.\n\nShe leaves the house.';
const draft=(overall,annotations=[])=>({overall,strengths:'',suggestions:'',annotations});
const compliant=Array.from({length:175},(_,i)=>'distinct'+i).join(' ');
let result=evaluateCritiqueStructurally(content,draft(compliant),175);
assert.equal(result.credit.eligible,true,'a substantive critique qualifies under the structural fallback');
assert.equal(result.fallback,true,'the fallback assessment is marked for audit');
assert.equal(result.rubric,'critique-structure-fallback-v1');

result=evaluateCritiqueStructurally(content,draft(compliant),174);
assert.equal(result.credit.eligible,false,'the fallback respects the 175-word credit floor');

const repeatedSentence='this is a repeated sentence about the very same idea';
result=evaluateCritiqueStructurally(content,draft(Array.from({length:40},()=>repeatedSentence).join('. ')),175);
assert.equal(result.credit.eligible,false,'the fallback rejects padding by exact repetition');

// A delete suggestion with no rationale is ineligible; a >=6-word reason qualifies.
const anchor=(kind,body)=>({kind,quote:'The light',body,para:0,start:0,end:9});
result=evaluateCritiqueStructurally(content,draft(compliant,[anchor('delete','No reason')]),175);
assert.equal(result.credit.eligible,false,'unexplained cuts fail the structural fallback');
result=evaluateCritiqueStructurally(content,draft(compliant,[anchor('delete','This clause repeats the previous line, so the cut sharpens the ending.')]),175);
assert.equal(result.credit.eligible,true,'an explained cut passes the structural fallback');

delete process.env.OPENDRAFT_STRUCTURAL_FALLBACK;
assert.equal(structuralFallbackEnabled(),true,'the structural fallback is enabled by default');
process.env.OPENDRAFT_STRUCTURAL_FALLBACK='false';
assert.equal(structuralFallbackEnabled(),false,'an operator can require the automated evaluator');
delete process.env.OPENDRAFT_STRUCTURAL_FALLBACK;
console.log('Structural credit fallback passed: word floor, repetition padding, unexplained redlines, audit marker, and operator override.');
