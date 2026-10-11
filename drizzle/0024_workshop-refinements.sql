CREATE TABLE "critique_drafts" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"work_id" text NOT NULL,
	"version" integer NOT NULL,
	"draft" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "critique_replies" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"user_id" text NOT NULL,
	"body" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "larger_work_followers" (
	"id" text PRIMARY KEY NOT NULL,
	"larger_work_id" text NOT NULL,
	"user_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "larger_works" (
	"id" text PRIMARY KEY NOT NULL,
	"author_id" text NOT NULL,
	"title" text NOT NULL,
	"synopsis" text DEFAULT '' NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "work_notifications" ADD COLUMN "review_id" text;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "larger_work_id" text;--> statement-breakpoint
ALTER TABLE "critique_drafts" ADD CONSTRAINT "critique_drafts_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_drafts" ADD CONSTRAINT "critique_drafts_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_replies" ADD CONSTRAINT "critique_replies_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_replies" ADD CONSTRAINT "critique_replies_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "larger_work_followers" ADD CONSTRAINT "larger_work_followers_larger_work_id_larger_works_id_fk" FOREIGN KEY ("larger_work_id") REFERENCES "public"."larger_works"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "larger_work_followers" ADD CONSTRAINT "larger_work_followers_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "larger_works" ADD CONSTRAINT "larger_works_author_id_profiles_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_critique_draft_version" ON "critique_drafts" USING btree ("user_id","work_id","version");--> statement-breakpoint
CREATE INDEX "idx_critique_reply_thread" ON "critique_replies" USING btree ("review_id","created_at","id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_larger_work_follower" ON "larger_work_followers" USING btree ("larger_work_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_larger_work_title" ON "larger_works" USING btree ("author_id","title");--> statement-breakpoint
ALTER TABLE "work_notifications" ADD CONSTRAINT "work_notifications_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "works" ADD CONSTRAINT "works_larger_work_id_larger_works_id_fk" FOREIGN KEY ("larger_work_id") REFERENCES "public"."larger_works"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION link_larger_work() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 NEW.larger_work := btrim(NEW.larger_work);
 IF NEW.larger_work='' OR NEW.author_id='' THEN NEW.larger_work_id:=NULL; RETURN NEW; END IF;
 INSERT INTO larger_works(id,author_id,title,updated_at) VALUES(gen_random_uuid()::text,NEW.author_id,NEW.larger_work,(extract(epoch from clock_timestamp())*1000)::bigint) ON CONFLICT(author_id,title) DO NOTHING;
 SELECT id INTO NEW.larger_work_id FROM larger_works WHERE author_id=NEW.author_id AND title=NEW.larger_work;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER link_work_group BEFORE INSERT OR UPDATE OF larger_work,author_id ON works FOR EACH ROW EXECUTE FUNCTION link_larger_work();
--> statement-breakpoint
UPDATE works SET larger_work=larger_work WHERE larger_work<>'' AND author_id<>'';
--> statement-breakpoint
CREATE TRIGGER guard_larger_work_author BEFORE INSERT ON larger_works FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('author_id');
--> statement-breakpoint
CREATE TRIGGER guard_larger_work_follower BEFORE INSERT ON larger_work_followers FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_critique_draft BEFORE INSERT ON critique_drafts FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_critique_reply BEFORE INSERT ON critique_replies FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE FUNCTION notify_larger_work_chapter() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.larger_work_id IS NOT NULL AND NEW.status NOT IN ('draft','withdrawn') AND (TG_OP='INSERT' OR OLD.status='draft') THEN
  INSERT INTO work_notifications(user_id,work_id,target_work_id,event_key,kind,feed,created_at)
  SELECT f.user_id,NEW.id,NEW.id,'chapter:'||NEW.id,'chapter',true,(extract(epoch from clock_timestamp())*1000)::bigint FROM larger_work_followers f JOIN profiles p ON p.id=f.user_id AND p.deleted_at=0 WHERE f.larger_work_id=NEW.larger_work_id AND f.user_id<>NEW.author_id ON CONFLICT(user_id,event_key) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER notify_chapter AFTER INSERT OR UPDATE OF status ON works FOR EACH ROW EXECUTE FUNCTION notify_larger_work_chapter();
--> statement-breakpoint
CREATE FUNCTION finish_critique_draft() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN DELETE FROM critique_drafts WHERE user_id=NEW.user_id AND work_id=NEW.work_id AND version=NEW.version; RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER finish_critique AFTER INSERT ON reviews FOR EACH ROW EXECUTE FUNCTION finish_critique_draft();
