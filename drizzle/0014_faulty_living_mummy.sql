CREATE TABLE "auth_credentials" (
	"profile_id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified_at" bigint DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "auth_identities" (
	"provider" text NOT NULL,
	"subject" text NOT NULL,
	"profile_id" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"created_at" bigint NOT NULL,
	"last_used_at" bigint NOT NULL,
	CONSTRAINT "auth_identities_provider_subject_pk" PRIMARY KEY("provider","subject")
);
--> statement-breakpoint
CREATE TABLE "auth_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"profile_id" text NOT NULL,
	"kind" text NOT NULL,
	"expires_at" bigint NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "annotations" ADD COLUMN "writer_status" text DEFAULT 'open' NOT NULL;--> statement-breakpoint
ALTER TABLE "annotations" ADD COLUMN "writer_response" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "process_disclosure" text DEFAULT 'not-declared' NOT NULL;--> statement-breakpoint
ALTER TABLE "reviews" ADD COLUMN "attested" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "ai_process" text DEFAULT 'not-declared' NOT NULL;--> statement-breakpoint
ALTER TABLE "auth_credentials" ADD CONSTRAINT "auth_credentials_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_identities" ADD CONSTRAINT "auth_identities_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_profile_id_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_auth_credentials_email" ON "auth_credentials" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_auth_identities_profile" ON "auth_identities" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "idx_auth_tokens_profile_kind" ON "auth_tokens" USING btree ("profile_id","kind");--> statement-breakpoint
CREATE INDEX "idx_auth_tokens_expiry" ON "auth_tokens" USING btree ("expires_at");