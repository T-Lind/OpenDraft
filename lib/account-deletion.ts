import type {Database} from '@/db/storage';
import {promoteSQL} from './reading-room';
export async function deleteAccount(db:Database,uid:string){
 const now=Date.now();
 const statements=[
 db.prepare('DELETE FROM work_notifications WHERE user_id=? OR work_id IN (SELECT id FROM works WHERE author_id=?) OR target_work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid,uid,uid),
 db.prepare('DELETE FROM work_preferences WHERE user_id=? OR work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM work_flow_events WHERE work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid),
 db.prepare('DELETE FROM critique_evidence WHERE user_id=? OR id IN (SELECT r.id FROM reviews r JOIN works w ON w.id=r.work_id WHERE w.author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM critique_credit_checks WHERE user_id=? OR id IN (SELECT r.id FROM reviews r JOIN works w ON w.id=r.work_id WHERE w.author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM auth_tokens WHERE profile_id=?').bind(uid),
 db.prepare('DELETE FROM reading_preferences WHERE user_id=?').bind(uid),
 db.prepare('DELETE FROM circle_requests WHERE user_id=? OR circle_id IN (SELECT id FROM circles WHERE owner_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM critique_reservations WHERE user_id=? OR work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM circle_readings WHERE added_by=? OR work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM auth_credentials WHERE profile_id=?').bind(uid),
 db.prepare('DELETE FROM auth_identities WHERE profile_id=?').bind(uid),
 db.prepare("UPDATE profiles SET deleted_at=?,session_valid_after=?,name='Deleted writer',email='',bio='',credits=0,age=NULL,sex='',location='',interests='',onboarding_completed=false,avatar_updated_at=0,avatar_scan_at=0,current_streak=0,longest_streak=0,last_active_day='',terms_version='',terms_accepted_at=0,friends_only=false WHERE id=?").bind(now,Math.floor(now/1000)+1,uid),
 db.prepare('DELETE FROM critique_ratings WHERE rater_id=? OR reviewer_id=?').bind(uid,uid),
 db.prepare('DELETE FROM annotations WHERE user_id=? OR work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM reviews WHERE user_id=?').bind(uid),
 db.prepare('DELETE FROM bookmarks WHERE user_id=? OR work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM work_views WHERE user_id=? OR work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid,uid),
 db.prepare('DELETE FROM profile_photos WHERE user_id=?').bind(uid),
 db.prepare('DELETE FROM friendships WHERE low_id=? OR high_id=?').bind(uid,uid),
 db.prepare('DELETE FROM member_blocks WHERE user_id=?').bind(uid),
 db.prepare("UPDATE messages SET body='[Message removed by writer]',sender='Deleted writer' WHERE sender_id=?").bind(uid),
 db.prepare("UPDATE messages SET recipient='Deleted writer' WHERE recipient_id=?").bind(uid),
 db.prepare('DELETE FROM bulletin_deliveries WHERE recipient_id=?').bind(uid),
 db.prepare("UPDATE bulletins SET body='[Bulletin removed by writer]',sender='Deleted writer' WHERE sender_id=?").bind(uid),
 db.prepare('DELETE FROM posts WHERE user_id=?').bind(uid),
 db.prepare('DELETE FROM memberships WHERE user_id=?').bind(uid),
 db.prepare("UPDATE circles SET owner_id='system',workshop_prompt='',workshop_agenda='',meeting_at=0,meeting_place='',feedback_due_at=0 WHERE owner_id=?").bind(uid),
 db.prepare('DELETE FROM credit_events WHERE user_id=?').bind(uid),
 db.prepare('DELETE FROM feedback WHERE user_id=?').bind(uid),
 db.prepare('DELETE FROM showcases WHERE work_id IN (SELECT id FROM works WHERE author_id=?)').bind(uid),
 // Keep a content-free withdrawn stub only as a reference for other writers' critiques.
 db.prepare("UPDATE works SET author_id='',author='Deleted writer',title='Writing removed by its author',content='',request='',status='withdrawn',words=0,warning='',themes='',mature=false,showcase_opt_in=false,ai_showcase_consent=false,ai_critique_consent=false,ai_assessment='',ai_assessed_at=0 WHERE author_id=?").bind(uid),
 db.prepare(promoteSQL)
 ];await db.batch(statements);
}
