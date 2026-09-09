import { pgTable, serial, text, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";

export const studySessions = pgTable("study_sessions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  sourceType: text("source_type").notNull(), // 'pdf' | 'image'
  sourceText: text("source_text"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const flashcards = pgTable("flashcards", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => studySessions.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  hint: text("hint"),
  difficulty: text("difficulty").notNull().default("medium"), // 'easy' | 'medium' | 'hard'
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const cardProgress = pgTable("card_progress", {
  id: serial("id").primaryKey(),
  cardId: integer("card_id").notNull().references(() => flashcards.id, { onDelete: "cascade" }),
  sessionId: integer("session_id").notNull().references(() => studySessions.id, { onDelete: "cascade" }),
  isKnown: boolean("is_known").notNull().default(false),
  attempts: integer("attempts").notNull().default(0),
  lastReviewedAt: timestamp("last_reviewed_at").defaultNow(),
});

export type StudySession = typeof studySessions.$inferSelect;
export type Flashcard = typeof flashcards.$inferSelect;
export type CardProgress = typeof cardProgress.$inferSelect;
