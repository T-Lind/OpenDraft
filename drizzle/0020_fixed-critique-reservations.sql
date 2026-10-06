-- Apply the fixed thirty-minute policy to existing reservations.
UPDATE critique_reservations SET expires_at=LEAST(expires_at,started_at+1800000);
--> statement-breakpoint
DELETE FROM critique_reservations cr WHERE NOT EXISTS(SELECT 1 FROM works w WHERE w.id=cr.work_id AND w.version=cr.version AND w.status='spotlight');
