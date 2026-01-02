CREATE TYPE "public"."text_difficulty" AS ENUM('beginner', 'intermediate', 'advanced');--> statement-breakpoint
CREATE TYPE "public"."text_type" AS ENUM('daily', 'professional', 'academic', 'phonetic_challenge', 'common_phrase');--> statement-breakpoint
ALTER TABLE "practice_texts" ADD COLUMN "difficulty" text_difficulty NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_texts" ADD COLUMN "word_count" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_texts" ADD COLUMN "type" text_type NOT NULL;--> statement-breakpoint
ALTER TABLE "practice_texts" ADD COLUMN "note" text;--> statement-breakpoint
CREATE INDEX "idx_practice_texts_difficulty" ON "practice_texts" USING btree ("difficulty");--> statement-breakpoint
CREATE INDEX "idx_practice_texts_type" ON "practice_texts" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_practice_texts_difficulty_type" ON "practice_texts" USING btree ("difficulty","type");