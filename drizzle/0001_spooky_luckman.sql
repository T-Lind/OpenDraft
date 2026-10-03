CREATE TABLE "annotations" (
	"id" text PRIMARY KEY NOT NULL,
	"review_id" text NOT NULL,
	"work_id" text NOT NULL,
	"user_id" text NOT NULL,
	"author" text NOT NULL,
	"kind" text NOT NULL,
	"quote" text DEFAULT '' NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"para" integer DEFAULT 0 NOT NULL,
	"start_pos" integer DEFAULT 0 NOT NULL,
	"end_pos" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "work_views" (
	"work_id" text NOT NULL,
	"user_id" text NOT NULL,
	"views" integer DEFAULT 1 NOT NULL,
	"first_viewed_at" bigint NOT NULL,
	"last_viewed_at" bigint NOT NULL,
	CONSTRAINT "pk_work_views" PRIMARY KEY("work_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "email" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "age" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "sex" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "location" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "interests" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_review_id_reviews_id_fk" FOREIGN KEY ("review_id") REFERENCES "public"."reviews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "annotations" ADD CONSTRAINT "annotations_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "work_views" ADD CONSTRAINT "work_views_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_annotations_work" ON "annotations" USING btree ("work_id");--> statement-breakpoint
CREATE INDEX "idx_annotations_review" ON "annotations" USING btree ("review_id");--> statement-breakpoint
CREATE INDEX "idx_work_views_work" ON "work_views" USING btree ("work_id");