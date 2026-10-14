// Runs against the real workshop handler in its temporary PostgreSQL schema.
export async function requestedCredits({query,read,action,ok,work}){
 await read('credit-writer');
 await query("UPDATE profiles SET credits=50 WHERE id='credit-writer'");
 await action('credit-writer',{action:'publish',work:{...work('requested-credit-work'),targetReviews:5}});
 await query("UPDATE works SET status='spotlight' WHERE id='requested-credit-work'");
 const test=globalThis.__opendraftTest,base={workId:'requested-credit-work',version:1,overall:Array(175).fill('human').join(' '),withoutCredits:false};
 let result=await action('missing-reader',{action:'review',review:{...base,engagement:undefined}});
 ok(result.status===200&&result.data.user.credits===6,'advisory reading: a missing summary no longer blocks credits');
 result=await action('partial-reader',{action:'review',review:{...base,engagement:{consent:true,version:1,activeMs:36000,readingMs:36000,regionsMs:[2999,...Array(11).fill(3000)]}}});
 ok(result.status===200&&result.data.user.credits===6,'advisory reading: one incomplete region no longer blocks credits');
 const scores={...test.creditScores};
 test.creditScores={grounding:4,relevance:4,rationale:1.99,usefulness:4};
 result=await action('failed-score',{action:'review',review:base});ok(result.status===409,'every quality category must be green');
 const calls=test.creditCalls.length;
 result=await action('failed-score',{action:'review',review:{...base,withoutCredits:true}});ok(result.status===200&&result.data.user.credits===5,'failed checks can be explicitly submitted for zero credits');
 ok(test.creditCalls.length===calls,'zero-credit confirmation skips paid evaluation');
 test.creditScores=scores;
 result=await action('passing-reader',{action:'review',review:base});ok(result.status===200&&result.data.user.credits===6,'175 words with completed reading and quality checks earn one credit');
 test.creditHook=()=>query("UPDATE works SET status='open' WHERE id='requested-credit-work'");
 result=await action('race-reader',{action:'review',review:base});ok(result.status===409,'leaving the reading room during evaluation requires fresh zero-credit confirmation');
 ok((await query("SELECT COUNT(*)::int AS n FROM reviews WHERE user_id='race-reader'")).rows[0].n===0,'status race posts no unconfirmed zero-credit review');
 test.creditHook=null;
 result=await action('outside-reader',{action:'review',review:base});ok(result.status===409,'outside-room work cannot earn credits');
 result=await action('outside-reader',{action:'review',review:{...base,withoutCredits:true}});ok(result.status===200&&result.data.user.credits===5,'outside-room saved feedback can be shared for zero credits');
 await query("UPDATE works SET status='spotlight',target_reviews=20 WHERE id='requested-credit-work'");
 test.creditError=true;
 result=await action('outage-reader',{action:'review',review:base});ok(result.status===200&&result.data.user.credits===6,'an evaluator outage falls back to a structural credit check');
 result=await action('outage-zero',{action:'review',review:{...base,withoutCredits:true}});ok(result.status===200&&result.data.user.credits===5,'zero-credit sharing still works during an outage');
 test.creditError=false;
}
