import { z } from 'zod';

export const readingPreferencesSchema = z.object({
  font: z.enum(['serif', 'sans']), size: z.enum(['standard', 'large', 'extra-large']),
  spacing: z.enum(['standard', 'relaxed', 'wide']), measure: z.enum(['standard', 'narrow']),
  contrast: z.boolean(), reduceMotion: z.boolean(), underlineLinks: z.boolean(), keyboardShortcuts: z.boolean(),
}).strict();
export const accountPreferencesSchema = readingPreferencesSchema.extend({ appearance: z.enum(['light', 'dark']) }).strict();
export type ReadingPreferences = z.infer<typeof readingPreferencesSchema>;
export type AccountPreferences = z.infer<typeof accountPreferencesSchema>;
export const defaultReadingPreferences: ReadingPreferences = { font: 'serif', size: 'standard', spacing: 'standard', measure: 'standard', contrast: false, reduceMotion: false, underlineLinks: false, keyboardShortcuts: true };

export function sanitizeReadingPreferences(value: unknown): ReadingPreferences {
  const p = value && typeof value === 'object' ? value as Partial<ReadingPreferences> : {};
  return {
    font: p.font === 'sans' ? 'sans' : 'serif', size: p.size === 'large' || p.size === 'extra-large' ? p.size : 'standard',
    spacing: p.spacing === 'relaxed' || p.spacing === 'wide' ? p.spacing : 'standard', measure: p.measure === 'narrow' ? 'narrow' : 'standard',
    contrast: p.contrast === true, reduceMotion: p.reduceMotion === true, underlineLinks: p.underlineLinks === true, keyboardShortcuts: p.keyboardShortcuts !== false,
  };
}
