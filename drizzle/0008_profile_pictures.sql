CREATE TABLE "profile_photos" (
	"user_id" text PRIMARY KEY NOT NULL,
	"image_data" text NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_updated_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "avatar_scan_at" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profile_photos" ADD CONSTRAINT "profile_photos_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;