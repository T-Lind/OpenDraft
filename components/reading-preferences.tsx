'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Settings2, RotateCcw } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogTrigger } from './ui/dialog';
import { defaultReadingPreferences as defaults, sanitizeReadingPreferences as sanitize, type ReadingPreferences as Preferences, type AccountPreferences } from '@/lib/reading-preferences';

const storageKey = 'opendraft:reading-preferences:v1';
type AccountCopy = { preferences: AccountPreferences | null; updatedAt: number };
const Context = createContext<{
  preferences: Preferences; update: (patch: Partial<Preferences>) => void; storageAvailable: boolean;
  accountId: string | null; bindAccount: (id: string | null) => void; accountCopy: AccountCopy;
  accountBusy: boolean; accountNotice: string; accountError: string; loadAccount: () => void; saveAccount: (remove?: boolean) => void;
}>({ preferences: defaults, update: () => {}, storageAvailable: true, accountId: null, bindAccount: () => {}, accountCopy: { preferences: null, updatedAt: 0 }, accountBusy: false, accountNotice: '', accountError: '', loadAccount: () => {}, saveAccount: () => {} });

export function ReadingPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState(defaults);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const { resolvedTheme, setTheme } = useTheme();
  const [accountId, setAccountId] = useState<string | null>(null), [accountCopy, setAccountCopy] = useState<AccountCopy>({ preferences: null, updatedAt: 0 });
  const [accountBusy, setAccountBusy] = useState(false), [accountNotice, setAccountNotice] = useState(''), [accountError, setAccountError] = useState('');
  const [reload, setReload] = useState(0);
  const identity = useRef<string | null>(null);
  const persist = useCallback((next: Preferences) => {
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setStorageAvailable(true); } catch { setStorageAvailable(false); }
  }, []);
  const bindAccount = useCallback((id: string | null) => {
    if (identity.current === id) return;
    identity.current = id; setReload(0); setAccountId(id); setAccountCopy({ preferences: null, updatedAt: 0 }); setAccountNotice(''); setAccountError(''); setAccountBusy(!!id);
  }, []);
  useEffect(() => {
    if (!accountId) return;
    const controller = new AbortController();
    let previousCopy = '', browserBefore = '', themeBefore = '';
    try { previousCopy = localStorage.getItem('opendraft:account-default') || ''; browserBefore = localStorage.getItem(storageKey) || ''; themeBefore = localStorage.getItem('theme') || ''; } catch { /* The settings still work for this session. */ }
    fetch('/api/community?section=readingPreferences', { cache: 'no-store', signal: controller.signal })
      .then(async response => { const data = await response.json() as AccountCopy & {error?:string}; if (!response.ok) throw new Error(data.error || 'Could not load account settings.'); return data; })
      .then(data => {
        if (controller.signal.aborted || identity.current !== accountId) return;
        setAccountCopy(data);
        let unchanged = true;
        try { unchanged = browserBefore === (localStorage.getItem(storageKey) || '') && themeBefore === (localStorage.getItem('theme') || ''); } catch { /* Use the in-memory settings. */ }
        if (data.preferences && (reload > 0 || previousCopy !== accountId) && unchanged) { persist(sanitize(data.preferences)); setTheme(data.preferences.appearance); setAccountNotice('Your saved account settings are loaded.'); }
        else if (data.preferences) setAccountNotice('This browser keeps its local adjustments. Load account settings to replace them.');
        else setAccountNotice('No account copy yet. Your browser settings stay as they are.');
        try { localStorage.setItem('opendraft:account-default',accountId); } catch { /* Optional cross-session account marker. */ }
        setAccountError('');
      }).catch(error => { if (!controller.signal.aborted) setAccountError((error as Error).message); })
      .finally(() => { if (!controller.signal.aborted) setAccountBusy(false); });
    return () => controller.abort();
  }, [accountId, reload, persist, setTheme]);
  const saveAccount = async (remove = false) => {
    if (!accountId || accountBusy) return;
    const target = accountId;
    setAccountBusy(true); setAccountError(''); setAccountNotice('');
    try {
      const response = await fetch('/api/community', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(15_000), body: JSON.stringify({ action: 'readingPreferences', preferences: remove ? null : { ...preferences, appearance: resolvedTheme === 'dark' ? 'dark' : 'light' }, expectedUpdatedAt: accountCopy.updatedAt }) });
      const data = await response.json() as AccountCopy & {error?:string};
      if (!response.ok) throw new Error(data.error || 'Could not save account settings. Browser settings are unchanged.');
      if (identity.current !== target) return;
      setAccountCopy(data as AccountCopy); setAccountNotice(remove ? 'Account copy removed. This browser keeps its settings.' : 'Account copy saved. It will load on a browser where you have not used this account before.');
    } catch (error) { if (identity.current === target) setAccountError((error as Error).message); }
    finally { if (identity.current === target) setAccountBusy(false); }
  };
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
    persist(next);
  };
  return <Context.Provider value={{ preferences, update, storageAvailable, accountId, bindAccount, accountCopy, accountBusy, accountNotice, accountError, loadAccount: () => { setAccountBusy(true); setReload(n => n + 1); }, saveAccount: remove => void saveAccount(remove) }}>{children}</Context.Provider>;
}
export const useReadingPreferences = () => useContext(Context);

export function ReadingAccountBridge({ id }: { id: string }) {
  const { bindAccount } = useReadingPreferences();
  useEffect(() => { bindAccount(id); return () => bindAccount(null); }, [id, bindAccount]);
  return null;
}

export function ReadingSettings({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const { preferences: p, update, storageAvailable, accountId, accountCopy, accountBusy, accountNotice, accountError, loadAccount, saveAccount } = useReadingPreferences();
  const { resolvedTheme, setTheme } = useTheme();
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><button type="button" className={compact ? 'topbar-chip reading-settings-trigger' : 'reading-settings-button'} aria-label="Reading and accessibility settings" title="Reading and accessibility settings"><Settings2 size={16} />{!compact && <span>Reading settings</span>}</button></DialogTrigger>
      <DialogContent className="compact-dialog preferences-dialog">
        <DialogTitle>Make yourself comfortable.</DialogTitle>
        <DialogDescription>Reading and accessibility preferences apply throughout OpenDraft. Browser changes save locally; optionally save a private account copy for your other devices.</DialogDescription>
        <div className="preferences-fields">
          <fieldset><legend>Reading</legend>
            <label className="field-label">Appearance<select className="form-select" value={resolvedTheme === 'dark' ? 'dark' : 'light'} onChange={event => setTheme(event.target.value)}><option value="light">Light</option><option value="dark">Dark</option></select></label>
            <label className="field-label">Manuscript font<select className="form-select" value={p.font} onChange={event => update({ font: event.target.value as Preferences['font'] })}><option value="serif">Serif · Georgia</option><option value="sans">Sans serif · system font</option></select></label>
            <label className="field-label">Reading text size<select className="form-select" value={p.size} onChange={event => update({ size: event.target.value as Preferences['size'] })}><option value="standard">Standard · 18 px</option><option value="large">Large · 21 px</option><option value="extra-large">Extra large · 24 px</option></select></label>
            <label className="field-label">Text spacing<select className="form-select" value={p.spacing} onChange={event => update({ spacing: event.target.value as Preferences['spacing'] })}><option value="standard">Standard</option><option value="relaxed">Relaxed</option><option value="wide">Wide · extra line and letter spacing</option></select></label>
            <label className="field-label">Line length<select className="form-select" value={p.measure} onChange={event => update({ measure: event.target.value as Preferences['measure'] })}><option value="standard">Standard</option><option value="narrow">Narrow · shorter lines</option></select></label>
          </fieldset>
          {accountId && <fieldset className="account-preferences"><legend>Your other devices</legend><p className="fine-print">Save an account default, including light/dark mode, for your first sign-in on another browser. Later browser adjustments stay device-specific until you save again. Other members cannot see these settings.</p><div className="form-actions"><Button type="button" variant="outline" disabled={accountBusy} onClick={() => saveAccount()}>Save settings to account</Button><Button type="button" variant="ghost" disabled={accountBusy} onClick={loadAccount}>Load account settings</Button>{accountCopy.preferences && <Button type="button" variant="ghost" disabled={accountBusy} onClick={() => saveAccount(true)}>Remove account copy</Button>}</div><p className="fine-print" role="status">{accountBusy ? 'Checking account settings…' : accountNotice}</p>{accountError && <p className="form-error" role="alert">{accountError} Your current browser settings are preserved.</p>}</fieldset>}
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
