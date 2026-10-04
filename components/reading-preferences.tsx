'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { Settings2, RotateCcw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';

type Preferences = {
  font: 'serif' | 'sans';
  size: 'standard' | 'large' | 'extra-large';
  spacing: 'standard' | 'relaxed' | 'wide';
  measure: 'standard' | 'narrow';
  contrast: boolean;
  reduceMotion: boolean;
  underlineLinks: boolean;
  keyboardShortcuts: boolean;
};
const defaults: Preferences = { font: 'serif', size: 'standard', spacing: 'standard', measure: 'standard', contrast: false, reduceMotion: false, underlineLinks: false, keyboardShortcuts: true };
const storageKey = 'opendraft:reading-preferences:v1';
function sanitize(value: unknown): Preferences {
  const p = value && typeof value === 'object' ? value as Partial<Preferences> : {};
  return {
    font: p.font === 'sans' ? 'sans' : 'serif',
    size: p.size === 'large' || p.size === 'extra-large' ? p.size : 'standard',
    spacing: p.spacing === 'relaxed' || p.spacing === 'wide' ? p.spacing : 'standard',
    measure: p.measure === 'narrow' ? 'narrow' : 'standard',
    contrast: p.contrast === true, reduceMotion: p.reduceMotion === true,
    underlineLinks: p.underlineLinks === true, keyboardShortcuts: p.keyboardShortcuts !== false,
  };
}
const Context = createContext<{ preferences: Preferences; update: (patch: Partial<Preferences>) => void; storageAvailable: boolean }>({ preferences: defaults, update: () => {}, storageAvailable: true });

export function ReadingPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const [storageAvailable, setStorageAvailable] = useState(true);
  // Synchronize this browser's persistent settings after hydration and across tabs.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Read the external browser preference snapshot after hydration.
    try { setPreferences(sanitize(JSON.parse(localStorage.getItem(storageKey) || '{}'))); } catch { setStorageAvailable(false); }
    const sync = (event: StorageEvent) => { if (event.key === storageKey) { try { setPreferences(sanitize(JSON.parse(event.newValue || '{}'))); } catch { /* Ignore malformed external storage. */ } } };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.readingFont = preferences.font;
    root.dataset.readingSize = preferences.size;
    root.dataset.readingSpacing = preferences.spacing;
    root.dataset.readingMeasure = preferences.measure;
    root.dataset.contrast = String(preferences.contrast);
    root.dataset.reduceMotion = String(preferences.reduceMotion);
    root.dataset.underlineLinks = String(preferences.underlineLinks);
  }, [preferences]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const resize = () => {
      const inset = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      document.documentElement.style.setProperty('--keyboard-inset', `${inset}px`);
      document.documentElement.dataset.keyboardOpen = String(inset > 120);
    };
    resize(); viewport?.addEventListener('resize', resize); viewport?.addEventListener('scroll', resize);
    return () => { viewport?.removeEventListener('resize', resize); viewport?.removeEventListener('scroll', resize); };
  }, []);
  const update = (patch: Partial<Preferences>) => {
    const next = sanitize({ ...preferences, ...patch });
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageAvailable(true); } catch { setStorageAvailable(false); }
  };
  return <Context.Provider value={{ preferences, update, storageAvailable }}>{children}</Context.Provider>;
}
export const useReadingPreferences = () => useContext(Context);

export function ReadingSettings({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { preferences: p, update, storageAvailable } = useReadingPreferences();
  const { resolvedTheme, setTheme } = useTheme();
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className={compact ? 'topbar-chip reading-settings-trigger' : 'reading-settings-button'} aria-label="Reading and accessibility settings" title="Reading and accessibility settings"><Settings2 size={16} />{!compact && <span>Reading settings</span>}</button></DialogTrigger>
      <DialogContent className="compact-dialog preferences-dialog">
        <DialogTitle>Make yourself comfortable.</DialogTitle>
        <DialogDescription>Reading and accessibility preferences apply throughout OpenDraft. Saved on this browser, not shared with other members.</DialogDescription>
        <div className="preferences-fields">
          <fieldset><legend>Reading</legend>
            <label className="field-label">Appearance<select className="form-select" value={resolvedTheme === 'dark' ? 'dark' : 'light'} onChange={event => setTheme(event.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
            <label className="field-label">Manuscript font<select className="form-select" value={p.font} onChange={event => update({ font: event.target.value as Preferences['font'] })}><option value="serif">Serif · Georgia</option><option value="sans">Sans serif · system font</option></select></label>
            <label className="field-label">Reading text size<select className="form-select" value={p.size} onChange={event => update({ size: event.target.value as Preferences['size'] })}><option value="standard">Standard · 18 px</option><option value="large">Large · 21 px</option><option value="extra-large">Extra large · 24 px</option></select></label>
            <label className="field-label">Text spacing<select className="form-select" value={p.spacing} onChange={event => update({ spacing: event.target.value as Preferences['spacing'] })}><option value="standard">Standard</option><option value="relaxed">Relaxed</option><option value="wide">Wide · extra line and letter spacing</option></select></label>
            <label className="field-label">Line length<select className="form-select" value={p.measure} onChange={event => update({ measure: event.target.value as Preferences['measure'] })}><option value="standard">Standard</option><option value="narrow">Narrow · shorter lines</option></select></label>
          </fieldset>
          <fieldset><legend>Accessibility</legend>
            <label className="preference-check"><input type="checkbox" checked={p.contrast} onChange={event => update({ contrast: event.target.checked })}/><span>Higher contrast<small>Stronger text, links, and borders in either theme.</small></span></label>
            <label className="preference-check"><input type="checkbox" checked={p.reduceMotion} onChange={event => update({ reduceMotion: event.target.checked })}/><span>Reduce motion<small>Your device’s reduced-motion setting is always respected.</small></span></label>
            <label className="preference-check"><input type="checkbox" checked={p.underlineLinks} onChange={event => update({ underlineLinks: event.target.checked })}/><span>Underline text links<small>Make links easier to distinguish without color.</small></span></label>
            <label className="preference-check"><input type="checkbox" checked={p.keyboardShortcuts} onChange={event => update({ keyboardShortcuts: event.target.checked })}/><span>Single-key keyboard shortcuts<small>Turn off navigation and annotation shortcuts if they interfere with assistive technology. Ctrl/⌘ K still opens search.</small></span></label>
          </fieldset>
          <div className="reading-preview reader-text" aria-label="Reading preview"><p>A little space to read closely. A sentence that leaves room for your next thought.</p></div>
          <p className="fine-print" role="status">{storageAvailable ? 'Changes save automatically on this browser.' : 'Browser storage is unavailable. These preferences will last only until you close or reload this page.'}</p>
        </div>
        <div className="preferences-footer"><Button type="button" variant="outline" onClick={() => update(defaults)}><RotateCcw size={14}/>Reset preferences</Button><Button type="button" className="primary-button" onClick={() => setOpen(false)}>Done</Button></div>
      </DialogContent>
    </Dialog>;
}

export function prefersReducedMotion() {
  return document.documentElement.dataset.reduceMotion === 'true' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
