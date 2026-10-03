import type { Database } from '@/db/storage';
export type Reputation={id:string;ratings:number;writers:number;eligible:boolean;combined:number|null;usefulness:number|null;specificity:number|null;actionability:number|null};
export async function reputations(db:Database,ids:string[]){
 if(!ids.length)return [];
 // One contribution per writer/reviewer pair per 30-day bucket; last year only.
 const rows=(await db.prepare('WITH ranked AS (SELECT *,ROW_NUMBER() OVER(PARTITION BY reviewer_id,rater_id,FLOOR(created_at::numeric/2592000000) ORDER BY created_at DESC,id DESC) AS rn FROM critique_ratings WHERE reviewer_id=ANY(?::text[]) AND created_at>=?) SELECT reviewer_id,COUNT(*)::int AS ratings,COUNT(DISTINCT rater_id)::int AS writers,AVG(usefulness)::float8 AS usefulness,AVG(specificity)::float8 AS specificity,AVG(actionability)::float8 AS actionability FROM ranked WHERE rn=1 GROUP BY reviewer_id').bind(ids,Date.now()-365*86400000).all()).results;
 return ids.map(id=>{const r=rows.find(row=>row.reviewer_id===id);const ratings=Number(r?.ratings||0),writers=Number(r?.writers||0),eligible=ratings>=10&&writers>=5;const u=Number(r?.usefulness),s=Number(r?.specificity),a=Number(r?.actionability);return{id,ratings,writers,eligible,usefulness:eligible?Math.round(u*20):null,specificity:eligible?Math.round(s*20):null,actionability:eligible?Math.round(a*20):null,combined:eligible?Math.round((u+s+a)/3*20):null} satisfies Reputation;});
}
