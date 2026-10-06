import { z } from 'zod';
import { inlineRuns } from './manuscript';

export const REGION_COUNT = 12;
const ms = z.number().int().min(0).max(86_400_000);
export const engagementInput = z.object({
  consent: z.literal(true), version: z.number().int().positive(),
  activeMs: ms, readingMs: ms, regionsMs: z.array(ms).length(REGION_COUNT),
}).strict().refine(v => v.readingMs <= v.activeMs && v.regionsMs.every(n => n <= v.readingMs), 'Invalid reading summary.');
export type Engagement = z.infer<typeof engagementInput>;
export type QualityNote = {kind:string; quote:string; body:string; para:number; start:number; end:number};
export type CritiqueDraft = {overall:string; strengths:string; suggestions:string; annotations:QualityNote[]};
export const critiqueDraftInput = z.object({
  overall:z.string().trim().max(12000).default(''), strengths:z.string().trim().max(12000).default(''), suggestions:z.string().trim().max(12000).default(''),
  annotations:z.array(z.object({kind:z.enum(['comment','highlight','delete','insert']),quote:z.string().max(4000),body:z.string().max(4000),para:z.number().int().min(0).max(5000),start:z.number().int().nonnegative().max(1000000),end:z.number().int().nonnegative().max(1000000)}).strict()).max(300).default([]),
}).strict();
const words = (text:string) => text.trim() ? text.trim().split(/\s+/).length : 0;
const normalized = (text:string) => text.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
export function manuscriptParagraphs(content:string) {
  let offset = 0;
  return content.split('\n\n').map(raw => {
    const plain = inlineRuns(raw).map(r=>r.text).join('');
    const count = words(plain), startWord = offset; offset += count;
    return {plain,words:count,startWord};
  });
}
export function validQualityNote(note:QualityNote, paragraphs:ReturnType<typeof manuscriptParagraphs>) {
  const p = paragraphs[note.para];
  return !!p && note.start <= note.end && note.end <= p.plain.length &&
    (note.kind === 'insert' && note.start === note.end ? !note.quote : !!note.quote && p.plain.slice(note.start,note.end) === note.quote);
}
export function inspectCritique(content:string, draft:CritiqueDraft) {
  const paragraphs = manuscriptParagraphs(content), total = paragraphs.reduce((n,p)=>n+p.words,0);
  const anchored = draft.annotations.filter(a=>validQualityNote(a,paragraphs));
  const distribution = [0,0,0];
  for(const note of anchored) {
    const p = paragraphs[note.para];
    const position = p.startWord + words(p.plain.slice(0,note.start));
    distribution[Math.min(2,Math.floor(position / Math.max(1,total) * 3))]++;
  }
  const bodies = [draft.overall,draft.strengths,draft.suggestions,...draft.annotations.map(a=>a.body)].filter(s=>s.trim());
  const units = bodies.flatMap(b=>b.split(/[.!?\n]+/)).map(normalized).filter(s=>words(s)>=6);
  const seen = new Set<string>(); let repeated = 0;
  for(const unit of units) { if(seen.has(unit)) repeated++; seen.add(unit); }
  const redlines = anchored.filter(a=>a.kind==='insert'||a.kind==='delete');
  const explainedRedlines = redlines.filter(a=>a.kind==='delete' ? words(a.body)>=6 : [draft.overall,draft.strengths,draft.suggestions].some(s=>/\b(because|so that|clarif|confus|pacing|rhythm|tension|reason|suggest|consider)\w*/i.test(s))).length;
  const prompts:string[] = [];
  if(!bodies.length) prompts.push('Add an observation in your own words. Marking a passage alone does not explain its effect.');
  if(repeated) prompts.push('Some sentences repeat exactly. Check whether each point contributes something different.');
  if(redlines.length>explainedRedlines) prompts.push('Explain why the proposed cuts or additions help. Replacement text alone is not a rationale.');
  if(anchored.length>=3 && distribution.filter(Boolean).length===1) prompts.push('Your line notes focus on one third of the work. That may match the writer’s request; consider whether a broader observation would help.');
  if(!anchored.length) prompts.push('Line notes are optional. A focused overall critique can be just as useful.');
  if(anchored.length!==draft.annotations.length) prompts.push('Some line notes do not match the current text and are excluded from the distribution.');
  return {rubric:'critique-structure-v1',words:bodies.reduce((n,b)=>n+words(b),0),anchoredNotes:anchored.length,distribution,redlines:redlines.length,explainedRedlines,repeatedSentences:repeated,prompts};
}
export type QualityCheck = ReturnType<typeof inspectCritique>;

// Pure timing reducer: suspended tabs cannot backfill time; input never proves attention.
export function engagementTick(state:Engagement, elapsed:number, visible:boolean, focused:boolean, idleMs:number, regions:number[]):Engagement {
  if(!visible || !focused || idleMs>60_000 || elapsed<=0 || elapsed>2500) return state;
  const dt = Math.round(elapsed), present = new Set(regions.filter(n=>Number.isInteger(n)&&n>=0&&n<REGION_COUNT));
  return {...state,activeMs:Math.min(86_400_000,state.activeMs+dt),readingMs:Math.min(86_400_000,state.readingMs+(present.size?dt:0)),regionsMs:state.regionsMs.map((n,i)=>Math.min(86_400_000,n+(present.has(i)?dt:0)))};
}
