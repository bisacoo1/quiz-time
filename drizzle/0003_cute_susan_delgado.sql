-- Idempotent: safe to re-run. Re-points the user FKs at ON UPDATE cascade so
-- that re-keying a user row (same email signing in under a new Google `sub`
-- — see src/auth.ts) moves that user's decks and study results along with
-- the id instead of failing the update.
DO $$
BEGIN
    ALTER TABLE "study_sessions" DROP CONSTRAINT IF EXISTS "study_sessions_user_id_users_id_fk";
    ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$
BEGIN
    ALTER TABLE "study_results" DROP CONSTRAINT IF EXISTS "study_results_user_id_users_id_fk";
    ALTER TABLE "study_results" ADD CONSTRAINT "study_results_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
