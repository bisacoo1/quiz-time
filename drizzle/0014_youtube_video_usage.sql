CREATE TABLE "youtube_generation_usage" (
	"user_id" text NOT NULL,
	"usage_date" date NOT NULL,
	"count" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "youtube_generation_usage" ADD CONSTRAINT "youtube_generation_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "youtube_generation_usage_user_date_key" ON "youtube_generation_usage" USING btree ("user_id","usage_date");	