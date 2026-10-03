CREATE TABLE "bulletin_deliveries" (
	"bulletin_id" text NOT NULL,
	"recipient_id" text NOT NULL,
	"read_at" bigint,
	"created_at" bigint NOT NULL,
	CONSTRAINT "bulletin_deliveries_bulletin_id_recipient_id_pk" PRIMARY KEY("bulletin_id","recipient_id")
);
--> statement-breakpoint
CREATE TABLE "bulletins" (
	"id" text PRIMARY KEY NOT NULL,
	"circle_id" text NOT NULL,
	"sender_id" text NOT NULL,
	"sender" text NOT NULL,
	"circle_name" text NOT NULL,
	"body" text NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"window_started_at" bigint NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bulletin_deliveries" ADD CONSTRAINT "bulletin_deliveries_bulletin_id_bulletins_id_fk" FOREIGN KEY ("bulletin_id") REFERENCES "public"."bulletins"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletin_deliveries" ADD CONSTRAINT "bulletin_deliveries_recipient_id_profiles_id_fk" FOREIGN KEY ("recipient_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins" ADD CONSTRAINT "bulletins_circle_id_circles_id_fk" FOREIGN KEY ("circle_id") REFERENCES "public"."circles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bulletins" ADD CONSTRAINT "bulletins_sender_id_profiles_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_bulletin_delivery_recipient_created" ON "bulletin_deliveries" USING btree ("recipient_id","created_at","bulletin_id");--> statement-breakpoint
CREATE INDEX "idx_bulletin_delivery_unread" ON "bulletin_deliveries" USING btree ("recipient_id","read_at");--> statement-breakpoint
CREATE INDEX "idx_bulletins_circle_created" ON "bulletins" USING btree ("circle_id","created_at","id");--> statement-breakpoint
CREATE INDEX "idx_rate_limits_window" ON "rate_limits" USING btree ("window_started_at");