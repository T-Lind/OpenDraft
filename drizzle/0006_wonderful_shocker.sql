CREATE TABLE "feedback" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text DEFAULT '' NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"body" text NOT NULL,
	"page" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "current_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "longest_streak" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "last_active_day" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_feedback_created" ON "feedback" USING btree ("created_at");