// Opt-in LIVE evaluation: sends synthetic fixtures to Jev and incurs Gateway usage.
// node scripts/evaluate-critique.mjs [--legacy|--candidate|--rubric-only|--refined]
// Optional: --smoke, --cases=id1,id2, --repeat=1 (maximum 3), --dry-run.
// Default: 27 requests. --fixtures=path --label=name select and preserve broad runs.
// Never included in npm test or submitted as member critiques.
import {build} from 'esbuild';
import {readFileSync, writeFileSync, mkdirSync, existsSync} from 'node:fs';
import {candidateQuestions, refinedQuestions, legacyQuestions, candidateState} from './critique-rubric-candidate.mjs';

const args = process.argv.slice(2);
const modes = args.filter(arg => ['--legacy','--candidate', '--rubric-only', '--refined'].includes(arg));
if (modes.length > 1) throw new Error('Choose one rubric variant.');
for (const arg of args) {
  if (!['--legacy','--candidate', '--rubric-only', '--refined', '--smoke', '--dry-run'].includes(arg)
    && !['--cases=','--repeat=','--fixtures=','--label='].some(prefix=>arg.startsWith(prefix))) throw new Error('Unknown option: ' + arg);
}
const variant = modes[0]?.slice(2) || 'baseline';
const repeats = Number((args.find(arg => arg.startsWith('--repeat=')) || '--repeat=1').slice(9));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw new Error('Repeat must be an integer from 1 to 3.');
const selected = (args.find(arg => arg.startsWith('--cases=')) || '').slice(8).split(',').filter(Boolean);
const fixturePath=(args.find(arg=>arg.startsWith('--fixtures='))||'--fixtures=tests/fixtures/critique-eval.json').slice(11);
const label=(args.find(arg=>arg.startsWith('--label='))||'--label=').slice(8);
if(label&&!/^[a-z0-9-]{1,48}$/.test(label))throw new Error('Label must contain lowercase letters, numbers and hyphens.');
const fixtures = JSON.parse(readFileSync(fixturePath, 'utf8'));
for (const id of selected) if (!fixtures.cases.some(sample => sample.id === id)) throw new Error('Unknown case: ' + id);
const cases = args.includes('--smoke') ? fixtures.cases.slice(0, 1)
  : selected.length ? fixtures.cases.filter(sample => selected.includes(sample.id)) : fixtures.cases;

mkdirSync('.sites-runtime/evaluations', {recursive: true});
await build({
  entryPoints: ['lib/jev.ts', 'lib/critique-quality.ts'],
  outdir: `.sites-runtime/evaluations/bundle-${variant}`, outExtension: {'.js': '.mjs'},
  bundle: true, format: 'esm', platform: 'node', packages: 'external',
  plugins: [{name: 'safe-eval-member', setup(b) {
    b.onResolve({filter: /^\.\/member$/}, () => ({path: 'member', namespace: 'eval'}));
    b.onLoad({filter: /.*/, namespace: 'eval'}, () => ({
      contents: 'export const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status})};', loader: 'js',
    }));
  }}],
});
const {evaluateCritique} = await import(`../.sites-runtime/evaluations/bundle-${variant}/jev.mjs`);
const {manuscriptParagraphs, validQualityNote} = await import(`../.sites-runtime/evaluations/bundle-${variant}/critique-quality.mjs`);
// Preflight every fixture before making paid calls. Quote anchors are resolved using
// the same normalized paragraph text as the application; insertion offsets are exact.
const prepared = cases.map(sample => {
  const work = fixtures.works[sample.work];
  const paragraphs = manuscriptParagraphs(work.content);
  const annotations = (sample.annotations || []).map(note => {
    if (note.kind === 'insert') return {...note};
    const start = paragraphs[note.para]?.plain.indexOf(note.quote) ?? -1;
    return {...note, start, end: start + note.quote.length};
  });
  if (annotations.some(note => !validQualityNote(note, paragraphs))) throw new Error('Invalid synthetic anchor: ' + sample.id);
  return {sample, work, paragraphs, draft: {
    overall: sample.overall || '', strengths: sample.strengths || '',
    suggestions: sample.suggestions || '', annotations,
  }};
});
console.log(JSON.stringify({variant, cases: cases.length, requests: cases.length * repeats, live: !args.includes('--dry-run')}));
if (!args.includes('--dry-run')) {
  for (const path of ['.env', '.env.local']) if (existsSync(path)) process.loadEnvFile(path);
  const results = [];
  let transport, current,questionsSnapshot;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (variant !== 'baseline') {
      const body = JSON.parse(options.body);
      body.questions = variant === 'legacy' ? legacyQuestions : variant === 'refined' ? refinedQuestions : candidateQuestions;
      if (variant === 'candidate'||variant === 'refined') body.state = candidateState(current.work, current.draft, current.paragraphs);
      options = {...options, body: JSON.stringify(body)};
    }
    questionsSnapshot=JSON.parse(options.body).questions;
    const response = await originalFetch(url, options);
    if (response.ok) {
      const data = await response.clone().json();
      transport = {answers: data.answers, model: data.model, usage: data.usage,
        cost: data.providerMetadata?.gateway?.cost, confidence: data.providerMetadata?.typesafe?.confidence};
    }
    return response;
  };
  try {
    runs: for (let repeat = 1; repeat <= repeats; repeat++) for (current of prepared) {
      transport = undefined;
      const {sample, work, draft} = current;
      const started = Date.now();
      try {
        const result = await evaluateCritique(work.content, work.request, draft,null,work);
        const row = {id: sample.id, repeat, expected: sample.expected, scores: result.scores,
          mean: Object.values(result.scores).reduce((a, b) => a + b, 0) / 4,
          expectedEligibility:sample.expectedEligibility,credit:result.credit,latencyMs: Date.now() - started, transport};
        results.push(row);
        console.log(JSON.stringify({...row, transport: undefined}));
      } catch (error) {
        results.push({id: sample.id, repeat, error: error.message, status: error.status || 0});
        console.log(JSON.stringify(results.at(-1)));
        process.exitCode = 1;
        break runs;
      }
    }
  } finally {
    globalThis.fetch = originalFetch;
    writeFileSync(`.sites-runtime/evaluations/critique-${variant}${label?'-'+label:''}${selected.length ? '-repeats' : ''}.json`, JSON.stringify({
      runAt: new Date().toISOString(), notice: fixtures.notice, variant,label,fixturePath,questions:questionsSnapshot,requestedCalls: cases.length * repeats, results,
    }, null, 2));
  }
}
