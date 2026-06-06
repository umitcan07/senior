ALTER TYPE "public"."alignment_method" ADD VALUE IF NOT EXISTS 'powsm_ctc';--> statement-breakpoint
ALTER TABLE "phoneme_errors" ADD COLUMN IF NOT EXISTS "target_position" integer;--> statement-breakpoint
ALTER TABLE "phoneme_errors" ADD COLUMN IF NOT EXISTS "actual_position" integer;--> statement-breakpoint
ALTER TABLE "word_errors" ADD COLUMN IF NOT EXISTS "target_position" integer;--> statement-breakpoint
ALTER TABLE "word_errors" ADD COLUMN IF NOT EXISTS "actual_position" integer;