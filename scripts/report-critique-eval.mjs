// Summarize saved LIVE broad runs; this script makes no provider or database calls.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const fixturePath='tests/fixtures/critique-eval-broad.json';
const fixtures=JSON.parse(readFileSync(fixturePath,'utf8'));
const readRun=name=>JSON.parse(readFileSync(`.sites-runtime/evaluations/critique-${name}.json`,'utf8'));
const legacy=readRun('legacy-broad-v2');
const development=readRun('baseline-broad-v2');
const final=readRun('baseline-broad-v2-final');
const repeated=readRun('baseline-broad-v2-final-repeats');
for(const run of [legacy,development,final,repeated])if(run.results.some(row=>row.error))throw new Error('Incomplete run');
if(final.results.length!==fixtures.cases.length||legacy.results.length!==fixtures.cases.length)throw new Error('Missing cases');
const summarizeRow=row=>({id:row.id,repeat:row.repeat,scores:row.scores,mean:row.mean,credit:row.credit,
  latencyMs:row.latencyMs,inputTokens:row.transport?.usage?.inputTokens,cost:row.transport?.cost});
const classify=run=>{
 const rows=fixtures.cases.filter(sample=>typeof sample.expectedEligibility==='boolean').map(sample=>({
   expected:sample.expectedEligibility,row:run.results.find(row=>row.id===sample.id),
 }));
 return {specifiedExpectations:rows.length,matched:rows.filter(({expected,row})=>row.credit.eligible===expected).length,
   differences:rows.filter(({expected,row})=>row.credit.eligible!==expected).map(({expected,row})=>({id:row.id,expected,...summarizeRow(row)}))};
};
const stability=[...new Set(repeated.results.map(row=>row.id))].map(id=>{
 const rows=repeated.results.filter(row=>row.id===id);
 return {id,meanRange:[Math.min(...rows.map(row=>row.mean)),Math.max(...rows.map(row=>row.mean))],
   eligibility:rows.map(row=>row.credit.eligible),stable:new Set(rows.map(row=>row.credit.eligible)).size===1};
});
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const report={generatedAt:new Date().toISOString(),model:'typesafe-ai/jev',rubric:'critique-substance-v2',
 notice:fixtures.notice,
 scope:{cases:fixtures.cases.length,works:Object.keys(fixtures.works).length,
   longestManuscriptWords:Math.max(...Object.values(fixtures.works).map(work=>work.content.split(/\s+/).length)),
   storedRequests:[legacy,development,final,repeated].reduce((sum,run)=>sum+run.results.length,0)},
 policy:{minimumWords:175,meanStrictlyAbove:2,groundingAtLeast:2,usefulnessAtLeast:2,usesRawScores:true},
 limitations:[
   'Synthetic English and Spanish cases, with provisional test-author labels rather than independent human judgments. Matching these expectations is not an accuracy estimate for member critiques.',
   'The first 27 cases informed initial rubric development. The larger run exposed a filler loophole; usefulness was revised and the full corpus rerun. This is development and regression evidence, not an independent held-out validation set.',
   'Labels assess quality only. Short critiques can pass quality but still earn zero under the separate 175-word rule.',
   'Long-ledger is a 3,935-word procedurally repeated context stress text, not representative of every long manuscript.',
   'Repeated checks cover ten selected cases only; stability here does not guarantee identical future model results.',
 ],
 findings:{previousRubric:classify(legacy),beforeFillerFix:classify(development),finalRubric:classify(final),stability,
   fillerFix:{before:summarizeRow(development.results.find(row=>row.id==='one-useful-plus-empty-padding')),
     after:summarizeRow(final.results.find(row=>row.id==='one-useful-plus-empty-padding'))}},
 reproduction:{generate:'node tests/fixtures/build-critique-eval-broad.mjs',
   previous:'node scripts/evaluate-critique.mjs --legacy --fixtures=tests/fixtures/critique-eval-broad.json --label=broad-v2',
   current:'node scripts/evaluate-critique.mjs --fixtures=tests/fixtures/critique-eval-broad.json --label=broad-v2-final',
   repeats:'node scripts/evaluate-critique.mjs --fixtures=tests/fixtures/critique-eval-broad.json --label=broad-v2-final --cases='+stability.map(row=>row.id).join(',')+' --repeat=3',
   summarize:'node scripts/report-critique-eval.mjs',
   warning:'Evaluation commands call live Jev and incur Gateway usage. Generating fixtures and summarizing saved results are offline.',
   sha256:Object.fromEntries([fixturePath,'lib/critique-rubric.ts','lib/jev.ts','scripts/evaluate-critique.mjs'].map(path=>[path,hash(path)]))},
 questions:{previous:legacy.questions,current:final.questions},
 comparisons:fixtures.cases.map(sample=>({id:sample.id,work:sample.work,expectedEligibility:sample.expectedEligibility,
   previous:summarizeRow(legacy.results.find(row=>row.id===sample.id)),current:summarizeRow(final.results.find(row=>row.id===sample.id))})),
 repeated:repeated.results.map(summarizeRow),
};
writeFileSync('tests/fixtures/critique-eval-broad-results.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({scope:report.scope,previous:report.findings.previousRubric,final:report.findings.finalRubric,
  stableCases:stability.filter(row=>row.stable).length},null,2));
