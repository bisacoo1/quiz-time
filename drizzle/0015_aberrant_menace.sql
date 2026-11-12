CREATE TABLE "board_exam_questions" (
	"id" serial PRIMARY KEY NOT NULL,
	"exam_code" text NOT NULL,
	"subject_code" text NOT NULL,
	"year" integer NOT NULL,
	"session" text NOT NULL,
	"question" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"explanation" text,
	"difficulty" text DEFAULT 'medium' NOT NULL,
	"topic_tags" text[] DEFAULT '{}' NOT NULL,
	"source" text DEFAULT 'curated' NOT NULL,
	"contributed_by" text,
	"verification_status" text DEFAULT 'unverified' NOT NULL,
	"verification_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "board_exam_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"exam_code" text NOT NULL,
	"config" jsonb NOT NULL,
	"score" real NOT NULL,
	"passed" boolean NOT NULL,
	"time_used_minutes" integer NOT NULL,
	"subject_results" jsonb NOT NULL,
	"answers" jsonb NOT NULL,
	"flagged_questions" integer[] DEFAULT '{}' NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_feedback" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"rating" integer DEFAULT 5 NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"local_date" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "board_exam_code" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "target_exam_date" date;--> statement-breakpoint
ALTER TABLE "board_exam_questions" ADD CONSTRAINT "board_exam_questions_contributed_by_users_id_fk" FOREIGN KEY ("contributed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "board_exam_sessions" ADD CONSTRAINT "board_exam_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "user_feedback" ADD CONSTRAINT "user_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "board_exam_questions_exam_subject_idx" ON "board_exam_questions" USING btree ("exam_code","subject_code");--> statement-breakpoint
CREATE INDEX "board_exam_questions_year_session_idx" ON "board_exam_questions" USING btree ("year","session");--> statement-breakpoint
CREATE INDEX "board_exam_questions_verification_idx" ON "board_exam_questions" USING btree ("verification_status");--> statement-breakpoint
CREATE INDEX "board_exam_questions_topic_tags_idx" ON "board_exam_questions" USING btree ("topic_tags");--> statement-breakpoint
CREATE INDEX "board_exam_sessions_user_idx" ON "board_exam_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "board_exam_sessions_exam_idx" ON "board_exam_sessions" USING btree ("exam_code");--> statement-breakpoint
CREATE INDEX "board_exam_sessions_completed_idx" ON "board_exam_sessions" USING btree ("completed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "user_feedback_user_day_key" ON "user_feedback" USING btree ("user_id","local_date");--> statement-breakpoint
CREATE INDEX "user_feedback_user_id_idx" ON "user_feedback" USING btree ("user_id");