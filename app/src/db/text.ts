import { db } from './index';
import { texts } from './schema';
import { eq } from 'drizzle-orm';
import type { InferSelectModel, InferInsertModel } from 'drizzle-orm';

export type Text = InferSelectModel<typeof texts>;
export type NewText = InferInsertModel<typeof texts>;

export async function getTexts(): Promise<Text[]> {
	return await db.select().from(texts);
}

export async function getTextById(id: number): Promise<Text | null> {
	const [result] = await db.select().from(texts).where(eq(texts.id, id)).limit(1);
	return result || null;
}

export async function insertText(data: { text: string }): Promise<Text> {
	const [result] = await db.insert(texts).values({ text: data.text }).returning();
	return result;
}

export async function updateText(id: number, data: { text: string }): Promise<Text> {
	const [result] = await db
		.update(texts)
		.set({ text: data.text })
		.where(eq(texts.id, id))
		.returning();
	return result;
}

export async function deleteText(id: number): Promise<void> {
	await db.delete(texts).where(eq(texts.id, id));
}

