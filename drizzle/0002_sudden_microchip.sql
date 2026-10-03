ALTER TABLE "credit_events" ALTER COLUMN "amount" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "credits" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "credits" SET DEFAULT '5';--> statement-breakpoint
ALTER TABLE "reviews" ALTER COLUMN "reward" SET DATA TYPE numeric(10, 3);--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "mature" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "works" ADD COLUMN "themes" text DEFAULT '' NOT NULL;