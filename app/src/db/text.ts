import { eq } from "drizzle-orm";
import { db } from "./index";
import { practiceTexts } from "./schema";
import type { NewPracticeText, PracticeText } from "./types";

export type { PracticeText, NewPracticeText };

export async function getPracticeTexts(): Promise<PracticeText[]> {
	return await db.select().from(practiceTexts);
}

export async function getPracticeTextById(
	id: string,
): Promise<PracticeText | null> {
	const [result] = await db
		.select()
		.from(practiceTexts)
		.where(eq(practiceTexts.id, id))
		.limit(1);
	return result || null;
}

export async function insertPracticeText(data: {
	content: string;
}): Promise<PracticeText> {
	const [result] = await db
		.insert(practiceTexts)
		.values({ content: data.content })
		.returning();
	return result;
}

export async function updatePracticeText(
	id: string,
	data: { content: string },
): Promise<PracticeText> {
	const [result] = await db
		.update(practiceTexts)
		.set({ content: data.content, updatedAt: new Date() })
		.where(eq(practiceTexts.id, id))
		.returning();
	return result;
}

export async function deletePracticeText(id: string): Promise<void> {
	await db.delete(practiceTexts).where(eq(practiceTexts.id, id));
}
