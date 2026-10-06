import assert from 'node:assert/strict';
import pg from 'pg';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
if(existsSync('.env'))process.loadEnvFile('.env');
const pool=new pg.Pool({connectionString:process.env.TEST_DATABASE_URL||process.env.DATABASE_URL,max:1});
const schema='opendraft_queue_test_'+randomUUID().replaceAll('-','');
const client=await pool.connect();
try {
 await client.query('BEGIN');await client.query(`CREATE SCHEMA "${schema}"`);await client.query(`SET LOCAL search_path TO "${schema}"`);
 const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
 await client.query(journal.entries.map(e=>readFileSync(`drizzle/${e.tag}.sql`,'utf8').replaceAll('REFERENCES "public".',`REFERENCES "${schema}".`)).join('\n'));
 mkdirSync('.sites-runtime/tests',{recursive:true});
 await build({entryPoints:['lib/queue-forecast.ts'],outfile:'.sites-runtime/tests/queue-postgres.mjs',bundle:true,format:'esm',platform:'node',packages:'external'});
 const {queueForecasts}=await import('../.sites-runtime/tests/queue-postgres.mjs');
 await build({entryPoints:['lib/rate-limit.ts'],outfile:'.sites-runtime/tests/queue-rate.mjs',bundle:true,format:'esm',platform:'node',packages:'external'});
 const {rateLimitCooldown}=await import('../.sites-runtime/tests/queue-rate.mjs');
 const db={prepare(text){return {bind(...params){let i=0;const sql=text.replace(/\?/g,()=>'$'+(++i));return {async first(){return (await client.query(sql,params)).rows[0]||null;},async all(){return {results:(await client.query(sql,params)).rows};}};},async first(){return (await client.query(text)).rows[0]||null;}};}};
 const now=Date.now(),day=86400000;
 await rateLimitCooldown(db,'synthetic-cadence',30000,29999);
 await assert.rejects(()=>rateLimitCooldown(db,'synthetic-cadence',30000,30001),error=>error.status===429);
 await assert.rejects(()=>rateLimitCooldown(db,'synthetic-cadence',30000,59998),error=>error.status===429);
 await rateLimitCooldown(db,'synthetic-cadence',30000,59999);
 await client.query("INSERT INTO profiles(id,name,email,created_at,terms_version) VALUES('synthetic','Writer','synthetic@example.test',$1,'2026-10-06')",[now]);
 const queued={id:'queued-work',genre:'Poetry',status:'queued',queuePosition:2,targetReviews:4,reviews:1};
 assert.equal((await queueForecasts(db,[queued],now))[0].completionForecast,null);
 await client.query("UPDATE settings SET value=$1 WHERE id='queue-observation-start'",[String(now-10*day)]);
 for(let i=0;i<3;i++){
  await client.query("INSERT INTO works(id,author_id,author,title,genre,kind,stage,content,request,status,created_at,words,target_reviews) VALUES($1,'synthetic','Writer','Forecast fixture','Poetry','Poem','Revision','Test content','Test request','queued',$2,2,2)",['finished-'+i,now-5*day]);
  await client.query("UPDATE works SET status='spotlight' WHERE id=$1",['finished-'+i]);
  await client.query("INSERT INTO work_flow_events(work_id,kind,genre,target_reviews,created_at) VALUES($1,'completed','Poetry',2,$2)",['finished-'+i,now-day]);
 }
 const forecast=(await queueForecasts(db,[queued],now))[0].completionForecast;
 assert.ok(forecast.lowMs>0&&forecast.highMs>forecast.lowMs);assert.equal(forecast.promotionsPerDay,.3);assert.equal(forecast.completionsPerDay,.3);
 assert.equal((await queueForecasts(db,[{...queued,genre:'Drama'}],now))[0].completionForecast,null,'genre estimates never borrow unrelated activity');
 await client.query('UPDATE work_flow_events SET created_at=$1',[now-31*day]);
 assert.equal((await queueForecasts(db,[queued],now))[0].completionForecast,null,'old activity cannot create a current estimate');
 console.log('PostgreSQL queue forecast tests passed: real promotion trigger, observation window, both velocities, genre isolation, and stale-history exclusion.');
} finally {
 await client.query('ROLLBACK');client.release();await pool.end();
}
