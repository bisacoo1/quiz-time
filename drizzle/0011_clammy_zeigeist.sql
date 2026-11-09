CREATE TABLE "document_tutor_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_tutor_messages" ADD CONSTRAINT "document_tutor_messages_document_id_saved_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."saved_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_tutor_messages_document_created_idx" ON "document_tutor_messages" USING btree ("document_id","created_at","id");