import type { Database } from '@/db/storage';
import { fail } from './member';
import { z } from 'zod';

// Never select c.*: an approval-only brief must not reach nonmembers in any response.
export const circleColumns = `c.id,c.name,c.description,c.genre,c.owner_id,c.access,
 CASE WHEN c.access='open' OR EXISTS(SELECT 1 FROM memberships WHERE circle_id=c.id AND user_id=$UID) THEN c.workshop_prompt ELSE '' END AS workshop_prompt,
 CASE WHEN c.access='open' OR EXISTS(SELECT 1 FROM memberships WHERE circle_id=c.id AND user_id=$UID) THEN c.workshop_agenda ELSE '' END AS workshop_agenda,
 CASE WHEN c.access='open' OR EXISTS(SELECT 1 FROM memberships WHERE circle_id=c.id AND user_id=$UID) THEN c.meeting_place ELSE '' END AS meeting_place,
 CASE WHEN c.access='open' OR EXISTS(SELECT 1 FROM memberships WHERE circle_id=c.id AND user_id=$UID) THEN c.meeting_at ELSE 0 END AS meeting_at,
 CASE WHEN c.access='open' OR EXISTS(SELECT 1 FROM memberships WHERE circle_id=c.id AND user_id=$UID) THEN c.feedback_due_at ELSE 0 END AS feedback_due_at,
 (SELECT COUNT(*) FROM memberships WHERE circle_id=c.id)::int AS members,
 EXISTS(SELECT 1 FROM memberships WHERE circle_id=c.id AND user_id=$UID) AS joined,
 EXISTS(SELECT 1 FROM circle_requests WHERE circle_id=c.id AND user_id=$UID) AS requested`;
// UID comes from authenticated server identity and is bound once by a CTE.
export const circleProjection = circleColumns.replaceAll('$UID', '(SELECT uid FROM viewer)');

export async function changeCircleMembership(db: Database, uid: string, circleId: string, joined: boolean, now: number) {
  const circle = await db.prepare('SELECT id,owner_id FROM circles WHERE id=?').bind(circleId).first();
  if (!circle) fail('Circle not found.', 404);
  if (!joined && circle.owner_id === uid) fail('The circle owner must remain a member.', 409);
  await db.batch(joined ? [
    db.prepare("INSERT INTO memberships(id,user_id,circle_id) SELECT ?,?,id FROM circles WHERE id=? AND access='open' ON CONFLICT(user_id,circle_id) DO NOTHING").bind(crypto.randomUUID(),uid,circleId),
    db.prepare("INSERT INTO circle_requests(id,circle_id,user_id,created_at) SELECT ?,id,?,? FROM circles WHERE id=? AND access='approval' AND NOT EXISTS(SELECT 1 FROM memberships WHERE circle_id=? AND user_id=?) ON CONFLICT(circle_id,user_id) DO NOTHING").bind(crypto.randomUUID(),uid,now,circleId,circleId,uid),
  ] : [db.prepare('DELETE FROM memberships WHERE user_id=? AND circle_id=? AND NOT EXISTS(SELECT 1 FROM circles WHERE id=? AND owner_id=?)').bind(uid,circleId,circleId,uid),db.prepare('DELETE FROM circle_requests WHERE user_id=? AND circle_id=?').bind(uid,circleId)]);
}

export async function manageCircle(db: Database, uid: string, input: Record<string, unknown>, now: number) {
  const circleId=z.string().min(1).max(100).parse(input.circleId);
  if (input.action==='circleAccess') {
    const access=z.enum(['open','approval']).parse(input.access);
    const result=await db.batch([
      db.prepare("UPDATE circles SET access=? WHERE id=? AND owner_id=? AND (access<>'approval' OR ?<>'open' OR ?=true)").bind(access,circleId,uid,access,input.confirmOpening===true),
      // Opening permits joining; pending requests are not silently made members.
      db.prepare("DELETE FROM circle_requests WHERE circle_id=? AND EXISTS(SELECT 1 FROM circles WHERE id=? AND owner_id=? AND access='open')").bind(circleId,circleId,uid),
    ]);
    if(!result[0].meta.changes) fail('Only the owner can change access. Confirm that opening makes the existing brief and discussion visible to all signed-in members.',409);
    return;
  }
  const userId=z.string().min(1).max(100).parse(input.userId);
  if(input.action==='removeCircleMember') {
    const result=await db.batch([
      db.prepare('DELETE FROM memberships WHERE circle_id=? AND user_id=? AND EXISTS(SELECT 1 FROM circles WHERE id=? AND owner_id=? AND owner_id<>?)').bind(circleId,userId,circleId,uid,userId),
      db.prepare('DELETE FROM bulletin_deliveries WHERE recipient_id=? AND bulletin_id IN (SELECT b.id FROM bulletins b JOIN circles c ON c.id=b.circle_id WHERE c.id=? AND c.owner_id=? AND c.owner_id<>?)').bind(userId,circleId,uid,userId),
    ]);
    if(!result[0].meta.changes)fail('Only the owner can remove another current member.',403);
    return;
  }
  const approve=z.boolean().parse(input.approve);
  const result=await db.batch([
    ...(approve?[db.prepare("INSERT INTO memberships(id,user_id,circle_id) SELECT ?,r.user_id,r.circle_id FROM circle_requests r JOIN circles c ON c.id=r.circle_id JOIN profiles p ON p.id=r.user_id WHERE r.circle_id=? AND r.user_id=? AND c.owner_id=? AND c.access='approval' AND p.deleted_at=0 ON CONFLICT(user_id,circle_id) DO NOTHING").bind(crypto.randomUUID(),circleId,userId,uid)]:[]),
    db.prepare('DELETE FROM circle_requests WHERE circle_id=? AND user_id=? AND EXISTS(SELECT 1 FROM circles WHERE id=? AND owner_id=?)').bind(circleId,userId,circleId,uid),
  ]);
  if(!result.at(-1)?.meta.changes)fail('Only the owner can handle a pending membership request.',409);
  void now;
}
