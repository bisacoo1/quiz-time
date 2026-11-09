CREATE TABLE "document_upload_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"storage_path" text NOT NULL,
	"reserved_bytes" integer NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "document_upload_reservations_storage_path_unique" UNIQUE("storage_path")
);
--> statement-breakpoint
ALTER TABLE "document_upload_reservations" ADD CONSTRAINT "document_upload_reservations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "document_upload_reservations_user_expires_idx" ON "document_upload_reservations" USING btree ("user_id","expires_at");