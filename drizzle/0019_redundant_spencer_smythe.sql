CREATE TABLE "critique_credit_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"assessment" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "critique_credit_checks" ADD CONSTRAINT "critique_credit_checks_id_reviews_id_fk" FOREIGN KEY ("id") REFERENCES "public"."reviews"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "critique_credit_checks" ADD CONSTRAINT "critique_credit_checks_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_critique_credit_checks_user" ON "critique_credit_checks" USING btree ("user_id","created_at","id");
--> statement-breakpoint
CREATE TRIGGER guard_critique_credit_checks_user_id BEFORE INSERT ON critique_credit_checks FOR EACH ROW EXECUTE FUNCTION enforce_active_member_insert('user_id');
