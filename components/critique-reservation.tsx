'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Clock, LoaderCircle, ShieldCheck } from 'lucide-react';
import { Button } from './ui/button';

type Reservation = { serverNow: number; reservable: boolean; available: number; holds: number; mine: { workId: string; title: string; startedAt: number; expiresAt: number } | null };
export function useCritiqueReservation(workId: string, enabled: boolean, revision?: number, version=1) {
  const [state, setState] = useState<Reservation | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(0);
  const [lastHold,setLastHold] = useState({key:'',expiresAt:0});
  const holdKey=workId+':'+version;
  const lastExpiry=lastHold.key===holdKey?lastHold.expiresAt:0;
  const offset = useRef(0), attempted = useRef(''), inFlight = useRef(false);
  const accept = useCallback((data: Reservation) => { offset.current = data.serverNow - Date.now(); setState(data); setNow(data.serverNow); if(data.mine?.workId===workId)setLastHold({key:workId+':'+version,expiresAt:data.mine.expiresAt}); }, [workId,version]);
  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch('/api/workshop?collection=critiqueReservation&id=' + encodeURIComponent(workId), { cache: 'no-store', signal });
      const data = await response.json() as Reservation & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not check critique spots.');
      if (!signal?.aborted) { accept(data); setError(''); return data; }
    } catch (error) { if (!signal?.aborted) setError((error as Error).message); }
  }, [workId, accept]);
  const change = useCallback(async (action: 'reserveCritique' | 'releaseCritique', target = workId) => {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/workshop', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, workId: target }), signal: AbortSignal.timeout(20_000) });
      const data = await response.json() as Reservation & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Could not update your spot.');
      if (target === workId) accept(data); else await refresh();
      if (action === 'releaseCritique' && target===workId) setLastHold({key:workId+':'+version,expiresAt:0});
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); inFlight.current = false; }
  }, [workId, version, accept, refresh]);
  useEffect(()=>{
    if(!enabled||!lastExpiry)return;
    const controller=new AbortController();
    const timer=setTimeout(()=>{setNow(Date.now()+offset.current);void refresh(controller.signal);},Math.max(0,lastExpiry-Date.now()-offset.current));
    return ()=>{controller.abort();clearTimeout(timer);};
  },[enabled,lastExpiry,refresh]);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const key=workId+':'+version;
    const start=async()=>{
      const data=await refresh(controller.signal);
      if(!data||controller.signal.aborted||attempted.current===key)return;
      attempted.current=key;
      if(data.reservable&&!data.mine&&data.available>0)await change('reserveCritique');
    };
    // Starting a critique acquires a server reservation once; polling never reacquires it.
    void start();
    const clock = setInterval(() => setNow(Date.now() + offset.current), 1000);
    const timer = setInterval(() => {
      if (document.hidden) return;
      void refresh(controller.signal);
    }, 30_000);
    const visible = () => { if (!document.hidden) void refresh(controller.signal); };
    document.addEventListener('visibilitychange', visible);
    return () => { controller.abort(); clearInterval(clock); clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [enabled, workId, version, revision, refresh, change]);
  return { state, error, busy, now, change, retry: () => void refresh(), expired:lastExpiry>0&&lastExpiry<=now };
}

export function CritiqueReservation({ reservation, workId }: { reservation: ReturnType<typeof useCritiqueReservation>; workId: string }) {
  const { state, error, busy, now, change, retry, expired } = reservation;
  const mine = state?.mine;
  const held = mine?.workId === workId && mine.expiresAt > now;
  return <section className={'critique-reservation' + (held ? ' held' : '')} aria-label="Critique spot">
    <div className="reservation-heading">{held ? <ShieldCheck size={19}/> : <Clock size={19}/>}<strong>{held ? 'Your critique spot is held' : expired ? 'Your reservation has expired' : 'Critique spot availability'}</strong></div>
    {state ? <>
      {held ? <p><b>{Math.max(1, Math.ceil((mine.expiresAt - now) / 60_000))} minutes left.</b> Starting this critique reserved a spot for 30 minutes. It expires even while you are writing.</p>
        : mine && mine.workId !== workId ? <p>You hold a spot on “{mine.title}”. You can hold one spot at a time.</p>
          : state.reservable ? <p>{expired?'Your draft is safe. ':''}{state.available > 0 ? `${state.available} requested ${state.available === 1 ? 'spot is' : 'spots are'} available. You can reserve ${expired?'again ':''}for another 30 minutes.` : 'All requested spots are temporarily held by other readers. You can keep reading and drafting; check back for an opening.'}</p>
            : <p>This work is not available for reservations in the reading room. You can still leave feedback.</p>}
      <div className="reservation-actions">
        {held ? <Button type="button" variant="outline" disabled={busy} onClick={() => void change('releaseCritique')}>Release spot</Button>
          : mine && mine.workId !== workId ? <Button type="button" variant="outline" disabled={busy} onClick={() => void change('releaseCritique', mine.workId)}>Release other spot</Button>
            : state.reservable && <Button type="button" variant="outline" disabled={busy || !state.available} onClick={() => void change('reserveCritique')}>{busy && <LoaderCircle size={14} className="animate-spin"/>}{expired?'Reserve again':'Reserve a spot'} · 30 minutes</Button>}
        <Button type="button" variant="ghost" disabled={busy} onClick={retry}>Refresh spots</Button>
      </div>
    </> : !error && <p role="status">Checking available spots…</p>}
    <p className="fine-print">Expiry or release never deletes your critique draft. Reserving again depends on the work still being in the reading room and a spot being available. Availability and credits are checked again when you submit.</p>
    {error && <div className="form-error" role="alert">{error} <button type="button" className="text-link" onClick={retry}>Retry</button></div>}
  </section>;
}
