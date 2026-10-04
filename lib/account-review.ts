import type { Database } from '@/db/storage';
import { limitFor, readCursor, pageOf } from './pagination';
import { camel } from './workshop-query';
import { z } from 'zod';

// Only already-reported/flagged evidence. No scanning private drafts or ordinary inboxes.
const signals = `SELECT w.author_id AS account_id,r.id,r.user_id AS reporter,r.created_at,'work'::text AS source,r.reason,w.id AS work_id,w.title AS work_title
 FROM reports r JOIN works w ON w.id=r.work_id WHERE r.status='open' AND r.created_at>=? AND w.author_id<>''
 UNION ALL SELECT r.sender_id,r.id,r.user_id,r.created_at,'message',r.reason,NULL::text,NULL::text FROM message_reports r WHERE r.status='open' AND r.created_at>=?
 UNION ALL SELECT m.sender_id,m.id,NULL::text,m.created_at,'flag', 'Existing message flag',NULL::text,NULL::text FROM messages m WHERE m.flagged>0 AND m.created_at>=?`;
export async function accountReview(db: Database, params: URLSearchParams, now=Date.now()) {
  const since=now-30*86400000,limit=limitFor(params),cursor=readCursor(params.get('cursor'));
  const evidence=params.get('collection')==='accountEvidence';
  let rows;
  if(evidence) {
    const id=z.string().min(1).max(100).parse(params.get('id'));
    rows=(await db.prepare(`WITH signals AS (${signals}) SELECT * FROM signals WHERE account_id=?${cursor?' AND (created_at,id)<(?,?)':''} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(since,since,since,id,...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
  } else {
    rows=(await db.prepare(`WITH signals AS (${signals}), accounts AS (SELECT p.id,p.name,MAX(s.created_at) AS created_at,COUNT(*) FILTER(WHERE s.source='work')::int AS work_reports,COUNT(*) FILTER(WHERE s.source='message')::int AS message_reports,COUNT(*) FILTER(WHERE s.source='flag')::int AS flagged_messages,COUNT(DISTINCT s.reporter)::int AS reporters FROM signals s JOIN profiles p ON p.id=s.account_id WHERE p.deleted_at=0 GROUP BY p.id,p.name) SELECT * FROM accounts${cursor?' WHERE (created_at,id)<(?,?)':''} ORDER BY created_at DESC,id DESC LIMIT ?`).bind(since,since,since,...(cursor?[cursor.value,cursor.id]:[]),limit+1).all()).results;
  }
  const page=pageOf(rows,limit);return {...page,items:page.items.map(camel)};
}
