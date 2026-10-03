DROP INDEX "idx_annotations_work";--> statement-breakpoint
DROP INDEX "idx_credits_user";--> statement-breakpoint
DROP INDEX "idx_messages_recipient";--> statement-breakpoint
DROP INDEX "idx_messages_sender";--> statement-breakpoint
DROP INDEX "idx_posts_circle_created";--> statement-breakpoint
DROP INDEX "idx_reviews_user";--> statement-breakpoint
DROP INDEX "idx_works_author";--> statement-breakpoint
CREATE INDEX "idx_circles_name_id" ON "circles" USING btree ("name","id");--> statement-breakpoint
CREATE INDEX "idx_circles_search" ON "circles" USING gin (to_tsvector('simple',coalesce("name",'')||' '||coalesce("description",'')||' '||coalesce("genre",'')));--> statement-breakpoint
CREATE INDEX "idx_membership_user_circle" ON "memberships" USING btree ("user_id","circle_id");--> statement-breakpoint
CREATE INDEX "idx_messages_unread" ON "messages" USING btree ("recipient_id","created_at","id") WHERE "messages"."read_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_profiles_search" ON "profiles" USING gin (to_tsvector('simple',coalesce("name",'')||' '||coalesce("bio",'')||' '||coalesce("interests",'')));--> statement-breakpoint
CREATE INDEX "idx_reviews_work_created" ON "reviews" USING btree ("work_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_works_created_id" ON "works" USING btree ("created_at","id");--> statement-breakpoint
CREATE INDEX "idx_works_words_id" ON "works" USING btree ("words","id");--> statement-breakpoint
CREATE INDEX "idx_works_search" ON "works" USING gin (to_tsvector('simple',coalesce("title",'')||' '||coalesce("author",'')||' '||coalesce("genre",'')||' '||coalesce("request",'')||' '||coalesce("content",'')));--> statement-breakpoint
CREATE INDEX "idx_annotations_work" ON "annotations" USING btree ("work_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_credits_user" ON "credit_events" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_messages_recipient" ON "messages" USING btree ("recipient_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_messages_sender" ON "messages" USING btree ("sender_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_posts_circle_created" ON "posts" USING btree ("circle_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_reviews_user" ON "reviews" USING btree ("user_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_works_author" ON "works" USING btree ("author_id","created_at","id");