CREATE TABLE "circle_readings" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"work_id" text NOT NULL,
	"added_by" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "critique_reservations" (
	"user_id" text PRIMARY KEY NOT NULL,
	"work_id" text NOT NULL,
	"version" integer NOT NULL,
	"started_at" bigint NOT NULL,
	"expires_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "workshop_prompt" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "workshop_agenda" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "meeting_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "meeting_place" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "feedback_due_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "circle_readings" ADD CONSTRAINT "circle_readings_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_readings" ADD CONSTRAINT "circle_readings_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_readings" ADD CONSTRAINT "circle_readings_added_by_profiles_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_reservations" ADD CONSTRAINT "critique_reservations_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_reservations" ADD CONSTRAINT "critique_reservations_work_id_works_id_fk" FOREIGN KEY ("work_id") REFERENCES "public"."works"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_circle_reading_work" ON "circle_readings" USING btree ("circle_id","work_id");--> statement-breakpoint
CREATE INDEX "idx_circle_reading_created" ON "circle_readings" USING btree ("circle_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_critique_reservation_work" ON "critique_reservations" USING btree ("work_id","version","expires_at");
--> statement-breakpoint
CREATE TRIGGER guard_circle_readings_added_by BEFORE INSERT ON circle_readings FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('added_by');
--> statement-breakpoint
CREATE TRIGGER guard_critique_reservations_user_id BEFORE INSERT ON critique_reservations FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
