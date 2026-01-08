CREATE TYPE "public"."job_status" AS ENUM('in_queue', 'in_progress', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_job_id" varchar(255) NOT NULL,
	"status" "job_status" DEFAULT 'in_queue' NOT NULL,
	"result" jsonb,
	"error" text,
	"execution_time_ms" integer,
	"delay_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "jobs_external_job_id_unique" UNIQUE("external_job_id")
);
--> statement-breakpoint
CREATE INDEX "idx_jobs_external_job_id" ON "jobs" USING btree ("external_job_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_jobs_created_at" ON "jobs" USING btree ("created_at");