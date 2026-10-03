'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { genres, workKinds, workStages, type Work } from '@/app/data';

export type DraftSaveState = 'local' | 'waiting' | 'saving' | 'saved' | 'offline' | 'error' | 'conflict';
type Recovery = { work: Work; savedAt: number; editedAt: number };
export const draftFingerprint = (work: Work) => JSON.stringify([work.id, work.title.trim() || 'Untitled draft', work.genre, work.kind, work.stage, work.content, work.request, work.warning, !!work.mature, work.themes || '', work.targetReviews || 2, work.critiqueVisibility || 'public', work.revisionOf || null]);
const prefix = (uid: string) => 'opendraft:draft:' + encodeURIComponent(uid) + ':';

function recoveryFor(initial: Work): Recovery | null {
  try {
    const base = prefix(initial.authorId);
    const id = initial.title || initial.content ? initial.id : localStorage.getItem(base + 'latest') || initial.id;
    const value = JSON.parse(localStorage.getItem(base + id) || 'null') as Recovery | null;
    if (!value || value.work.authorId !== initial.authorId || value.work.status !== 'draft' || typeof value.work.id !== 'string' || value.work.id.length > 100 || !Number.isFinite(value.savedAt) || !Number.isFinite(value.editedAt)) return null;
    if (!genres.includes(value.work.genre) || !workKinds.includes(value.work.kind) || !workStages.includes(value.work.stage)) return null;
    if (!['title', 'content', 'request', 'warning'].every(key => typeof value.work[key as keyof Work] === 'string') || value.work.content.length > 50000) return null;
    return draftFingerprint(value.work) === draftFingerprint(initial) ? null : value;
  } catch { return null; }
}

export function useDraftAutosave(initial: Work, paused: boolean, onSaved?: () => void) {
  const [work, setWork] = useState(initial);
  const [state, setState] = useState<DraftSaveState>(initial.title || initial.content ? 'saved' : 'local');
  const [savedAt, setSavedAt] = useState(initial.title || initial.content ? initial.createdAt : 0);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [backupAvailable, setBackupAvailable] = useState(true);
  const [savedFingerprint, setSavedFingerprint] = useState(() => draftFingerprint(initial));
  const latest = useRef(initial);
  const saved = useRef(draftFingerprint(initial));
  const serverStamp = useRef(initial.createdAt);
  const nextSave = useRef(0);
  const pending = useRef<Promise<boolean> | null>(null);
  const blocked = useRef(false);
  const mounted = useRef(true);
  const saveRef = useRef<() => Promise<boolean>>(async () => false);
  const savedCallback = useRef(onSaved);
  const fingerprint = draftFingerprint(work);
  const dirty = fingerprint !== savedFingerprint;

  const backup = useCallback(() => {
    try {
      const current = latest.current, base = prefix(current.authorId);
      localStorage.setItem(base + current.id, JSON.stringify({ work: current, savedAt: serverStamp.current, editedAt: Date.now() }));
      localStorage.setItem(base + 'latest', current.id);
      return true;
    } catch { return false; }
  }, []);
  const clearBackup = useCallback(() => {
    try { const current = latest.current, base = prefix(current.authorId); localStorage.removeItem(base + current.id); if (localStorage.getItem(base + 'latest') === current.id) localStorage.removeItem(base + 'latest'); } catch { /* Storage can be unavailable. */ }
  }, []);

  const save = useCallback(async (): Promise<boolean> => {
    if (pending.current) return pending.current;
    if (blocked.current) return false;
    const current = latest.current, sent = draftFingerprint(current);
    if (sent === saved.current) return true;
    if (!navigator.onLine) { if (mounted.current) setState('offline'); return false; }
    const run = async () => {
      if (mounted.current) { setState('saving'); setError(''); }
      nextSave.current = Date.now() + 10_000;
      try {
        const body = JSON.stringify({ action: 'autosaveDraft', work: current, expectedSavedAt: serverStamp.current });
        const response = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: new TextEncoder().encode(body).length < 60_000, signal: AbortSignal.timeout(20_000) });
        const result = await response.json() as { savedAt?: number; error?: string };
        if (!response.ok) throw Object.assign(new Error(result.error || 'Your draft could not sync.'), { status: response.status });
        if (!Number.isFinite(result.savedAt)) throw new Error('The server did not confirm this save. Your local draft is preserved.');
        serverStamp.current = result.savedAt!; saved.current = sent;
        const stillDirty = draftFingerprint(latest.current) !== sent;
        if (stillDirty) backup(); else clearBackup();
        if (mounted.current) { setSavedFingerprint(sent); setSavedAt(result.savedAt!); setState(stillDirty ? 'waiting' : 'saved'); }
        savedCallback.current?.();
        return true;
      } catch (err) {
        const failure = err as Error & { status?: number };
        blocked.current = failure.status === 409 || failure.status === 403;
        if (mounted.current) { setError(failure.message || 'Your draft could not sync.'); setState(blocked.current ? 'conflict' : navigator.onLine ? 'error' : 'offline'); }
        const stored = backup(); if (mounted.current) setBackupAvailable(stored); return false;
      } finally { pending.current = null; }
    };
    pending.current = run();
    return pending.current;
  }, [backup, clearBackup]);

  useEffect(() => { saveRef.current = save; }, [save]);
  useEffect(() => { savedCallback.current = onSaved; }, [onSaved]);
  useEffect(() => {
    mounted.current = true;
    const local = recoveryFor(initial);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Offer externally persisted recovery after hydration.
    if (local) setRecovery(local);
    const online = () => { if (draftFingerprint(latest.current) !== saved.current && !blocked.current) void saveRef.current(); };
    const leaving = (event: BeforeUnloadEvent) => { if (draftFingerprint(latest.current) !== saved.current) { backup(); void saveRef.current(); event.preventDefault(); } };
    const visibility = () => { if (document.visibilityState === 'hidden' && draftFingerprint(latest.current) !== saved.current) void saveRef.current(); };
    window.addEventListener('online', online); window.addEventListener('beforeunload', leaving); document.addEventListener('visibilitychange', visibility);
    return () => { mounted.current = false; window.removeEventListener('online', online); window.removeEventListener('beforeunload', leaving); document.removeEventListener('visibilitychange', visibility); if (draftFingerprint(latest.current) !== saved.current) { backup(); void saveRef.current(); } };
  }, [initial, backup]);
  useEffect(() => {
    if (!dirty || paused || recovery || ['error', 'conflict', 'offline'].includes(state)) return;
    const timer = setTimeout(() => void save(), Math.max(1500, nextSave.current - Date.now()));
    return () => clearTimeout(timer);
  }, [fingerprint, dirty, paused, recovery, state, save]);

  const update = (key: keyof Work, value: string | boolean | number) => {
    if (latest.current[key] === value) return;
    latest.current = { ...latest.current, [key]: value } as Work;
    setWork(latest.current);
    if (!pending.current && draftFingerprint(latest.current) === saved.current) {
      clearBackup(); setState(savedAt ? 'saved' : 'local'); return;
    }
    setBackupAvailable(backup());
    if (!pending.current && !blocked.current) setState(navigator.onLine ? 'waiting' : 'offline');
  };
  const flush = async () => {
    if (recovery) return false;
    if (pending.current) { if (!await pending.current) return false; }
    return draftFingerprint(latest.current) === saved.current || await save();
  };
  const restore = () => {
    if (!recovery) return;
    const same = recovery.work.id === initial.id;
    latest.current = recovery.work;
    serverStamp.current = same ? initial.createdAt : recovery.savedAt;
    saved.current = same ? draftFingerprint(initial) : '';
    setSavedFingerprint(saved.current);
    setWork(recovery.work); setRecovery(null); setState(navigator.onLine ? 'waiting' : 'offline'); backup();
  };
  const discardRecovery = () => {
    if (recovery) { try { const base = prefix(initial.authorId); localStorage.removeItem(base + recovery.work.id); if (localStorage.getItem(base + 'latest') === recovery.work.id) localStorage.removeItem(base + 'latest'); } catch { /* Best effort. */ } }
    setRecovery(null);
  };
  const published = () => { saved.current = draftFingerprint(latest.current); clearBackup(); };
  return { work, update, state, savedAt, error, dirty, recovery, restore, discardRecovery, flush, retry: save, published, backupAvailable, serverStamp: () => serverStamp.current };
}
