import type { Database } from '@/db/storage';
import { accountPreferencesSchema } from './reading-preferences';
import { fail } from './member';

export async function readAccountPreferences(db: Database, uid: string) {
  const row = await db.prepare('SELECT preferences,updated_at FROM reading_preferences WHERE user_id=?').bind(uid).first();
  return { preferences: row ? accountPreferencesSchema.parse(JSON.parse(String(row.preferences))) : null, updatedAt: row ? Number(row.updated_at) : 0 };
}

export async function saveAccountPreferences(db: Database, uid: string, preferences: unknown, expected: number, now = Date.now()) {
  const next = preferences === null ? null : accountPreferencesSchema.parse(preferences);
  const result = await db.batch([
    next === null
      ? db.prepare('DELETE FROM reading_preferences WHERE user_id=? AND updated_at=?').bind(uid, expected)
      : db.prepare('INSERT INTO reading_preferences(user_id,preferences,updated_at) SELECT ?,?,? WHERE EXISTS(SELECT 1 FROM profiles WHERE id=? AND deleted_at=0) AND (?=0 OR EXISTS(SELECT 1 FROM reading_preferences WHERE user_id=? AND updated_at=?)) ON CONFLICT(user_id) DO UPDATE SET preferences=excluded.preferences,updated_at=GREATEST(reading_preferences.updated_at+1,excluded.updated_at) WHERE reading_preferences.updated_at=?').bind(uid, JSON.stringify(next), now, uid, expected, uid, expected, expected),
  ]);
  const current = await readAccountPreferences(db, uid);
  if (!result[0].meta.changes && !(next === null && expected === 0 && current.preferences === null)) fail('Your account settings changed on another device. Load that copy before saving again.', 409);
  return current;
}
