import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const recordings = pgTable("recordings", {
	id: serial("id").primaryKey(),
	userId: text("user_id").notNull(),
	path: text("path").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
	deletedAt: timestamp("deleted_at"),
});

export const texts = pgTable("texts", {
	id: serial("id").primaryKey(),
	text: text("text").notNull(),
	createdAt: timestamp("created_at").defaultNow(),
	updatedAt: timestamp("updated_at").defaultNow(),
	deletedAt: timestamp("deleted_at"),
});
