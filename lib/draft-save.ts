import { z } from 'zod';
import { genres, workKinds, workStages, wordCount } from '@/app/data';
import type { Database } from '@/db/storage';
import {fail} from './member';
export const draftInput = z.object({
 id:z.string().min(1).max(100),title:z.string().trim().max(120).transform(t=>t||'Untitled draft'),
 genre:z.enum(genres.slice(1) as [string,...string[]]),kind:z.enum(workKinds as [string,...string[]]),stage:z.enum(workStages as [string,...string[]]),
 content:z.string().max(50000),request:z.string().max(800),warning:z.string().max(300).default(''),mature:z.boolean().default(false),
 themes:z.string().max(400).default(''),targetReviews:z.number().int().min(2).max(5).default(2),critiqueVisibility:z.enum(['public','private']).default('public'),
 aiProcess:z.enum(['human-only','ai-assisted','not-declared']).default('not-declared'),
 revisionOf:z.string().min(1).max(100).nullable().default(null)
});
export async function revisionVersion(db:Database,uid:string,revisionOf:string|null){
 if(!revisionOf)return 1;
 const parent=await db.prepare("SELECT version FROM works WHERE id=? AND author_id=? AND status<>'draft'").bind(revisionOf,uid).first();
 if(!parent)fail('A revision must refer to your own previously published work.',403);return Number(parent.version)+1;
}
export async function savePrivateDraft(db:Database,uid:string,name:string,input:unknown,expectedSavedAt?:number){
 const w=draftInput.parse(input);
 const old=await db.prepare('SELECT author_id,status,created_at,version,revision_of FROM works WHERE id=?').bind(w.id).first();
 if(old&&(old.author_id!==uid||old.status!=='draft'))fail('Only your unpublished drafts can be edited here.',403);
 if(old&&(old.revision_of||null)!==w.revisionOf)fail('The source revision cannot be changed.',409);
 const version=old?Number(old.version):await revisionVersion(db,uid,w.revisionOf);
 const statement="WITH active AS (SELECT id FROM profiles WHERE id=? AND deleted_at=0 FOR SHARE) INSERT INTO works(id,author_id,author,title,genre,kind,stage,content,request,status,version,created_at,words,warning,mature,themes,target_reviews,critique_visibility,revision_of,ai_process) SELECT ?,?,?,?,?,?,?,?,?,'draft',?,?,?,?,?,?,?,?,?,? FROM active ON CONFLICT(id) DO UPDATE SET title=excluded.title,genre=excluded.genre,kind=excluded.kind,stage=excluded.stage,content=excluded.content,request=excluded.request,created_at=GREATEST(excluded.created_at,works.created_at+1),words=excluded.words,warning=excluded.warning,mature=excluded.mature,themes=excluded.themes,target_reviews=excluded.target_reviews,critique_visibility=excluded.critique_visibility,ai_process=excluded.ai_process WHERE works.author_id=? AND works.status='draft' "+(expectedSavedAt===undefined?'':'AND works.created_at=?')+' RETURNING created_at';
 const result=await db.prepare(statement).bind(uid,w.id,uid,name,w.title,w.genre,w.kind,w.stage,w.content,w.request,version,Date.now(),wordCount(w.content),w.warning,w.mature,w.themes,w.targetReviews,w.critiqueVisibility,w.revisionOf,w.aiProcess,uid,...(expectedSavedAt===undefined?[]:[expectedSavedAt])).first<{created_at:number}>();
 if(!result)fail('This draft changed in another tab or device. Your local text is safe; reopen the saved draft before continuing.',409);
 return{id:w.id,savedAt:result.created_at};
}
