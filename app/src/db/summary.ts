import { and, desc, eq, gte, lt, sql } from "drizzle-orm";
import type { ChallengeAggregate } from "@/lib/phone-profile";
import { db } from "./index";
import {
	analyses,
	phonemeErrors,
	practiceTexts,
	referenceSpeeches,
	userRecordings,
} from "./schema";

export type UserAttempt = {
	id: string;
	textId: string;
	textPreview: string;
	score: number | null; // null for pending/processing/failed and abstained
	date: Date;
	analysisId: string;
	status: "pending" | "processing" | "completed" | "failed";
	// Non-null when the worker abstained (completed but unscored) — #20/#38.
	abstentionReason: string | null;
};

export type AttemptStats = {
	totalAttempts: number;
	weeklyAttempts: number;
	averageScore: number;
	weeklyProgress: number;
};

/** Half-life (days) for recency weighting of the challenge profile: an error from this
 * many days ago counts half as much toward "what to work on now". */
export const RECENCY_HALFLIFE_DAYS = 14;

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
			score: sql<
				number | null
			>`CASE WHEN ${analyses.status} = 'completed' AND ${analyses.overallScore} IS NOT NULL THEN (${analyses.overallScore} * 100)::int ELSE NULL END`,
			date: analyses.createdAt,
			analysisId: analyses.id,
			status: analyses.status,
			abstentionReason: analyses.abstentionReason,
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
		abstentionReason: row.abstentionReason,
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
			and(eq(userRecordings.userId, userId), eq(analyses.status, "completed")),
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
			? Math.round(
					((weeklyCount - previousWeekCount) / previousWeekCount) * 100,
				)
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
 * Recency-weighted phoneme challenge profile for a user (E7.6 / #57).
 *
 * Unlike the old "common errors" query (which grouped by target phone and dropped
 * insertions), this groups by the full (errorType, expected, actual) tuple so the
 * caller can split the three edit-distance modes:
 *   - substitute → directional contrast pair (carries featureDistance/featureDelta),
 *   - delete     → a dropped target phone,
 *   - insert     → an added phone (epenthesis), which the old query hid entirely.
 *
 * Scoped to scored attempts only (completed AND not abstained). Each group carries a
 * recency weight — Σ of an exponential decay with RECENCY_HALFLIFE_DAYS — so sounds the
 * learner has recently stopped missing fade out. featureDelta is deterministic per
 * (expected, actual), so the latest row's delta is a faithful representative.
 *
 * Severity, hints and category labels are applied app-side by
 * `buildPronunciationProfile` (Architecture B) — this layer only does the grouping.
 */
export async function getPhonemeChallengeProfile(
	userId: string,
): Promise<ChallengeAggregate[]> {
	const rows = await db
		.select({
			errorType: phonemeErrors.errorType,
			expected: phonemeErrors.expected,
			actual: phonemeErrors.actual,
			count: sql<number>`COUNT(*)::int`,
			// Exponential recency decay: 0.5 ^ (age_days / half-life), summed per group.
			recencyWeight: sql<number>`COALESCE(SUM(POWER(0.5, (EXTRACT(EPOCH FROM now()) - EXTRACT(EPOCH FROM ${analyses.createdAt})) / 86400.0 / ${RECENCY_HALFLIFE_DAYS})), 0)::float8`,
			avgDistance: sql<string | null>`AVG(${phonemeErrors.featureDistance})`,
			// Latest row's feature delta — deterministic per (expected, actual) pair.
			sampleDelta: sql<Array<{
				feature: string;
				ref: string;
				user: string;
			}> | null>`(array_agg(${phonemeErrors.featureDelta} ORDER BY ${analyses.createdAt} DESC))[1]`,
			uncertainCount: sql<number>`SUM(CASE WHEN ${phonemeErrors.uncertain} THEN 1 ELSE 0 END)::int`,
			lastSeen: sql<string>`MAX(${analyses.createdAt})`,
		})
		.from(phonemeErrors)
		.innerJoin(analyses, eq(phonemeErrors.analysisId, analyses.id))
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.where(
			and(
				eq(userRecordings.userId, userId),
				eq(analyses.status, "completed"),
				sql`${analyses.abstentionReason} IS NULL`,
			),
		)
		.groupBy(
			phonemeErrors.errorType,
			phonemeErrors.expected,
			phonemeErrors.actual,
		);

	return rows.map((r) => ({
		errorType: r.errorType,
		expected: r.expected,
		actual: r.actual,
		count: r.count,
		recencyWeight: Number(r.recencyWeight) || 0,
		avgDistance: r.avgDistance,
		sampleDelta: r.sampleDelta ?? null,
		uncertainCount: r.uncertainCount,
		lastSeen: new Date(r.lastSeen),
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
