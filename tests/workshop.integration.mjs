import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import pg from 'pg';
process.loadEnvFile('.env');
const databaseURL=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
if(!databaseURL)throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to a PostgreSQL database.');
const pool=new pg.Pool({connectionString:databaseURL,max:8});
const testSchema='opendraft_test_'+randomUUID().replaceAll('-','');
const identity=new AsyncLocalStorage();
let assertions=0;
const ok=(condition,message)=>{assert.ok(condition,message);assertions++;};
const query=async(text,params=[])=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${testSchema}"`);const result=await c.query(text,params);await c.query('COMMIT');return result;}finally{c.release();}};
function lazy(text,params=[]){return{text,params,then:(yes,no)=>query(text,params).then(yes,no)}};
globalThis.__opendraftTest={env:{DATABASE_URL:databaseURL},identity,driver:{query:lazy,async transaction(statements){const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${testSchema}"`);const results=[];for(const s of statements)results.push(await c.query(s.text==='SET LOCAL search_path TO public'?`SET LOCAL search_path TO "${testSchema}"`:s.text,s.params));await c.query('COMMIT');return results;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}}};
try{
 await pool.query(`CREATE SCHEMA "${testSchema}"`);
 let migration=readFileSync('drizzle/0000_initial_postgres.sql','utf8').replaceAll('REFERENCES "public".',`REFERENCES "${testSchema}".`);
 const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${testSchema}"`);await c.query(migration);await c.query('COMMIT');}finally{c.release();}
 mkdirSync('.sites-runtime/tests',{recursive:true});
 await build({entryPoints:['app/api/workshop/route.ts'],outfile:'.sites-runtime/tests/route.mjs',bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'integration-adapters',setup(b){b.onResolve({filter:/^(cloudflare:workers|@neondatabase\/serverless|@\/app\/chatgpt-auth)$/},args=>({path:args.path,namespace:'test-adapter'}));b.onLoad({filter:/.*/,namespace:'test-adapter'},args=>({contents:args.path==='cloudflare:workers'?'export const env=globalThis.__opendraftTest.env;':args.path==='@neondatabase/serverless'?'export const neon=()=>globalThis.__opendraftTest.driver;':'export async function getChatGPTUser(){return globalThis.__opendraftTest.identity.getStore()||null;}',loader:'js'}));b.onResolve({filter:/^@\//},args=>({path:resolve(args.path.slice(2)+'.ts')}));}}]});
 const api=await import('../.sites-runtime/tests/route.mjs');
 const user=id=>({userId:id,email:id+'@opendraft.test',fullName:id,displayName:id});
 const read=async(id)=>identity.run(id?user(id):null,async()=>{const r=await api.GET();return{status:r.status,data:await r.json()}});
 const action=async(id,body,origin='https://opendraft.test')=>identity.run(id?user(id):null,async()=>{const r=await api.POST(new Request('https://opendraft.test/api/workshop',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)}));return{status:r.status,data:await r.json()}});
 const work=(id,title='Test draft')=>({id,title,genre:'Literary fiction',kind:'Short story',stage:'First draft',content:'An original integration-test passage. Nothing here belongs in the live workshop.',request:'Does the opening engage the reader?',warning:''});
 const critique=id=>({action:'review',review:{workId:id,strengths:'The opening image gives the reader a clear place to stand. The quiet domestic details establish the relationship without exposition, and the dialogue makes the conflict feel specific. I especially liked the repeated image because it provides a thread through the scene.',suggestions:'I would give the middle of the scene a little more room to breathe. One additional concrete detail about the narrator’s reaction might connect the physical setting to the underlying tension. Consider varying the sentence lengths so the strongest emotional beat has more space.',overall:'The story has a confident voice and an engaging central question. In another draft I would focus on the transition into the ending, while preserving the restrained tone and the precise visual details.',quote:'',annotation:''}});
 let r=await read('alice');ok(r.status===200,'snapshot loads');ok(r.data.user.credits===5,'five starting credits');ok(r.data.works.length===6,'six seeded examples');ok(r.data.works.filter(w=>w.status==='spotlight').length===4,'four spotlight slots');
 r=await action(null,{action:'bookmark',workId:'the-last-light',saved:true});ok(r.status===401,'anonymous write denied');r=await action('alice',{action:'bookmark',workId:'the-last-light',saved:true},'https://attacker.test');ok(r.status===403,'cross-origin write denied');
 r=await action('alice',{action:'saveDraft',work:work('alice-private')});ok(r.status===200,'private draft saved');ok(r.data.user.credits===5,'draft costs no credits');ok(!(await read('bob')).data.works.some(w=>w.id==='alice-private'),'private draft hidden from other users');
 r=await action('bob',{action:'saveDraft',work:work('alice-private','Hijacked')});ok(r.status===403,'editing another writer’s work denied');
 r=await action('alice',{action:'publish',work:work('alice-private')});ok(r.status===200&&r.data.user.credits===0,'publication debits five credits');ok(r.data.works.find(w=>w.id==='alice-private').status==='queued','publication queues when spotlight is full');
 r=await action('alice',{action:'publish',work:work('alice-private')});ok(r.status===403||r.status===409,'repeat publication cannot debit again');
 r=await action('alice',{action:'publish',work:work('no-credit-work')});ok(r.status===409,'insufficient balance denied');
 r=await action('alice',critique('alice-private'));ok(r.status===400,'own-work critique denied');
 r=await action('alice',{action:'review',review:{workId:'the-last-light',strengths:'A'.repeat(40),suggestions:'B'.repeat(40),overall:'C'.repeat(30)}});ok(r.status===400,'critique word minimum enforced');
 r=await action('bob',critique('the-last-light'));ok(r.status===200&&r.data.user.credits===7,'spotlight critique rewards two credits');
 r=await action('bob',critique('the-last-light'));ok(r.status===409,'duplicate critique denied');ok((await read('bob')).data.user.credits===7,'duplicate critique preserves balance');
 const result=await Promise.all([action('carol',critique('the-last-light')),action('dan',critique('the-last-light'))]);if(!result.every(x=>x.status===200))console.log(result.map(x=>({status:x.status,error:x.data.error})));ok(result.every(x=>x.status===200),'concurrent critiques both commit');r=await read('alice');ok(r.data.works.find(w=>w.id==='the-last-light').status==='open','three critiques retire spotlight work');ok(r.data.works.filter(w=>w.status==='spotlight').length===4,'queue replenishes four slots');ok(r.data.works.find(w=>w.id==='room-number-four').status==='spotlight','oldest queued work promoted');
 r=await action('eve',critique('the-last-light'));ok(r.status===200&&r.data.user.credits===6,'non-spotlight critique earns one credit');
 const published=await Promise.all([action('frank',{action:'publish',work:work('race-a')}),action('frank',{action:'publish',work:work('race-b')})]);ok(published.filter(x=>x.status===200).length===1,'concurrent publishing spends one available balance');r=await read('frank');ok(r.data.user.credits===0,'concurrent publishing cannot make balance negative');ok(r.data.works.filter(w=>['race-a','race-b'].includes(w.id)).length===1,'only funded work is published');
 const reviewRace=await Promise.all([action('grace',critique('atlas-of-elsewhere')),action('grace',critique('atlas-of-elsewhere'))]);ok(reviewRace.filter(x=>x.status===200).length===1,'concurrent duplicate critique awards once');ok((await read('grace')).data.user.credits===7,'one reward from concurrent duplicate review');
 r=await action('alice',{action:'bookmark',workId:'atlas-of-elsewhere',saved:true});ok(r.status===200&&r.data.bookmarks.includes('atlas-of-elsewhere'),'bookmark persisted');r=await read('alice');ok(r.data.bookmarks.includes('atlas-of-elsewhere'),'bookmark survives new snapshot');
 r=await action('alice',{action:'join',circleId:'fiction-room',joined:true});ok(r.status===200&&r.data.circles.find(c=>c.id==='fiction-room').joined,'circle membership persisted');r=await action('alice',{action:'post',circleId:'fiction-room',body:'A test discussion about narrative voice.'});ok(r.status===200,'circle discussion saved');r=await action('bob',{action:'post',circleId:'fiction-room',body:'Unauthorized circle post.'});ok(r.status===403,'nonmember posting denied');
 r=await action('alice',{action:'profile',name:'Alice Writer',bio:'I write small stories.'});ok(r.status===200&&r.data.user.name==='Alice Writer','profile edits persisted');ok(r.data.works.find(w=>w.id==='alice-private').author==='Alice Writer','work attribution follows profile name');
 const review=r.data.reviews.find(x=>x.workId==='the-last-light');r=await action('alice',{action:'helpful',reviewId:review.id,helpful:true});ok(r.status===403,'only author may mark a critique helpful');
 r=await action('bob',critique('alice-private'));ok(r.status===200,'another writer critiques published work');const ownReview=r.data.reviews.find(x=>x.workId==='alice-private');r=await action('alice',{action:'helpful',reviewId:ownReview.id,helpful:true});ok(r.status===200&&r.data.reviews.find(x=>x.id===ownReview.id).helpful===1,'author marks feedback helpful');
 r=await action('alice',{action:'report',workId:'the-last-light',reason:'Test moderation report, isolated from live content.'});ok(r.status===200,'report recorded');
 r=await action('alice',{action:'withdraw',workId:'alice-private'});ok(r.status===200,'owner withdrawal succeeds');ok(!(await read('bob')).data.works.some(w=>w.id==='alice-private'),'withdrawn work hidden from other readers');ok((await read('alice')).data.reviews.some(x=>x.workId==='alice-private'),'feedback retained for author');
 console.log(`${assertions} PostgreSQL integration assertions passed, including concurrent credit and review transactions.`);
}finally{
 await pool.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
 await pool.end();delete globalThis.__opendraftTest;
}


