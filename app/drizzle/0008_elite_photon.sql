CREATE TABLE "assessment_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"external_job_id" varchar(255) NOT NULL,
	"status" "job_status" DEFAULT 'in_queue' NOT NULL,
	"result" jsonb,
	"error" text,
	"execution_time_ms" integer,
	"delay_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "assessment_jobs_external_job_id_unique" UNIQUE("external_job_id")
);
--> statement-breakpoint
ALTER TABLE "assessment_jobs" ADD CONSTRAINT "assessment_jobs_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_assessment_jobs_analysis_id" ON "assessment_jobs" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_assessment_jobs_external_job_id" ON "assessment_jobs" USING btree ("external_job_id");--> statement-breakpoint
CREATE INDEX "idx_assessment_jobs_status" ON "assessment_jobs" USING btree ("status");