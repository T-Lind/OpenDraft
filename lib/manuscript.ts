export type InlineRun = { text: string; start: number; end: number; style: 'strong' | 'u' | 'em' | null };
export function inlineRuns(raw: string): InlineRun[] {
  let offset = 0;
  return raw.split(/(\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g).filter(Boolean).map(part => {
    const style = part.startsWith('**') && part.endsWith('**') && part.length > 4 ? 'strong'
      : part.startsWith('__') && part.endsWith('__') && part.length > 4 ? 'u'
        : part.startsWith('*') && part.endsWith('*') && part.length > 2 ? 'em' : null;
    const trim = style === 'em' ? 1 : style ? 2 : 0;
    const text = trim ? part.slice(trim, -trim) : part;
    const start = offset; offset += text.length;
    return { text, start, end: offset, style };
  });
}
export function inlineSlice(runs: InlineRun[], start: number, end: number): InlineRun[] {
  return runs.filter(run => run.start < end && run.end > start).map(run => ({ ...run, text: run.text.slice(Math.max(0, start - run.start), Math.min(run.text.length, end - run.start)) }));
}
