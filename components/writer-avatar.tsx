'use client';
import { useState } from 'react';

export function writerInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words.length > 1 ? (words[0][0] + words[words.length - 1][0]).toUpperCase() : (words[0] || 'WR').slice(0, 2).toUpperCase();
}
export function WriterAvatar({ name, userId, version, className = '' }: { name: string; userId?: string; version?: number; className?: string }) {
  const src = userId ? `/api/avatar?id=${encodeURIComponent(userId)}&v=${version || 0}` : '';
  const [failedSrc, setFailedSrc] = useState('');
  return <span className={'writer-avatar ' + className} aria-label={`${name || 'Writer'}'s profile picture`}>
    {/* Pictures come from a screened, same-origin dynamic route. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {src && failedSrc !== src ? <img src={src} alt="" loading="lazy" onError={() => setFailedSrc(src)} /> : writerInitials(name)}
  </span>;
}
