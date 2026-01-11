ALTER TABLE "phoneme_errors" ADD COLUMN "target_position" integer;--> statement-breakpoint
ALTER TABLE "phoneme_errors" ADD COLUMN "actual_position" integer;--> statement-breakpoint
ALTER TABLE "word_errors" ADD COLUMN "target_position" integer;--> statement-breakpoint
ALTER TABLE "word_errors" ADD COLUMN "actual_position" integer;