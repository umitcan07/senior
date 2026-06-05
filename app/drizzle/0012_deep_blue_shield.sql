CREATE TYPE "public"."dialect" AS ENUM('genam', 'rp');--> statement-breakpoint
ALTER TABLE "authors" ADD COLUMN "slug" varchar(100);--> statement-breakpoint
ALTER TABLE "reference_speeches" ADD COLUMN "dialect" "dialect";--> statement-breakpoint
ALTER TABLE "reference_speeches" ADD COLUMN "phone_timings_json" jsonb;--> statement-breakpoint
CREATE INDEX "idx_reference_speeches_dialect" ON "reference_speeches" USING btree ("dialect");--> statement-breakpoint
ALTER TABLE "authors" ADD CONSTRAINT "authors_slug_unique" UNIQUE("slug");