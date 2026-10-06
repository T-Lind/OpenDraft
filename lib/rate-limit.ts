import { database, type Database } from '@/db/storage';
export async function rateLimitCooldown(db:Database,key:string,windowMs:number,now=Date.now()):Promise<void>{
 const result=await db.prepare(`INSERT INTO rate_limits(key,window_started_at,count) VALUES(?,?,1) ON CONFLICT(key) DO UPDATE SET window_started_at=excluded.window_started_at,count=1 WHERE rate_limits.window_started_at<=excluded.window_started_at-? RETURNING count`).bind(key,now,windowMs).first();
 if(!result)throw Object.assign(new Error('Please wait before the next automatic check.'),{status:429,retryAfter:Math.ceil(windowMs/1000)});
}
export async function rateLimit(db: Database, key: string, maximum: number, windowMs: number, now = Date.now()): Promise<void> {
  const window = Math.floor(now / windowMs) * windowMs;
  const result = await db.prepare(`INSERT INTO rate_limits(key,window_started_at,count) VALUES(?,?,1)
    ON CONFLICT(key) DO UPDATE SET window_started_at=excluded.window_started_at,
    count=CASE WHEN rate_limits.window_started_at=excluded.window_started_at THEN rate_limits.count+1 ELSE 1 END
    WHERE rate_limits.window_started_at<>excluded.window_started_at OR rate_limits.count<? RETURNING count`)
    .bind(key, window, maximum).first();
  if (!result) throw Object.assign(new Error('You’re doing that too quickly. Please try again shortly.'), {status:429,retryAfter:Math.ceil((window+windowMs-now)/1000)});
  // Bounded, occasional cleanup avoids retaining old hashed IP buckets forever.
  if(Math.random()<0.01)await db.prepare('DELETE FROM rate_limits WHERE key IN (SELECT key FROM rate_limits WHERE window_started_at<? ORDER BY window_started_at LIMIT 100)').bind(now-172_800_000).run();
}
export async function requestRateLimit(request: Request, scope: string, maximum = 60, windowMs = 60_000): Promise<void> {
  // Vercel sets this header itself. Never trust a caller's forwarded header on
  // arbitrary standalone hosts. Local preview uses a shared loopback bucket.
  const address = process.env.VERCEL ? request.headers.get('x-vercel-forwarded-for') || 'unknown' : 'loopback';
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${process.env.AUTH_SECRET || 'local'}:${address}`));
  const key = Array.from(new Uint8Array(digest), n=>n.toString(16).padStart(2,'0')).join('');
  await rateLimit(database(),`${scope}:${key}`,maximum,windowMs);
}
export const writeLimits: Record<string, [number,number]> = {
  uploadAvatar:[20,86_400_000],sendMessage:[20,60_000],post:[10,60_000],bulletin:[3,3_600_000],createCircle:[3,86_400_000],
  publish:[8,3_600_000],review:[15,3_600_000],saveDraft:[60,60_000],autosaveDraft:[12,60_000],feedback:[5,3_600_000],report:[10,3_600_000],
};
