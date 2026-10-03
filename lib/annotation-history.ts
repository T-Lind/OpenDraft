export type AnnotationHistory<T> = { past: T[][]; present: T[]; future: T[][] };
export function annotationHistory<T>(present: T[] = []): AnnotationHistory<T> {
  return { past: [], present, future: [] };
}
export function editAnnotations<T>(history: AnnotationHistory<T>, next: T[]): AnnotationHistory<T> {
  return { past: [...history.past.slice(-99), history.present], present: next, future: [] };
}
export function undoAnnotations<T>(history: AnnotationHistory<T>): AnnotationHistory<T> {
  if (!history.past.length) return history;
  return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] };
}
export function redoAnnotations<T>(history: AnnotationHistory<T>): AnnotationHistory<T> {
  if (!history.future.length) return history;
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) };
}
