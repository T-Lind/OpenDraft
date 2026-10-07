export type FocusMode = { enter: () => void; exit: () => void; toggle: () => void; dispose: () => void };
let owner: FocusMode | null = null;

// Fullscreen must be requested directly from the user's click, not an effect.
export function createFocusMode(doc: Document, onChange: (active: boolean) => void): FocusMode {
  const root = doc.documentElement;
  let active = false, disposed = false, sawFullscreen = false;
  const exitFullscreen = () => {
    if (doc.fullscreenElement !== root || typeof doc.exitFullscreen !== 'function') return;
    try { void doc.exitFullscreen().catch(() => {}); } catch { /* Layout can still be restored. */ }
  };
  const session: FocusMode = {
    enter() {
      if (disposed || active) return;
      owner?.exit();
      owner = session; active = true; sawFullscreen = !!doc.fullscreenElement;
      root.dataset.opendraftFocus = 'true'; onChange(true);
      if (doc.fullscreenElement || doc.fullscreenEnabled === false || typeof root.requestFullscreen !== 'function') return;
      try {
        void root.requestFullscreen({ navigationUI: 'hide' }).then(() => {
          // An exit or navigation may happen before the browser grants fullscreen.
          if (!active && !owner) exitFullscreen();
        }).catch(() => { /* Embedded and unsupported browsers retain the focus layout. */ });
      } catch { /* Fullscreen refusal must never prevent focus mode. */ }
    },
    exit() {
      if (!active) return;
      active = false;
      if (owner === session) {
        owner = null; delete root.dataset.opendraftFocus; exitFullscreen();
      }
      if (!disposed) onChange(false);
    },
    toggle() { if (active) session.exit(); else session.enter(); },
    dispose() {
      disposed = true; session.exit();
      doc.removeEventListener('fullscreenchange', fullscreenChange);
      doc.removeEventListener('keydown', keydown);
    },
  };
  function fullscreenChange() {
    if (!active || owner !== session) return;
    if (doc.fullscreenElement) sawFullscreen = true;
    else if (sawFullscreen) session.exit();
  }
  function keydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && owner === session) {
      const target = event.target as Element | null;
      if (!target?.closest?.('[role="dialog"], [role="alertdialog"]')) session.exit();
    }
  }
  doc.addEventListener('fullscreenchange', fullscreenChange);
  doc.addEventListener('keydown', keydown);
  return session;
}
