CREATE TABLE "work_notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid()::text NOT NULL,
	"user_id" text NOT NULL,
	"work_id" text NOT NULL,
	"target_work_id" text NOT NULL,
	"event_key" text NOT NULL,
	"kind" text NOT NULL,
	"feed" boolean DEFAULT true NOT NULL,
	"read_at" bigint,
	"created_at" bigint NOT NULL,
	"email_requested" boolean DEFAULT false NOT NULL,
	"email_sent_at" bigint,
	"email_started_at" bigint,
	"email_attempts" integer DEFAULT 0 NOT NULL,
	"email_next_at" bigint DEFAULT 0 NOT NULL,
	"email_lease_until" bigint DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_preferences" (
	"user_id" text NOT NULL,
	"work_id" text NOT NULL,
	"feed_updates" boolean DEFAULT false NOT NULL,
	"email_updates" boolean DEFAULT false NOT NULL,
	"read_version" integer DEFAULT 0 NOT NULL,
	"read_at" bigint,
	"reminder_at" bigint,
	"reminder_fired_at" bigint,
	"updated_at" bigint NOT NULL,
	CONSTRAINT "work_preferences_user_id_work_id_pk" PRIMARY KEY("user_id","work_id")
);
--> statement-breakpoint
ALTER TABLE "work_notifications" ADD CONSTRAINT "work_notifications_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_notifications" ADD CONSTRAINT "work_notifications_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_notifications" ADD CONSTRAINT "work_notifications_target_work_id_works_id_fk" FOREIGN KEY ("target_work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_preferences" ADD CONSTRAINT "work_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_preferences" ADD CONSTRAINT "work_preferences_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_work_notification_event" ON "work_notifications" USING btree ("user_id","event_key");--> statement-breakpoint
CREATE INDEX "idx_work_notification_feed" ON "work_notifications" USING btree ("user_id","feed","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_work_notification_mail" ON "work_notifications" USING btree ("email_next_at","created_at") WHERE "work_notifications"."email_requested"=true AND "work_notifications"."email_sent_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_work_preferences_followers" ON "work_preferences" USING btree ("work_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_work_preferences_due" ON "work_preferences" USING btree ("reminder_at") WHERE "work_preferences"."reminder_at" IS NOT NULL AND "work_preferences"."reminder_fired_at" IS NULL;
--> statement-breakpoint
CREATE TRIGGER guard_work_preferences_user_id BEFORE INSERT ON work_preferences FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_work_notifications_user_id BEFORE INSERT ON work_notifications FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE FUNCTION notify_work_event(subject_id text,target_id text,event_kind text,event_id text,actor_id text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO work_notifications(user_id,work_id,target_work_id,event_key,kind,feed,created_at,email_requested)
 SELECT p.id,w.id,target_id,event_id,event_kind,
  CASE WHEN p.id=w.author_id THEN COALESCE(s.feed_updates,true) ELSE COALESCE(s.feed_updates,false) END,
  floor(extract(epoch FROM clock_timestamp())*1000)::bigint,COALESCE(s.email_updates,false)
 FROM works w
 JOIN LATERAL (SELECT w.author_id AS user_id UNION SELECT f.user_id FROM work_preferences f WHERE f.work_id=w.id AND (f.feed_updates OR f.email_updates)) followers ON true
 JOIN profiles p ON p.id=followers.user_id AND p.deleted_at=0
 LEFT JOIN work_preferences s ON s.user_id=p.id AND s.work_id=w.id
 WHERE w.id=subject_id AND w.status NOT IN ('draft','withdrawn') AND p.id<>actor_id
 AND (p.id=w.author_id OR s.feed_updates OR s.email_updates)
 AND (CASE WHEN p.id=w.author_id THEN COALESCE(s.feed_updates,true) ELSE COALESCE(s.feed_updates,false) END OR COALESCE(s.email_updates,false))
 AND NOT EXISTS(SELECT 1 FROM member_blocks b WHERE (b.user_id=p.id AND b.blocked_id IN(w.author_id,actor_id)) OR (b.blocked_id=p.id AND b.user_id IN(w.author_id,actor_id)))
 ON CONFLICT(user_id,event_key) DO NOTHING;
END $$;
--> statement-breakpoint
CREATE FUNCTION notify_work_critique() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM notify_work_event(NEW.work_id,NEW.work_id,'critique','critique:'||NEW.id,NEW.user_id);
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER work_critique_updates AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION notify_work_critique();
--> statement-breakpoint
CREATE FUNCTION notify_work_transition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='UPDATE' THEN
  IF OLD.status='queued' AND NEW.status='spotlight' THEN
   PERFORM notify_work_event(NEW.id,NEW.id,'readingRoom','room:'||NEW.id||':'||NEW.version,'');
  ELSIF OLD.status='spotlight' AND NEW.status='open' AND (SELECT COUNT(*) FROM reviews WHERE work_id=NEW.id AND version=NEW.version)>=COALESCE(NEW.target_reviews,2) THEN
   PERFORM notify_work_event(NEW.id,NEW.id,'completed','complete:'||NEW.id||':'||NEW.version,'');
  END IF;
 END IF;
 IF NEW.revision_of IS NOT NULL AND NEW.revision_of<>'' AND NEW.status NOT IN ('draft','withdrawn') THEN
  IF TG_OP='INSERT' THEN
   PERFORM notify_work_event(NEW.revision_of,NEW.id,'revision','revision:'||NEW.id,NEW.author_id);
  ELSIF OLD.status='draft' THEN
   PERFORM notify_work_event(NEW.revision_of,NEW.id,'revision','revision:'||NEW.id,NEW.author_id);
  END IF;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER work_transition_updates AFTER INSERT OR UPDATE OF status ON works FOR EACH ROW EXECUTE FUNCTION notify_work_transition();
