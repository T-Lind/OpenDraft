CREATE TABLE "circle_requests" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"preferences" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "circles" ADD COLUMN "access" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "circle_requests" ADD CONSTRAINT "circle_requests_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "circle_requests" ADD CONSTRAINT "circle_requests_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_preferences" ADD CONSTRAINT "reading_preferences_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_circle_request_member" ON "circle_requests" USING btree ("circle_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_circle_request_created" ON "circle_requests" USING btree ("circle_id","created_at","id");
--> statement-breakpoint
ALTER TABLE circles ADD CONSTRAINT circle_access_valid CHECK (access IN ('open','approval'));
--> statement-breakpoint
CREATE TRIGGER guard_circle_requests_user_id BEFORE INSERT ON circle_requests FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
--> statement-breakpoint
CREATE TRIGGER guard_reading_preferences_user_id BEFORE INSERT ON reading_preferences FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
