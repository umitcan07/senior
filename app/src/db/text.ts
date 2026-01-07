import { count, eq, max, sql } from "drizzle-orm";
import { db } from "./index";
import { analyses, authors, practiceTexts, referenceSpeeches, userRecordings } from "./schema";
import type {
	NewPracticeText,
	PracticeText,
	TextDifficulty,
	TextType,
} from "./types";

export type { PracticeText, NewPracticeText };

// Use schema-inferred type with additional computed field
export type PracticeTextWithReferenceCount = PracticeText & {
	referenceCount: number;
	usCount: number;
	ukCount: number;
};

// Extended type with attempt stats
export type PracticeTextWithAttemptStats = PracticeTextWithReferenceCount & {
	attemptCount: number;
	bestScore: number | null;
	lastAttemptDate: Date | null;
};

/**
 * Calculate word count from text content
 */
function calculateWordCount(content: string): number {
	return content
		.trim()
		.split(/\s+/)
		.filter((word) => word.length > 0).length;
}

export async function getPracticeTexts(): Promise<PracticeText[]> {
	return await db.select().from(practiceTexts);
}

export async function getPracticeTextsWithReferenceCounts(): Promise<
	PracticeTextWithReferenceCount[]
> {
	const result = await db
		.select({
			id: practiceTexts.id,
			content: practiceTexts.content,
			difficulty: practiceTexts.difficulty,
			wordCount: practiceTexts.wordCount,
			type: practiceTexts.type,
			note: practiceTexts.note,
			createdAt: practiceTexts.createdAt,
			updatedAt: practiceTexts.updatedAt,
			referenceCount: count(referenceSpeeches.id),
			usCount: sql<number>`count(case when ${authors.accent} = 'US' then 1 end)`.mapWith(Number),
			ukCount: sql<number>`count(case when ${authors.accent} = 'UK' then 1 end)`.mapWith(Number),
		})
		.from(practiceTexts)
		.leftJoin(referenceSpeeches, eq(practiceTexts.id, referenceSpeeches.textId))
		.leftJoin(authors, eq(referenceSpeeches.authorId, authors.id))
		.groupBy(practiceTexts.id)
		.orderBy(practiceTexts.createdAt);

	return result;
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
	difficulty: TextDifficulty;
	type: TextType;
	wordCount?: number;
	note?: string | null;
}): Promise<PracticeText> {
	const wordCount = data.wordCount ?? calculateWordCount(data.content);

	const [result] = await db
		.insert(practiceTexts)
		.values({
			content: data.content,
			difficulty: data.difficulty,
			type: data.type,
			wordCount,
			note: data.note ?? null,
		})
		.returning();
	return result;
}

export async function updatePracticeText(
	id: string,
	data: {
		content?: string;
		difficulty?: TextDifficulty;
		type?: TextType;
		wordCount?: number;
		note?: string | null;
	},
): Promise<PracticeText> {
	const updateData: Partial<NewPracticeText> = {
		updatedAt: new Date(),
	};

	if (data.content !== undefined) {
		updateData.content = data.content;
		const wordCount = data.wordCount ?? calculateWordCount(data.content);
		updateData.wordCount = wordCount;
	}

	if (data.difficulty !== undefined) {
		updateData.difficulty = data.difficulty;
	}

	if (data.type !== undefined) {
		updateData.type = data.type;
	}

	if (data.wordCount !== undefined) {
		updateData.wordCount = data.wordCount;
	}

	if (data.note !== undefined) {
		updateData.note = data.note;
	}

	const [result] = await db
		.update(practiceTexts)
		.set(updateData)
		.where(eq(practiceTexts.id, id))
		.returning();
	return result;
}

export async function deletePracticeText(id: string): Promise<void> {
	await db.delete(practiceTexts).where(eq(practiceTexts.id, id));
}

/**
 * Get practice texts with reference counts AND user attempt stats
 * This function fetches texts and enriches them with the user's attempt history
 */
export async function getPracticeTextsWithAttemptStats(
	userId: string,
): Promise<PracticeTextWithAttemptStats[]> {
	// First, get texts with reference counts
	const textsWithRefs = await getPracticeTextsWithReferenceCounts();

	// Then, get attempt stats for this user
	const attemptStats = await db
		.select({
			textId: referenceSpeeches.textId,
			attemptCount: count(analyses.id),
			bestScore: max(analyses.overallScore),
			lastAttemptDate: max(analyses.createdAt),
		})
		.from(analyses)
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.innerJoin(
			referenceSpeeches,
			eq(userRecordings.referenceSpeechId, referenceSpeeches.id),
		)
		.where(eq(userRecordings.userId, userId))
		.groupBy(referenceSpeeches.textId);

	// Create a map for O(1) lookup
	const statsMap = new Map(
		attemptStats.map((stat) => [stat.textId, stat]),
	);

	// Merge the data
	return textsWithRefs.map((text) => {
		const stats = statsMap.get(text.id);
		return {
			...text,
			attemptCount: stats?.attemptCount ?? 0,
			bestScore: stats?.bestScore
				? Number.parseFloat(stats.bestScore) * 100
				: null,
			lastAttemptDate: stats?.lastAttemptDate ?? null,
			usCount: text.usCount,
			ukCount: text.ukCount,
		};
	});
}
