'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

type Reservation = { serverNow: number; reservable: boolean; available: number; holds: number; mine: { workId: string; title: string; startedAt: number; expiresAt: number } | null };
export function useCritiqueReservation(workId: string, enabled: boolean, revision?: number) {
  const [state, setState] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const offset = useRef(0), activity = useRef(0), renewed = useRef(0), current = useRef<Reservation | null>(null), inFlight = useRef(false);
  const accept = useCallback((data: Reservation) => { offset.current = data.serverNow - Date.now(); current.current = data; setState(data); setNow(data.serverNow); }, []);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/workshop?collection=critiqueReservation&id=' + encodeURIComponent(workId), { cache: 'no-store', signal });
      const data = await response.json() as Reservation & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not check critique spots.');
      if (!signal?.aborted) { accept(data); setError(''); }
    } catch (error) { if (!signal?.aborted) setError((error as Error).message); }
  }, [workId, accept]);
  const change = useCallback(async (action: 'reserveCritique' | 'renewCritique' | 'releaseCritique', target = workId) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, workId: target }), signal: AbortSignal.timeout(20_000) });
      const data = await response.json() as Reservation & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not update your spot.');
      if (target === workId) accept(data); else await refresh();
      if (action !== 'releaseCritique') renewed.current = Date.now();
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); inFlight.current = false; }
  }, [workId, accept, refresh]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Load the external server reservation when the manuscript changes.
    void refresh(controller.signal);
    const timer = setInterval(() => {
      setNow(Date.now() + offset.current);
      if (document.hidden) return;
      const hold = current.current?.mine;
      if (hold?.workId === workId && hold.expiresAt > Date.now() + offset.current && activity.current > renewed.current && Date.now() - renewed.current >= 60_000) void change('renewCritique');
      else void refresh(controller.signal);
    }, 30_000);
    const visible = () => { if (!document.hidden) void refresh(controller.signal); };
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [enabled, workId, revision, refresh, change]);
  return { state, error, busy, now, change, retry: () => void refresh(), markActive: () => { activity.current = Date.now(); } };
}

export function CritiqueReservation({ reservation, workId }: { reservation: ReturnType<typeof useCritiqueReservation>; workId: string }) {
  const { state, error, busy, now, change, retry } = reservation;
  const mine = state?.mine;
  const held = mine?.workId === workId && mine.expiresAt > now;
  return <section className={'critique-reservation' + (held ? ' held' : '')} aria-label="Critique spot">
    <div className="reservation-heading">{held ? <ShieldCheck size={19}/> : <Clock size={19}/>}<strong>{held ? 'Your critique spot is held' : 'Take your time with this critique'}</strong></div>
    {state ? <>
      {held ? <p><b>{Math.max(1, Math.ceil((mine.expiresAt - now) / 60_000))} minutes left.</b> Active writing extends your hold, up to 90 minutes from when you started. An idle or closed tab does not renew it.</p>
        : mine && mine.workId !== workId ? <p>You hold a spot on “{mine.title}”. You can hold one spot at a time.</p>
          : state.reservable ? <p>{state.available > 0 ? `${state.available} requested ${state.available === 1 ? 'spot is' : 'spots are'} available. Start a 30-minute hold before you write so another reader cannot take the last spot.` : 'All requested spots are temporarily held by other readers. You can keep reading and drafting; check back for an opening.'}</p>
            : <p>This work has received its requested feedback. Additional critiques are still welcome at the regular outside-reading-room reward rate.</p>}
      <div className="reservation-actions">
        {held ? <Button type="button" variant="outline" disabled={busy} onClick={() => void change('releaseCritique')}>Release spot</Button>
          : mine && mine.workId !== workId ? <Button type="button" variant="outline" disabled={busy} onClick={() => void change('releaseCritique', mine.workId)}>Release other spot</Button>
            : state.reservable && <Button type="button" className="primary-button" disabled={busy || !state.available} onClick={() => void change('reserveCritique')}>{busy && <LoaderCircle size={14} className="animate-spin"/>}Start critique · hold a spot</Button>}
        <Button type="button" variant="ghost" disabled={busy} onClick={retry}>Refresh spots</Button>
      </div>
    </> : !error && <p role="status">Checking available spots…</p>}
    <p className="fine-print">A hold is optional. Expiry or release never deletes your critique draft. Availability and credits are checked again when you submit.</p>
    {error && <div className="form-error" role="alert">{error} <button type="button" className="text-link" onClick={retry}>Retry</button></div>}
  </section>;
}
