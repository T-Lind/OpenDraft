CREATE TABLE "critique_ratings" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"rater_id" text NOT NULL,
	"reviewer_id" text NOT NULL,
	"usefulness" integer NOT NULL,
	"specificity" integer NOT NULL,
	"actionability" integer NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "friendships" (
	"id" text PRIMARY KEY NOT NULL,
	"low_id" text NOT NULL,
	"high_id" text NOT NULL,
	"requester_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "legal_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"resolved_at" bigint
);
--> statement-breakpoint
CREATE TABLE "member_blocks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"blocked_id" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "message_reports" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"message_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"body" text NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"resolution" text DEFAULT '' NOT NULL,
	"resolved_at" bigint,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "showcases" (
	"day" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"admin_id" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "deleted_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "session_valid_after" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "terms_version" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "terms_accepted_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "friends_only" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "revision_of" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "showcase_opt_in" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "ai_showcase_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "ai_assessment" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "ai_assessed_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "critique_ratings" ADD CONSTRAINT "critique_ratings_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_ratings" ADD CONSTRAINT "critique_ratings_rater_id_profiles_id_fk" FOREIGN KEY ("rater_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_ratings" ADD CONSTRAINT "critique_ratings_reviewer_id_profiles_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_low_id_profiles_id_fk" FOREIGN KEY ("low_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_high_id_profiles_id_fk" FOREIGN KEY ("high_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "friendships" ADD CONSTRAINT "friendships_requester_id_profiles_id_fk" FOREIGN KEY ("requester_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_blocks" ADD CONSTRAINT "member_blocks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member_blocks" ADD CONSTRAINT "member_blocks_blocked_id_profiles_id_fk" FOREIGN KEY ("blocked_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "message_reports" ADD CONSTRAINT "message_reports_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcases" ADD CONSTRAINT "showcases_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showcases" ADD CONSTRAINT "showcases_admin_id_profiles_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_rating_review" ON "critique_ratings" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_rating_reviewer_pair" ON "critique_ratings" USING btree ("reviewer_id","rater_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_friend_pair" ON "friendships" USING btree ("low_id","high_id");--> statement-breakpoint
CREATE INDEX "idx_friend_low" ON "friendships" USING btree ("low_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "idx_friend_high" ON "friendships" USING btree ("high_id","status","updated_at","id");--> statement-breakpoint
CREATE INDEX "idx_legal_status_created" ON "legal_requests" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_block_pair" ON "member_blocks" USING btree ("user_id","blocked_id");--> statement-breakpoint
CREATE INDEX "idx_block_target" ON "member_blocks" USING btree ("blocked_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_message_report_pair" ON "message_reports" USING btree ("user_id","message_id");--> statement-breakpoint
CREATE INDEX "idx_message_report_status" ON "message_reports" USING btree ("status","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_showcase_work_day" ON "showcases" USING btree ("work_id","day");
--> statement-breakpoint
ALTER TABLE critique_ratings ADD CONSTRAINT ck_rating_range CHECK (usefulness BETWEEN 1 AND 5 AND specificity BETWEEN 1 AND 5 AND actionability BETWEEN 1 AND 5);
--> statement-breakpoint
ALTER TABLE friendships ADD CONSTRAINT ck_friend_pair CHECK (low_id<high_id AND requester_id IN (low_id,high_id) AND status IN ('pending','accepted','rejected'));
--> statement-breakpoint
CREATE FUNCTION enforce_active_member_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE actor text;
BEGIN
 actor := to_jsonb(NEW)->>TG_ARGV[0];
 IF actor IS NULL OR actor='' OR actor='system' OR actor LIKE 'sample-%' THEN RETURN NEW; END IF;
 PERFORM id FROM profiles WHERE id=actor AND deleted_at=0 FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Inactive workshop account' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END; $$;

--> statement-breakpoint
CREATE TRIGGER guard_works_author_id BEFORE INSERT ON works FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('author_id');

--> statement-breakpoint
CREATE TRIGGER guard_reviews_user_id BEFORE INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');

--> statement-breakpoint
CREATE TRIGGER guard_annotations_user_id BEFORE INSERT ON annotations FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');

--> statement-breakpoint
CREATE TRIGGER guard_messages_sender_id BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('sender_id');

--> statement-breakpoint
CREATE TRIGGER guard_messages_recipient_id BEFORE INSERT ON messages FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('recipient_id');

--> statement-breakpoint
CREATE TRIGGER guard_posts_user_id BEFORE INSERT ON posts FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');

--> statement-breakpoint
CREATE TRIGGER guard_circles_owner_id BEFORE INSERT ON circles FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('owner_id');

--> statement-breakpoint
CREATE TRIGGER guard_memberships_user_id BEFORE INSERT ON memberships FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');

--> statement-breakpoint
CREATE TRIGGER guard_bulletins_sender_id BEFORE INSERT ON bulletins FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('sender_id');

--> statement-breakpoint
CREATE TRIGGER guard_friendships_low_id BEFORE INSERT ON friendships FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('low_id');

--> statement-breakpoint
CREATE TRIGGER guard_friendships_high_id BEFORE INSERT ON friendships FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('high_id');

--> statement-breakpoint
CREATE TRIGGER guard_critique_ratings_rater_id BEFORE INSERT ON critique_ratings FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('rater_id');

--> statement-breakpoint
CREATE TRIGGER guard_critique_ratings_reviewer_id BEFORE INSERT ON critique_ratings FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('reviewer_id');
--> statement-breakpoint
CREATE TRIGGER guard_profile_photos_user_id BEFORE INSERT ON profile_photos FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_bookmarks_user_id BEFORE INSERT ON bookmarks FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_work_views_user_id BEFORE INSERT ON work_views FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_credit_events_user_id BEFORE INSERT ON credit_events FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_member_blocks_user_id BEFORE INSERT ON member_blocks FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_reports_user_id BEFORE INSERT ON reports FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_feedback_user_id BEFORE INSERT ON feedback FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
