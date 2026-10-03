'use client';
import { useEffect, useState, useRef } from 'react';
import { Camera, LoaderCircle, RotateCcw } from 'lucide-react';
import { WriterAvatar } from './writer-avatar';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import type { Act } from '@/app/workshop';

type Picture = { bitmap: ImageBitmap; url: string };
const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function AvatarUpload({ user, act, busy, onError, portrait = false }: { user: { id: string; name: string; avatarUpdatedAt?: number }; act: Act; busy: boolean; onError?: (error: string) => void; portrait?: boolean }) {
  const [open, setOpen] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [error, setError] = useState('');
  const [picture, setPicture] = useState<Picture | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const input = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const drag = useRef<{ x: number; y: number; offset: typeof offset } | null>(null);
  const working = busy || preparing;
  useEffect(() => () => { if (picture) { picture.bitmap.close(); URL.revokeObjectURL(picture.url); } }, [picture]);
  useEffect(() => () => { request.current++; }, []);

  const report = (message: string) => { setError(message); onError?.(message); };
  const close = () => { request.current++; setOpen(false); setPicture(null); setPreparing(false); setError(''); };
  const load = async (file: Blob) => {
    const ticket = ++request.current;
    setPreparing(true); setError('');
    try {
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 8_000_000) throw new Error('Choose a PNG, JPEG, or WebP image under 8 MB.');
      const bitmap = await createImageBitmap(file);
      if (ticket !== request.current) { bitmap.close(); return; }
      setPicture({ bitmap, url: URL.createObjectURL(file) }); setZoom(1); setOffset({ x: 0, y: 0 });
    } catch (err) { if (ticket === request.current) report((err as Error).message || 'This picture could not open. Try another image.'); }
    finally { if (ticket === request.current) setPreparing(false); }
  };
  const edit = async () => {
    setOpen(true); setError('');
    if (!user.avatarUpdatedAt) return;
    const ticket = ++request.current;
    setPreparing(true);
    try {
      const response = await fetch(`/api/avatar?id=${encodeURIComponent(user.id)}&v=${user.avatarUpdatedAt}`, { signal: AbortSignal.timeout(15_000) });
      if (!response.ok) throw new Error('Your picture could not load. You can choose a replacement.');
      const file = await response.blob();
      if (ticket === request.current) await load(file);
    } catch (err) { if (ticket === request.current) report((err as Error).message); }
    finally { if (ticket === request.current) setPreparing(false); }
  };
  const scale = picture ? Math.max(260 / picture.bitmap.width, 260 / picture.bitmap.height) * zoom : 1;
  const width = picture ? picture.bitmap.width * scale : 260;
  const height = picture ? picture.bitmap.height * scale : 260;
  const save = async () => {
    if (!picture || working) return;
    setPreparing(true); setError('');
    try {
      const { bitmap } = picture;
      const side = Math.min(bitmap.width, bitmap.height) / zoom;
      const x = (bitmap.width - side) / 2 * (1 - offset.x);
      const y = (bitmap.height - side) / 2 * (1 - offset.y);
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 256;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Your browser could not prepare this picture.');
      context.drawImage(bitmap, x, y, side, side, 0, 0, 256, 256);
      if (await act({ action: 'uploadAvatar', image: canvas.toDataURL('image/png') }, 'Profile picture updated.', setError)) close();
    } catch (err) { report((err as Error).message); }
    finally { setPreparing(false); }
  };
  const remove = async () => {
    setError('');
    if (await act({ action: 'removeAvatar' }, 'Profile picture removed.', setError)) close();
  };

  return <div className={'avatar-upload' + (portrait ? ' avatar-portrait' : '')}>
    <button type="button" className="avatar-edit-trigger" disabled={working} aria-label="Edit profile picture" onClick={() => void edit()}>
      <WriterAvatar name={user.name} userId={user.avatarUpdatedAt ? user.id : undefined} version={user.avatarUpdatedAt} className="profile-avatar" />
      <span className="avatar-edit-badge"><Camera size={16} /></span>
    </button>
    {portrait ? <button type="button" className="text-link avatar-edit-label" disabled={working} onClick={() => void edit()}>Edit profile picture</button> : <div><Button type="button" variant="outline" disabled={working} onClick={() => void edit()}><Camera size={14} />{user.avatarUpdatedAt ? 'Edit picture' : 'Choose picture'}</Button><p className="fine-print">Optional. Your picture is screened before it appears publicly.</p></div>}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (file) void load(file); }} />
    <Dialog open={open} onOpenChange={value => { if (!value && !working) close(); }}>
      <DialogContent className="compact-dialog avatar-dialog" onEscapeKeyDown={e => { if (working) e.preventDefault(); }} onPointerDownOutside={e => { if (working) e.preventDefault(); }}>
        <DialogTitle>Your profile picture</DialogTitle>
        <DialogDescription>Choose a picture, then position it inside the circle.</DialogDescription>
        {picture ? <>
          <div className="avatar-crop" role="group" tabIndex={0} aria-label="Picture position. Drag to move, or use arrow keys." style={{ touchAction: 'none' }}
            onPointerDown={e => { if (working) return; e.currentTarget.setPointerCapture(e.pointerId); drag.current = { x: e.clientX, y: e.clientY, offset }; }}
            onPointerMove={e => { if (!drag.current || working) return; const ratio = 260 / e.currentTarget.getBoundingClientRect().width; setOffset({ x: width > 260 ? clamp(drag.current.offset.x + (e.clientX - drag.current.x) * ratio / ((width - 260) / 2)) : 0, y: height > 260 ? clamp(drag.current.offset.y + (e.clientY - drag.current.y) * ratio / ((height - 260) / 2)) : 0 }); }}
            onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
            onKeyDown={e => { if (working || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return; e.preventDefault(); setOffset(o => ({ x: clamp(o.x + (e.key === 'ArrowLeft' ? -.1 : e.key === 'ArrowRight' ? .1 : 0)), y: clamp(o.y + (e.key === 'ArrowUp' ? -.1 : e.key === 'ArrowDown' ? .1 : 0)) })); }}>
            {/* Local image only; the saved result is re-encoded and screened on the server. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img alt="Profile picture crop preview" src={picture.url} draggable={false} style={{ width: `${width / 260 * 100}%`, height: `${height / 260 * 100}%`, left: `${50 + offset.x * (width - 260) / 520 * 100}%`, top: `${50 + offset.y * (height - 260) / 520 * 100}%` }} />
            <span className="avatar-crop-mask" />
          </div>
          <p className="fine-print avatar-crop-hint">Drag to position. The circle shows how others will see your picture.</p>
          <label className="avatar-zoom">Zoom <input type="range" min="1" max="3" step="0.01" value={zoom} disabled={working} onChange={e => setZoom(Number(e.target.value))} /><span>{Math.round(zoom * 100)}%</span></label>
          <button type="button" className="text-link avatar-reset" disabled={working} onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}><RotateCcw size={13} />Reset position</button>
        </> : <div className="avatar-empty"><WriterAvatar name={user.name} className="profile-avatar" /><p className="fine-print">Your initials appear when you don’t have a picture.</p></div>}
        <div className="avatar-picture-actions"><Button type="button" variant="outline" disabled={working} onClick={() => input.current?.click()}><Camera size={14} />{picture || user.avatarUpdatedAt ? 'Choose another picture' : 'Choose picture'}</Button>{!!user.avatarUpdatedAt && <Button type="button" variant="ghost" disabled={working} onClick={() => void remove()}>Remove picture</Button>}</div>
        <p className="fine-print">Pictures are sent to Google Cloud Vision for an explicit-content check before appearing publicly.</p>
        {!!user.avatarUpdatedAt && <p className="fine-print">To show more of an existing picture, choose its original file again.</p>}
        {error && <p className="onboarding-error" role="alert">{error}</p>}
        <div className="avatar-save-actions"><Button type="button" variant="outline" disabled={working} onClick={close}>Cancel</Button><Button type="button" className="primary-button" disabled={!picture || working} onClick={() => void save()}>{working && <LoaderCircle size={14} className="animate-spin" />}{working ? 'Checking & saving…' : 'Save picture'}</Button></div>
      </DialogContent>
    </Dialog>
  </div>;
}
