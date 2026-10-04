import {neon, type NeonQueryFunction} from '@neondatabase/serverless';
import {Pool, type PoolClient} from 'pg';
type Row=Record<string,unknown>;
type Result={results:Row[];meta:{changes:number}};
const numericColumns=new Set(['deleted_at','session_valid_after','terms_accepted_at','ai_assessed_at','email_verified_at','expires_at','last_used_at','usefulness','specificity','actionability','queue_position','avatar_updated_at','avatar_scan_at','updated_at','created_at','resolved_at','words','reviews','members','credits','version','reward','amount','helpful','views','age','first_viewed_at','last_viewed_at','start_pos','end_pos','para','current_streak','longest_streak','read_at','flagged']);
['meeting_at','feedback_due_at','started_at','holds','available'].forEach(column=>numericColumns.add(column));
function normalize(row:Row):Row{return Object.fromEntries(Object.entries(row).map(([k,v])=>[k,numericColumns.has(k)&&typeof v==='string'?Number(v):v]));}
function mapped(r:{rows:Row[];rowCount:number|null}):Result{return{results:r.rows.map(normalize),meta:{changes:r.rowCount||0}};}
const poolCache=globalThis as typeof globalThis&{__opendraftPgPools?:Map<string,Pool>};
function localPool(url:string):Pool{
 const pools=poolCache.__opendraftPgPools??=new Map<string,Pool>();
 let pool=pools.get(url);
 if(!pool){pool=new Pool({connectionString:url,max:8});pools.set(url,pool);}
 return pool;
}
export class Statement{
 values:unknown[]=[];
 constructor(public db:Database,public text:string){}
 bind(...values:unknown[]){this.values=values;return this;}
 get sql(){let i=0;return this.text.replace(/\?/g,()=>'$'+(++i));}
 async all(){return this.db.execute(this);}
 async run(){return this.all();}
 async first<T=Row>():Promise<T|null>{const r=await this.all();return(r.results[0] as T)||null;}
}
export class Database{
 sql:NeonQueryFunction<false,true>;
 private pool:Pool|null;
 constructor(url:string){
  this.sql=neon(url,{fullResults:true});
  this.pool=process.env.DATABASE_ADAPTER==='pg'?localPool(url):null;
 }
 prepare(text:string){return new Statement(this,text);}
 private async pgTransaction(statements:Statement[],lock=false):Promise<Result[]>{
  const client=await this.pool!.connect();
  try{
   await client.query('BEGIN');
   await client.query('SET LOCAL search_path TO public');
   if(lock)await client.query('SELECT pg_advisory_xact_lock(6821941)');
   const results:Result[]=[];
   for(const statement of statements)results.push(mapped(await client.query<Row>(statement.sql,statement.values)));
   await client.query('COMMIT');
   return results;
  }catch(error){
   await rollback(client);
   throw error;
  }finally{client.release();}
 }
 async execute(statement:Statement):Promise<Result>{
 if(this.pool)return(await this.pgTransaction([statement]))[0];
 const results=await this.sql.transaction([this.sql.query('SET LOCAL search_path TO public'),this.sql.query(statement.sql,statement.values)],{fullResults:true});
 return mapped(results[1]);
 }
 async batch(statements:Statement[]):Promise<Result[]>{
 // Serialize the short exchange transactions so credits and the global FIFO
 // queue stay consistent across concurrent publishes, reviews and withdrawals.
 if(this.pool)return this.pgTransaction(statements,true);
 const result=await this.sql.transaction([this.sql.query('SET LOCAL search_path TO public'),this.sql.query('SELECT pg_advisory_xact_lock(6821941)'),...statements.map(s=>this.sql.query(s.sql,s.values))],{fullResults:true,isolationLevel:'ReadCommitted'});
 return result.slice(2).map(mapped);
 }
 async read(statements:Statement[]):Promise<Result[]>{
 if(this.pool)return this.pgTransaction(statements);
 const result=await this.sql.transaction([this.sql.query('SET LOCAL search_path TO public'),...statements.map(s=>this.sql.query(s.sql,s.values))],{fullResults:true});
 return result.slice(1).map(mapped);
 }
}
async function rollback(client:PoolClient){try{await client.query('ROLLBACK');}catch{/* preserve the original database error */}}
export function database(){
 const url=process.env.DATABASE_URL;
 if(!url)throw new Error('DATABASE_URL is missing. Configure the Neon PostgreSQL connection.');
 return new Database(url);
}
