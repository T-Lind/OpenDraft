// Isolated financial integration tests never call a live model. Only the workshop
// submission route imports this adapter; model-boundary tests use the real evaluator.
import {critiqueCreditDecision, CRITIQUE_RUBRIC} from '../lib/critique-rubric.ts';
export async function evaluateCritique(content,request,draft,_token,context) {
  const test=globalThis.__opendraftTest;
  test.creditCalls.push({content,request,draft,context});
  if(test.creditHook)await test.creditHook();
  if(test.creditError)throw new Error('Synthetic provider outage');
  const scores={...test.creditScores};
  return {model:'typesafe-ai/jev',rubric:CRITIQUE_RUBRIC,scores,credit:critiqueCreditDecision(scores)};
}
