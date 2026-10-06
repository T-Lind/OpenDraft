CREATE TABLE "critique_evidence" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"evidence" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "ai_critique_consent" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "critique_evidence" ADD CONSTRAINT "critique_evidence_id_reviews_id_fk" FOREIGN KEY ("id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_evidence" ADD CONSTRAINT "critique_evidence_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_critique_evidence_created" ON "critique_evidence" USING btree ("created_at","id");
--> statement-breakpoint
CREATE TRIGGER guard_critique_evidence_user_id BEFORE INSERT ON critique_evidence FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
