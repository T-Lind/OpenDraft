'use client';
import type {AutoCritiqueCheck} from '@/hooks/use-auto-critique-check';
export function creditReadiness(inRoom:boolean,words:number,check:AutoCritiqueCheck,enabled:boolean){
 if(!inRoom)return 'This work is outside the reading room. Feedback is welcome for zero credits.';
 if(words<175)return `${175-words} more ${175-words===1?'word':'words'} needed for credit eligibility. Shorter feedback is welcome for zero credits.`;
 if(!enabled)return 'Quality checks are unavailable until both participants accept the current workshop terms.';
 if(check.current?.error)return 'The quality check is temporarily unavailable. You can still share; credits are confirmed by the server with a structural check.';
 if(check.waiting||check.current?.busy||!check.current?.result)return 'The quality check is pending. You can wait, or share now; the server confirms credits.';
 if(!check.current.result.credit.eligible)return 'The critique has not met the quality requirement. Review the category scores and revise, or share for zero credits.';
 return 'Ready for the final server check. Credits also depend on the work and available spots when you submit.';
}
