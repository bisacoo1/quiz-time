-- Idempotent: safe to run on a fresh database AND on databases that were
-- already created with the hand-pasted SQL from the old README.
CREATE TABLE IF NOT EXISTS "card_progress" (
	"id" serial PRIMARY KEY NOT NULL,
	"card_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"is_known" boolean DEFAULT false NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_reviewed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "flashcards" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"hint" text,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "study_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source_type" text NOT NULL,
	"source_text" text,
	"summary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Databases created from the old README SQL already have "summary"-less
-- tables, so make sure the new column exists in both paths.
ALTER TABLE "study_sessions" ADD COLUMN IF NOT EXISTS "summary" text;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_card_id_flashcards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "card_progress" ADD CONSTRAINT "card_progress_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
-- Drop any duplicated progress rows that may exist in older databases
-- (keep the most recent one), so the unique index below can be created.
DELETE FROM "card_progress" USING "card_progress" cp2
WHERE "card_progress"."card_id" = cp2."card_id"
  AND "card_progress"."session_id" = cp2."session_id"
  AND "card_progress"."id" < cp2."id";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "card_progress_card_session_key" ON "card_progress" USING btree ("card_id","session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_progress_session_id_idx" ON "card_progress" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "card_progress_card_id_idx" ON "card_progress" USING btree ("card_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "flashcards_session_id_idx" ON "flashcards" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_sessions_created_at_idx" ON "study_sessions" USING btree ("created_at");
