CREATE TABLE "document_highlights" (
	"id" serial PRIMARY KEY NOT NULL,
	"document_id" integer NOT NULL,
	"quote" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"rects" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "document_highlights" ADD CONSTRAINT "document_highlights_document_id_saved_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."saved_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "document_highlights_document_created_idx" ON "document_highlights" USING btree ("document_id","created_at","id");