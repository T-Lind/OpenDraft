CREATE INDEX IF NOT EXISTS "idx_works_larger_work" ON "works" USING btree ("larger_work_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_works_queue" ON "works" USING btree ("genre","status","created_at","id");--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "circles" ADD CONSTRAINT "circle_access_valid" CHECK ("circles"."access" IN ('open','approval'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "critique_ratings" ADD CONSTRAINT "ck_rating_range" CHECK ("critique_ratings"."usefulness" BETWEEN 1 AND 5 AND "critique_ratings"."specificity" BETWEEN 1 AND 5 AND "critique_ratings"."actionability" BETWEEN 1 AND 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "friendships" ADD CONSTRAINT "ck_friend_pair" CHECK ("friendships"."low_id"<"friendships"."high_id" AND "friendships"."requester_id" IN ("friendships"."low_id","friendships"."high_id") AND "friendships"."status" IN ('pending','accepted','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
