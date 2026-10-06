import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {readFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import pg from 'pg';
if(existsSync('.env'))process.loadEnvFile('.env');
const databaseURL=process.env.TEST_DATABASE_URL||process.env.DATABASE_URL;
if(!databaseURL)throw new Error('Set TEST_DATABASE_URL or DATABASE_URL to a PostgreSQL database.');
Object.assign(process.env,{DATABASE_URL:databaseURL,AUTH_SECRET:process.env.AUTH_SECRET||'integration-secret-'.repeat(3),NODE_ENV:'development',RESEND_API_KEY:'',AUTH_EMAIL_FROM:''});
const pool=new pg.Pool({connectionString:databaseURL,max:8});
const testSchema='opendraft_test_'+randomUUID().replaceAll('-','');
const identity=new AsyncLocalStorage();
const originalFetch=globalThis.fetch;
const originalVisionKey=process.env.GOOGLE_VISION_API_KEY;
const originalAdminEmails=process.env.ADMIN_EMAILS;
let assertions=0;
const ok=(condition,message)=>{assert.ok(condition,message);assertions++;};
const query=async(text,params=[])=>{const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${testSchema}"`);const result=await c.query(text,params);await c.query('COMMIT');return result;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}};
function lazy(text,params=[]){return{text,params,then:(yes,no)=>query(text,params).then(yes,no)}};
globalThis.__opendraftTest={env:{DATABASE_URL:databaseURL},identity,session:null,driver:{query:lazy,async transaction(statements){const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${testSchema}"`);const results=[];for(const s of statements)results.push(await c.query(s.text==='SET LOCAL search_path TO public'?`SET LOCAL search_path TO "${testSchema}"`:s.text,s.params));await c.query('COMMIT');return results;}catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}}}};
globalThis.__opendraftTest.creditScores={grounding:3,relevance:3,rationale:2,usefulness:3};
globalThis.__opendraftTest.creditCalls=[];
try{
 await pool.query(`CREATE SCHEMA "${testSchema}"`);
 const journal=JSON.parse(readFileSync('drizzle/meta/_journal.json','utf8'));
 const migration=journal.entries.map(({tag})=>readFileSync(`drizzle/${tag}.sql`,'utf8').replaceAll('REFERENCES "public".',`REFERENCES "${testSchema}".`)).join('\n');
 const c=await pool.connect();try{await c.query('BEGIN');await c.query(`SET LOCAL search_path TO "${testSchema}"`);await c.query(migration);await c.query('COMMIT');}finally{c.release();}
 mkdirSync('.sites-runtime/work-update-tests',{recursive:true});
 await build({entryPoints:{updates:'app/api/work-updates/route.ts',updateMail:'lib/work-updates.ts',unsubscribe:'app/api/work-updates/unsubscribe/route.ts',cronUpdates:'app/api/cron/work-updates/route.ts',route:'app/api/workshop/route.ts',search:'app/api/search/route.ts',avatar:'app/api/avatar/route.ts',notifications:'app/api/notifications/route.ts',export:'app/api/export/route.ts',admin:'app/api/admin/route.ts',author:'app/api/author/route.ts',rate:'lib/rate-limit.ts',storage:'db/storage.ts',community:'app/api/community/route.ts',critiqueCheck:'app/api/critique-check/route.ts',contentCheck:'app/api/content-check/route.ts',contact:'app/api/contact/route.ts',diff:'lib/revision-diff.ts',password:'app/api/auth/password/route.ts',verifyEmail:'app/api/auth/verify/route.ts'},outdir:'.sites-runtime/work-update-tests',outExtension:{'.js':'.mjs'},bundle:true,format:'esm',platform:'node',packages:'external',plugins:[{name:'integration-adapters',setup(b){b.onResolve({filter:/^@\/lib\/jev$/},args=>/[\\/]api[\\/]workshop[\\/]route\.ts$/.test(args.importer)?{path:resolve('tests/credit-evaluator-fixture.mjs')}:undefined);b.onResolve({filter:/^(next\/server|cloudflare:workers|@neondatabase\/serverless|@\/app\/chatgpt-auth|@\/lib\/auth)$/},args=>({path:args.path,namespace:'test-adapter'}));b.onLoad({filter:/.*/,namespace:'test-adapter'},args=>({contents:args.path==='next/server'?'export const after=()=>{};':args.path==='cloudflare:workers'?'export const env=globalThis.__opendraftTest.env;':args.path==='@neondatabase/serverless'?'export const neon=()=>globalThis.__opendraftTest.driver;':args.path==='@/lib/auth'?"export async function getSessionUser(){const u=globalThis.__opendraftTest.identity.getStore();return u?{id:u.userId,email:u.email,name:u.displayName,issuedAt:u.issuedAt}:null;} export function readEnv(k){return process.env[k];} export function googleConfigured(){return true;} export async function destroySession(){} export async function createSession(user){globalThis.__opendraftTest.session=user;}":'export async function getChatGPTUser(){return null;}',loader:'js'}));b.onResolve({filter:/^@\//},args=>({path:resolve(args.path.slice(2)+'.ts')}));}}]});
 const api=await import('../.sites-runtime/work-update-tests/route.mjs');
 const sessionTime=Math.floor(Date.now()/1000);
 const user=id=>({userId:id,email:id+'@opendraft.test',fullName:id,displayName:id,issuedAt:sessionTime});
 const prepared=new Set();
 const read=async(id)=>identity.run(id?user(id):null,async()=>{const r=await api.GET();const data=await r.json();if(id&&!prepared.has(id)&&r.status===200){await query("UPDATE profiles SET terms_version='2026-10-06',terms_accepted_at=$1,onboarding_completed=CASE WHEN id='new-google-user' THEN false ELSE true END WHERE id=$2",[Date.now(),id]);prepared.add(id);}return{status:r.status,data}});

 const community=await import('../.sites-runtime/work-update-tests/community.mjs');
 const cAction=async(uid,body)=>identity.run(uid?user(uid):null,async()=>{const response=await community.POST(new Request('https://opendraft.test/api/community',{method:'POST',headers:{Origin:'https://opendraft.test','Content-Type':'application/json'},body:JSON.stringify(body)}));return{status:response.status,data:await response.json()};});
 await (await import('./work-updates.integration.mjs')).testWorkUpdates({query,read,identity,user,ok,cAction,bundles:'work-update-tests'});
 console.log(assertions+' work-update infrastructure assertions passed.');
}finally{
 globalThis.fetch=originalFetch;
 if(originalVisionKey===undefined)delete process.env.GOOGLE_VISION_API_KEY;else process.env.GOOGLE_VISION_API_KEY=originalVisionKey;
 if(originalAdminEmails===undefined)delete process.env.ADMIN_EMAILS;else process.env.ADMIN_EMAILS=originalAdminEmails;
 await pool.query(`DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`);
 await pool.end();delete globalThis.__opendraftTest;
}
