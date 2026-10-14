import {inspectCritique, type CritiqueDraft} from './critique-quality';
import {MIN_CRITIQUE_WORDS} from './critique-rubric';

// Deterministic, non-AI credit check used only when the automated evaluator is
// unavailable (Vercel AI Gateway outage) or not configured (self-host without a
// key). It is deliberately conservative and never transmits manuscript text.
// Results are marked `fallback` so an operator can audit them afterwards.
export const STRUCTURAL_FALLBACK_POLICY = 'critique-structure-fallback-v1';

export function structuralFallbackEnabled(): boolean {
  return process.env.OPENDRAFT_STRUCTURAL_FALLBACK !== 'false';
}

export type StructuralAssessment = {
  model: 'structural';
  rubric: string;
  scores: null;
  fallback: true;
  reasons: string[];
  credit: { mean: number | null; eligible: boolean; policy: string };
};

export function evaluateCritiqueStructurally(content: string, draft: CritiqueDraft, wordCount: number): StructuralAssessment {
  const check = inspectCritique(content, draft);
  const reasons: string[] = [];
  if (wordCount < MIN_CRITIQUE_WORDS) reasons.push('fewer than 175 words');
  // Allow roughly one repeated sentence per 200 words, matching the evaluator's
  // discouragement of padding while tolerating legitimate thematic repetition.
  const repetitionBudget = Math.max(1, Math.floor(check.words / 200));
  if (check.repeatedSentences > repetitionBudget) reasons.push('repeated sentences');
  // Proposed cuts/additions must carry some rationale, not just replacement text.
  if (check.redlines > 0 && check.explainedRedlines < Math.ceil(check.redlines / 2)) reasons.push('unexplained cuts or additions');
  const eligible = reasons.length === 0;
  return { model: 'structural', rubric: STRUCTURAL_FALLBACK_POLICY, scores: null, fallback: true, reasons, credit: { mean: null, eligible, policy: STRUCTURAL_FALLBACK_POLICY } };
}
