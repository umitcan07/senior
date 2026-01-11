import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "./index";
import {
	analyses,
	practiceTexts,
	referenceSpeeches,
	userRecordings,
	phonemeErrors,
} from "./schema";

export type UserAttempt = {
	id: string;
	textId: string;
	textPreview: string;
	score: number | null; // null for pending/processing/failed
	date: Date;
	analysisId: string;
	status: "pending" | "processing" | "completed" | "failed";
};

export type AttemptStats = {
	totalAttempts: number;
	weeklyAttempts: number;
	averageScore: number;
	weeklyProgress: number;
};

export type CommonError = {
	phoneme: string;
	count: number;
};

/**
 * Get user attempts with text information
 * Joins analyses -> user_recordings -> reference_speeches -> practice_texts
 */
export async function getUserAttempts(
	userId: string,
	options?: {
		textId?: string;
		limit?: number;
		offset?: number;
	},
): Promise<UserAttempt[]> {
	const { textId, limit, offset } = options || {};

	const conditions = [eq(userRecordings.userId, userId)];
	if (textId) {
		conditions.push(eq(practiceTexts.id, textId));
	}

	let query = db
		.select({
			id: analyses.id,
			textId: practiceTexts.id,
			textPreview: practiceTexts.content,
			score: sql<number | null>`CASE WHEN ${analyses.status} = 'completed' AND ${analyses.overallScore} IS NOT NULL THEN (${analyses.overallScore} * 100)::int ELSE NULL END`,
			date: analyses.createdAt,
			analysisId: analyses.id,
			status: analyses.status,
		})
		.from(analyses)
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.innerJoin(
			referenceSpeeches,
			eq(userRecordings.referenceSpeechId, referenceSpeeches.id),
		)
		.innerJoin(practiceTexts, eq(referenceSpeeches.textId, practiceTexts.id))
		.where(and(...conditions))
		.orderBy(desc(analyses.createdAt));

	// Apply limit and offset if provided
	if (limit) {
		query = query.limit(limit) as typeof query;
	}
	if (offset) {
		query = query.offset(offset) as typeof query;
	}

	const results = await query;

	return results.map((row) => ({
		id: row.id,
		textId: row.textId,
		textPreview:
			row.textPreview.length > 50
				? `${row.textPreview.slice(0, 50)}...`
				: row.textPreview,
		score: row.score,
		date: row.date,
		analysisId: row.analysisId,
		status: row.status,
	}));
}

/**
 * Get attempt statistics for a user
 */
export async function getUserAttemptStats(
	userId: string,
): Promise<AttemptStats> {
	const now = new Date();
	const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

	// Get all completed attempts (only completed analyses have scores)
	const allAttempts = await db
		.select({
			score: sql<number>`COALESCE((${analyses.overallScore} * 100)::int, 0)`,
			createdAt: analyses.createdAt,
		})
		.from(analyses)
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.where(
			and(
				eq(userRecordings.userId, userId),
				eq(analyses.status, "completed"),
			),
		);

	// Get weekly completed attempts (only completed for consistency with totalAttempts)
	const weeklyAttemptsResult = await db
		.select({
			count: sql<number>`COUNT(*)::int`,
		})
		.from(analyses)
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.where(
			and(
				eq(userRecordings.userId, userId),
				eq(analyses.status, "completed"),
				gte(analyses.createdAt, oneWeekAgo),
			),
		);

	// Get previous week completed attempts for progress calculation
	const previousWeekAttemptsResult = await db
		.select({
			count: sql<number>`COUNT(*)::int`,
		})
		.from(analyses)
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.where(
			and(
				eq(userRecordings.userId, userId),
				eq(analyses.status, "completed"),
				gte(analyses.createdAt, twoWeeksAgo),
				lt(analyses.createdAt, oneWeekAgo),
			),
		);

	const totalAttempts = allAttempts.length;
	const weeklyCount = weeklyAttemptsResult[0]?.count ?? 0;
	const previousWeekCount = previousWeekAttemptsResult[0]?.count ?? 0;

	// Calculate average score
	const averageScore =
		allAttempts.length > 0
			? Math.round(
					allAttempts.reduce((sum, a) => sum + a.score, 0) / allAttempts.length,
				)
			: 0;

	// Calculate weekly progress (percentage change)
	const weeklyProgress =
		previousWeekCount > 0
			? Math.round(((weeklyCount - previousWeekCount) / previousWeekCount) * 100)
			: weeklyCount > 0
				? 100
				: 0;

	return {
		totalAttempts,
		weeklyAttempts: weeklyCount,
		averageScore,
		weeklyProgress,
	};
}

/**
 * Get common phoneme errors for a user
 * Aggregates phoneme errors from all completed analyses
 */
export async function getCommonPhonemeErrors(
	userId: string,
	limit: number = 10,
): Promise<CommonError[]> {
	const results = await db
		.select({
			phoneme: phonemeErrors.expected,
			count: sql<number>`COUNT(*)::int`,
		})
		.from(phonemeErrors)
		.innerJoin(analyses, eq(phonemeErrors.analysisId, analyses.id))
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.where(
			and(
				eq(userRecordings.userId, userId),
				eq(analyses.status, "completed"),
				sql`${phonemeErrors.expected} IS NOT NULL`,
			),
		)
		.groupBy(phonemeErrors.expected)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(limit);

	return results
		.filter((r) => r.phoneme !== null)
		.map((r) => ({
			phoneme: r.phoneme!,
			count: r.count,
		}));
}

/**
 * Get all practice texts that have attempts
 */
export async function getTextsWithAttempts(
	userId: string,
): Promise<Array<{ id: string; content: string }>> {
	const results = await db
		.selectDistinct({
			id: practiceTexts.id,
			content: practiceTexts.content,
		})
		.from(analyses)
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.innerJoin(
			referenceSpeeches,
			eq(userRecordings.referenceSpeechId, referenceSpeeches.id),
		)
		.innerJoin(practiceTexts, eq(referenceSpeeches.textId, practiceTexts.id))
		.where(eq(userRecordings.userId, userId));

	return results;
}

