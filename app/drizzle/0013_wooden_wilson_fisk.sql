ALTER TABLE "analyses" ADD COLUMN IF NOT EXISTS "abstention_reason" text;--> statement-breakpoint
ALTER TABLE "phoneme_errors" ADD COLUMN IF NOT EXISTS "gop_score" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "phoneme_errors" ADD COLUMN IF NOT EXISTS "entropy" numeric(6, 3);--> statement-breakpoint
ALTER TABLE "phoneme_errors" ADD COLUMN IF NOT EXISTS "uncertain" boolean DEFAULT false;
