import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {build} from 'esbuild';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
mkdirSync('.sites-runtime/tests/credit-unit',{recursive:true});
await build({entryPoints:{policy:'lib/critique-rubric.ts',view:'components/critique-quality.tsx'},outdir:'.sites-runtime/tests/credit-unit',
  outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',packages:'external',jsx:'automatic'});
const {critiqueCreditDecision}=await import('../.sites-runtime/tests/credit-unit/policy.mjs');
const {CritiqueQuality}=await import('../.sites-runtime/tests/credit-unit/view.mjs');
const decision=(grounding,relevance,rationale,usefulness)=>critiqueCreditDecision({grounding,relevance,rationale,usefulness});
assert.equal(decision(2,2,2,2).eligible,false);
assert.equal(decision(2.01,2.01,2.01,2.01).eligible,true);
assert.equal(decision(1.99,4,4,4).eligible,false);
assert.equal(decision(4,4,4,1.99).eligible,false);
assert.equal(decision(4,1.99,4,4).eligible,false);assert.equal(decision(4,4,1.99,4).eligible,false);
assert.equal(decision(2,2.2,2.2,2).eligible,true,'floors may equal two while the mean must exceed it');
assert.equal(decision(NaN,4,4,4).eligible,false);
assert.equal(decision(Infinity,4,4,4).eligible,false);
assert.equal(decision(-0.01,4,4,4).eligible,false);
assert.equal(decision(4.01,4,4,4).eligible,false);
// Decimal boundary and tiny legitimate differences cannot depend on display rounding.
assert.equal(decision(2.8,1.4,1.4,2.4).eligible,false);
assert.equal(decision(2.3,1.1,1.9,2.7).mean,2);
assert.equal(decision(2,2,2,2.000001).eligible,true);
assert.equal(decision(2,1.999999,2,2).eligible,false);
const markup=scores=>renderToStaticMarkup(React.createElement(CritiqueQuality,{content:'The cup remains.',
  draft:{overall:'A specific observation.',strengths:'',suggestions:'',annotations:[]},enabled:true,
  check:{current:{result:{scores,credit:critiqueCreditDecision(scores)}},waiting:false}}));
const exact=markup({grounding:2,relevance:2,rationale:2,usefulness:2});
assert.equal((exact.match(/<strong>/g)||[]).length,4,'all four numeric categories remain visible');
assert.ok(exact.includes('Average 2/4')&&exact.includes('Below the credit quality requirement'));
const failed=markup({grounding:1.99,relevance:4,rationale:4,usefulness:4});
assert.ok(failed.includes('1.99')&&failed.includes('Below the credit quality requirement'),'display must reveal a near-floor failure');
const pass=markup({grounding:2.01,relevance:2.01,rationale:2.01,usefulness:2.01});
assert.ok(pass.includes('Quality requirement met; checked again when you share'));
const reportPath='tests/fixtures/critique-eval-broad-results.json';
try{
 const report=JSON.parse(readFileSync(reportPath,'utf8'));
 for(const row of report.comparisons)if(critiqueCreditDecision(row.current.scores).eligible)assert.equal(row.current.credit.eligible,true);
}catch(error){if(error.code!=='ENOENT')throw error;}
console.log('Credit policy and rendered score UI passed: strict decimal threshold, floors, invalid scores, visible categories and final-check copy.');
