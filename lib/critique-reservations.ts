import type { Database } from '@/db/storage';

export const HOLD_MS = 30 * 60_000;
export const availableCritiqueSlot = `(status NOT IN ('spotlight','queued') OR (SELECT COUNT(*) FROM reviews r WHERE r.work_id=works.id AND r.version=works.version)+(SELECT COUNT(*) FROM critique_reservations cr WHERE cr.work_id=works.id AND cr.version=works.version AND cr.expires_at>? AND cr.user_id<>?)<target_reviews)`;

export async function reservationStatus(db: Database, uid: string, workId: string, now = Date.now()) {
  const result = await db.read([
    db.prepare("SELECT w.id,w.status,w.version,w.author_id,w.target_reviews,(SELECT COUNT(*) FROM reviews r WHERE r.work_id=w.id AND r.version=w.version)::int AS reviews,(SELECT COUNT(*) FROM critique_reservations cr WHERE cr.work_id=w.id AND cr.version=w.version AND cr.expires_at>?)::int AS holds,EXISTS(SELECT 1 FROM reviews r WHERE r.work_id=w.id AND r.version=w.version AND r.user_id=?) AS reviewed FROM works w WHERE w.id=? AND w.status NOT IN ('draft','withdrawn')").bind(now,uid,workId),
    db.prepare("SELECT cr.work_id,cr.started_at,cr.expires_at,w.title FROM critique_reservations cr JOIN works w ON w.id=cr.work_id WHERE cr.user_id=? AND cr.expires_at>? AND cr.version=w.version AND w.status NOT IN ('draft','withdrawn')").bind(uid,now),
  ]);
  const work = result[0].results[0];
  if (!work) throw Object.assign(new Error('This work is no longer available.'), { status: 404 });
  const mine = result[1].results[0];
  return {
    serverNow: now,
    reservable: work.status === 'spotlight' && work.author_id !== uid && !work.reviewed,
    available: Math.max(0, Number(work.target_reviews) - Number(work.reviews) - Number(work.holds)),
    holds: Number(work.holds),
    mine: mine ? { workId: String(mine.work_id), title: String(mine.title), startedAt: Number(mine.started_at), expiresAt: Number(mine.expires_at) } : null,
  };
}

export async function changeReservation(db: Database, uid: string, workId: string, action: string, now: number) {
  if (action === 'releaseCritique') {
    await db.prepare('DELETE FROM critique_reservations WHERE user_id=? AND work_id=?').bind(uid,workId).run();
  } else if (action === 'renewCritique') {
    throw Object.assign(new Error('Reservations expire after 30 minutes. Once yours expires, reserve again if this work is still in the reading room and a spot is available. Your draft is safe.'), {status:409});
  } else {
    // The same exchange lock used by review submission serializes last-slot claims.
    const result = await db.batch([
      db.prepare("DELETE FROM critique_reservations cr WHERE expires_at<=? OR NOT EXISTS(SELECT 1 FROM works w WHERE w.id=cr.work_id AND w.version=cr.version AND w.status NOT IN ('draft','withdrawn'))").bind(now),
      db.prepare("INSERT INTO critique_reservations(user_id,work_id,version,started_at,expires_at) SELECT ?,w.id,w.version,?,? FROM works w WHERE w.id=? AND w.author_id<>? AND w.status='spotlight' AND NOT EXISTS(SELECT 1 FROM reviews WHERE work_id=w.id AND version=w.version AND user_id=?) AND (SELECT COUNT(*) FROM reviews WHERE work_id=w.id AND version=w.version)+(SELECT COUNT(*) FROM critique_reservations WHERE work_id=w.id AND version=w.version AND expires_at>?)<w.target_reviews ON CONFLICT(user_id) DO NOTHING").bind(uid,now,now+HOLD_MS,workId,uid,uid,now),
    ]);
    if (!result[1].meta.changes) {
      const state = await reservationStatus(db,uid,workId,now);
      if (state.mine?.workId !== workId) throw Object.assign(new Error(state.mine ? 'You already hold a spot on another work. Release it before starting this critique.' : 'All requested critique spots are currently held, or this work has received its requested feedback. Your draft is safe.'), { status: 409 });
      return state;
    }
  }
  return reservationStatus(db,uid,workId,now);
}
