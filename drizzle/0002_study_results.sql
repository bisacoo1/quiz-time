-- Idempotent: safe to run on a fresh database AND on a database that was
-- already updated with the hand-pasted SQL from the Supabase note.
CREATE TABLE IF NOT EXISTS "study_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"session_id" integer NOT NULL,
	"card_id" integer NOT NULL,
	"correct" boolean NOT NULL,
	"mode" text DEFAULT 'study' NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "study_results" ADD CONSTRAINT "study_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "study_results" ADD CONSTRAINT "study_results_session_id_study_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."study_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "study_results" ADD CONSTRAINT "study_results_card_id_flashcards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."flashcards"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_results_user_id_idx" ON "study_results" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_results_session_id_idx" ON "study_results" USING btree ("session_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_results_card_id_idx" ON "study_results" USING btree ("card_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "study_results_user_answered_idx" ON "study_results" USING btree ("user_id","answered_at");
