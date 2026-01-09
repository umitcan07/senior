CREATE TABLE "ipa_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reference_speech_id" uuid NOT NULL,
	"external_job_id" varchar(255) NOT NULL,
	"status" "job_status" DEFAULT 'in_queue' NOT NULL,
	"result" jsonb,
	"error" text,
	"execution_time_ms" integer,
	"delay_time_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "ipa_generation_jobs_external_job_id_unique" UNIQUE("external_job_id")
);
--> statement-breakpoint
ALTER TABLE "ipa_generation_jobs" ADD CONSTRAINT "ipa_generation_jobs_reference_speech_id_reference_speeches_id_fk" FOREIGN KEY ("reference_speech_id") REFERENCES "public"."reference_speeches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_ipa_generation_jobs_reference_speech_id" ON "ipa_generation_jobs" USING btree ("reference_speech_id");--> statement-breakpoint
CREATE INDEX "idx_ipa_generation_jobs_external_job_id" ON "ipa_generation_jobs" USING btree ("external_job_id");--> statement-breakpoint
CREATE INDEX "idx_ipa_generation_jobs_status" ON "ipa_generation_jobs" USING btree ("status");