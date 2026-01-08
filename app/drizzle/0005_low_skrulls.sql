CREATE TYPE "public"."analysis_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "job_id" varchar(255);--> statement-breakpoint
ALTER TABLE "analyses" ADD COLUMN "status" "analysis_status" DEFAULT 'pending' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_analyses_job_id" ON "analyses" USING btree ("job_id");