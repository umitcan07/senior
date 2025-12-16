CREATE TYPE "public"."alignment_method" AS ENUM('mfa', 'wav2textgrid');--> statement-breakpoint
CREATE TYPE "public"."error_type" AS ENUM('substitute', 'insert', 'delete');--> statement-breakpoint
CREATE TYPE "public"."generation_method" AS ENUM('tts', 'native');--> statement-breakpoint
CREATE TYPE "public"."ipa_method" AS ENUM('powsm', 'cmudict');--> statement-breakpoint
CREATE TYPE "public"."quality_status" AS ENUM('accept', 'warning', 'reject');--> statement-breakpoint
CREATE TYPE "public"."recording_method" AS ENUM('upload', 'record');--> statement-breakpoint
CREATE TABLE "alignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"alignment_method" "alignment_method" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analyses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_recording_id" uuid NOT NULL,
	"reference_speech_id" uuid NOT NULL,
	"processing_duration_ms" integer,
	"overall_score" numeric(5, 4),
	"confidence" numeric(5, 4),
	"target_phonemes" text,
	"recognized_phonemes" text,
	"phoneme_distance" integer,
	"phoneme_score" numeric(5, 4),
	"target_words" text,
	"recognized_words" text,
	"word_distance" integer,
	"word_score" numeric(5, 4),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_quality_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_recording_id" uuid NOT NULL,
	"snr_db" numeric(5, 2),
	"noise_ratio" numeric(5, 4),
	"silence_ratio" numeric(5, 4),
	"clipping_ratio" numeric(5, 4),
	"quality_status" "quality_status" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "authors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"accent" varchar(50),
	"style" varchar(50),
	"language_code" varchar(10),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "phoneme_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"error_type" "error_type" NOT NULL,
	"position" integer NOT NULL,
	"expected" varchar(10),
	"actual" varchar(10),
	"timestamp_start_ms" integer,
	"timestamp_end_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "practice_texts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reference_speeches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"author_id" uuid NOT NULL,
	"text_id" uuid NOT NULL,
	"generation_method" "generation_method" NOT NULL,
	"ipa_transcription" text,
	"ipa_method" "ipa_method",
	"priority" integer DEFAULT 0,
	"duration_ms" integer,
	"file_size_bytes" integer,
	"sample_rate_hz" integer,
	"channels" smallint,
	"bitrate_kbps" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"preferred_author_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_recordings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"storage_key" varchar(500) NOT NULL,
	"recording_method" "recording_method" NOT NULL,
	"reference_speech_id" uuid NOT NULL,
	"duration_ms" integer,
	"file_size_bytes" integer,
	"sample_rate_hz" integer,
	"channels" smallint,
	"bitrate_kbps" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "word_errors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"analysis_id" uuid NOT NULL,
	"error_type" "error_type" NOT NULL,
	"position" integer NOT NULL,
	"expected" varchar(100),
	"actual" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP TABLE "recordings" CASCADE;--> statement-breakpoint
DROP TABLE "texts" CASCADE;--> statement-breakpoint
ALTER TABLE "alignments" ADD CONSTRAINT "alignments_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_recording_id_user_recordings_id_fk" FOREIGN KEY ("user_recording_id") REFERENCES "public"."user_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_reference_speech_id_reference_speeches_id_fk" FOREIGN KEY ("reference_speech_id") REFERENCES "public"."reference_speeches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_quality_metrics" ADD CONSTRAINT "audio_quality_metrics_user_recording_id_user_recordings_id_fk" FOREIGN KEY ("user_recording_id") REFERENCES "public"."user_recordings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "phoneme_errors" ADD CONSTRAINT "phoneme_errors_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_speeches" ADD CONSTRAINT "reference_speeches_author_id_authors_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reference_speeches" ADD CONSTRAINT "reference_speeches_text_id_practice_texts_id_fk" FOREIGN KEY ("text_id") REFERENCES "public"."practice_texts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_preferred_author_id_authors_id_fk" FOREIGN KEY ("preferred_author_id") REFERENCES "public"."authors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_recordings" ADD CONSTRAINT "user_recordings_reference_speech_id_reference_speeches_id_fk" FOREIGN KEY ("reference_speech_id") REFERENCES "public"."reference_speeches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "word_errors" ADD CONSTRAINT "word_errors_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_analyses_user_recording_id" ON "analyses" USING btree ("user_recording_id");--> statement-breakpoint
CREATE INDEX "idx_analyses_created_at" ON "analyses" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_audio_quality_metrics_user_recording_id" ON "audio_quality_metrics" USING btree ("user_recording_id");--> statement-breakpoint
CREATE INDEX "idx_phoneme_errors_analysis_id" ON "phoneme_errors" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_phoneme_errors_type" ON "phoneme_errors" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "idx_phoneme_errors_expected" ON "phoneme_errors" USING btree ("expected");--> statement-breakpoint
CREATE INDEX "idx_phoneme_errors_actual" ON "phoneme_errors" USING btree ("actual");--> statement-breakpoint
CREATE INDEX "idx_reference_speeches_author_id" ON "reference_speeches" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "idx_reference_speeches_text_id" ON "reference_speeches" USING btree ("text_id");--> statement-breakpoint
CREATE INDEX "idx_user_preferences_user_id" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_recordings_user_id" ON "user_recordings" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_user_recordings_reference_speech_id" ON "user_recordings" USING btree ("reference_speech_id");--> statement-breakpoint
CREATE INDEX "idx_user_recordings_created_at" ON "user_recordings" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_word_errors_analysis_id" ON "word_errors" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "idx_word_errors_type" ON "word_errors" USING btree ("error_type");--> statement-breakpoint
CREATE INDEX "idx_word_errors_expected" ON "word_errors" USING btree ("expected");--> statement-breakpoint
CREATE INDEX "idx_word_errors_actual" ON "word_errors" USING btree ("actual");