import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "./index";
import {
	analyses,
	audioQualityMetrics,
	phonemeErrors,
	practiceTexts,
	referenceSpeeches,
	userRecordings,
} from "./schema";

// Types

export type OverviewStats = {
	totalUsers: number;
	totalAnalyses: number;
	analysesByStatus: { status: string; count: number }[];
	totalTexts: number;
	textsByDifficulty: { difficulty: string; count: number }[];
	totalReferences: number;
	averageScore: number;
	audioQualityDistribution: { status: string; count: number }[];
};

export type ScoreDistributionBucket = {
	range: string;
	count: number;
};

export type PhonemeErrorStat = {
	expected: string;
	count: number;
};

export type PhonemeConfusion = {
	expected: string;
	actual: string;
	count: number;
};

export type AnalysesOverTimePoint = {
	date: string;
	count: number;
};

export type ProcessingTimeStats = {
	avgMs: number;
	minMs: number;
	maxMs: number;
	medianMs: number;
};

export type UserActivity = {
	userId: string;
	totalRecordings: number;
	totalAnalyses: number;
	averageScore: number | null;
	lastActiveDate: Date;
};

// Queries

export async function getOverviewStats(): Promise<OverviewStats> {
	const [
		totalUsersResult,
		totalAnalysesResult,
		analysesByStatusResult,
		totalTextsResult,
		textsByDifficultyResult,
		totalReferencesResult,
		averageScoreResult,
		audioQualityResult,
	] = await Promise.all([
		db
			.select({
				count: sql<number>`COUNT(DISTINCT ${userRecordings.userId})::int`,
			})
			.from(userRecordings),
		db
			.select({
				count: sql<number>`COUNT(*)::int`,
			})
			.from(analyses),
		db
			.select({
				status: analyses.status,
				count: sql<number>`COUNT(*)::int`,
			})
			.from(analyses)
			.groupBy(analyses.status),
		db
			.select({
				count: sql<number>`COUNT(*)::int`,
			})
			.from(practiceTexts),
		db
			.select({
				difficulty: practiceTexts.difficulty,
				count: sql<number>`COUNT(*)::int`,
			})
			.from(practiceTexts)
			.groupBy(practiceTexts.difficulty),
		db
			.select({
				count: sql<number>`COUNT(*)::int`,
			})
			.from(referenceSpeeches),
		db
			.select({
				avg: sql<number>`COALESCE(AVG(${analyses.overallScore}) * 100, 0)::int`,
			})
			.from(analyses)
			.where(
				and(
					eq(analyses.status, "completed"),
					sql`${analyses.overallScore} IS NOT NULL`,
				),
			),
		db
			.select({
				status: audioQualityMetrics.qualityStatus,
				count: sql<number>`COUNT(*)::int`,
			})
			.from(audioQualityMetrics)
			.groupBy(audioQualityMetrics.qualityStatus),
	]);

	return {
		totalUsers: totalUsersResult[0]?.count ?? 0,
		totalAnalyses: totalAnalysesResult[0]?.count ?? 0,
		analysesByStatus: analysesByStatusResult,
		totalTexts: totalTextsResult[0]?.count ?? 0,
		textsByDifficulty: textsByDifficultyResult,
		totalReferences: totalReferencesResult[0]?.count ?? 0,
		averageScore: averageScoreResult[0]?.avg ?? 0,
		audioQualityDistribution: audioQualityResult,
	};
}

export async function getScoreDistribution(): Promise<
	ScoreDistributionBucket[]
> {
	const results = await db
		.select({
			range: sql<string>`CASE
				WHEN ${analyses.overallScore} * 100 < 20 THEN '0-20'
				WHEN ${analyses.overallScore} * 100 < 40 THEN '20-40'
				WHEN ${analyses.overallScore} * 100 < 60 THEN '40-60'
				WHEN ${analyses.overallScore} * 100 < 80 THEN '60-80'
				ELSE '80-100'
			END`,
			count: sql<number>`COUNT(*)::int`,
		})
		.from(analyses)
		.where(
			and(
				eq(analyses.status, "completed"),
				sql`${analyses.overallScore} IS NOT NULL`,
			),
		)
		.groupBy(
			sql`CASE
				WHEN ${analyses.overallScore} * 100 < 20 THEN '0-20'
				WHEN ${analyses.overallScore} * 100 < 40 THEN '20-40'
				WHEN ${analyses.overallScore} * 100 < 60 THEN '40-60'
				WHEN ${analyses.overallScore} * 100 < 80 THEN '60-80'
				ELSE '80-100'
			END`,
		);

	// Ensure all buckets exist even if empty
	const bucketOrder = ["0-20", "20-40", "40-60", "60-80", "80-100"];
	return bucketOrder.map((range) => ({
		range,
		count: results.find((r) => r.range === range)?.count ?? 0,
	}));
}

export async function getTopPhonemeErrors(
	limit = 10,
): Promise<PhonemeErrorStat[]> {
	const results = await db
		.select({
			expected: phonemeErrors.expected,
			count: sql<number>`COUNT(*)::int`,
		})
		.from(phonemeErrors)
		.innerJoin(analyses, eq(phonemeErrors.analysisId, analyses.id))
		.where(
			and(
				eq(analyses.status, "completed"),
				sql`${phonemeErrors.expected} IS NOT NULL`,
			),
		)
		.groupBy(phonemeErrors.expected)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(limit);

	return results
		.filter((r) => r.expected !== null)
		.map((r) => ({
			expected: r.expected!,
			count: r.count,
		}));
}

export async function getTopPhonemeConfusions(
	limit = 10,
): Promise<PhonemeConfusion[]> {
	const results = await db
		.select({
			expected: phonemeErrors.expected,
			actual: phonemeErrors.actual,
			count: sql<number>`COUNT(*)::int`,
		})
		.from(phonemeErrors)
		.innerJoin(analyses, eq(phonemeErrors.analysisId, analyses.id))
		.where(
			and(
				eq(analyses.status, "completed"),
				sql`${phonemeErrors.expected} IS NOT NULL`,
				sql`${phonemeErrors.actual} IS NOT NULL`,
			),
		)
		.groupBy(phonemeErrors.expected, phonemeErrors.actual)
		.orderBy(desc(sql`COUNT(*)`))
		.limit(limit);

	return results
		.filter((r) => r.expected !== null && r.actual !== null)
		.map((r) => ({
			expected: r.expected!,
			actual: r.actual!,
			count: r.count,
		}));
}

export async function getAnalysesOverTime(
	days = 30,
): Promise<AnalysesOverTimePoint[]> {
	const startDate = new Date();
	startDate.setDate(startDate.getDate() - days);

	const results = await db
		.select({
			date: sql<string>`DATE(${analyses.createdAt})::text`,
			count: sql<number>`COUNT(*)::int`,
		})
		.from(analyses)
		.where(gte(analyses.createdAt, startDate))
		.groupBy(sql`DATE(${analyses.createdAt})`)
		.orderBy(sql`DATE(${analyses.createdAt})`);

	return results;
}

export async function getProcessingTimeStats(): Promise<ProcessingTimeStats> {
	const results = await db
		.select({
			avgMs: sql<number>`COALESCE(AVG(${analyses.processingDurationMs}), 0)::int`,
			minMs: sql<number>`COALESCE(MIN(${analyses.processingDurationMs}), 0)::int`,
			maxMs: sql<number>`COALESCE(MAX(${analyses.processingDurationMs}), 0)::int`,
			medianMs: sql<number>`COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ${analyses.processingDurationMs}), 0)::int`,
		})
		.from(analyses)
		.where(
			and(
				eq(analyses.status, "completed"),
				sql`${analyses.processingDurationMs} IS NOT NULL`,
			),
		);

	return {
		avgMs: results[0]?.avgMs ?? 0,
		minMs: results[0]?.minMs ?? 0,
		maxMs: results[0]?.maxMs ?? 0,
		medianMs: results[0]?.medianMs ?? 0,
	};
}

export async function getUserActivityList(): Promise<UserActivity[]> {
	const results = await db
		.select({
			userId: userRecordings.userId,
			totalRecordings: sql<number>`COUNT(DISTINCT ${userRecordings.id})::int`,
			totalAnalyses: sql<number>`COUNT(DISTINCT ${analyses.id})::int`,
			averageScore: sql<number | null>`CASE
				WHEN COUNT(CASE WHEN ${analyses.status} = 'completed' AND ${analyses.overallScore} IS NOT NULL THEN 1 END) > 0
				THEN (AVG(CASE WHEN ${analyses.status} = 'completed' THEN ${analyses.overallScore} END) * 100)::int
				ELSE NULL
			END`,
			lastActiveDate: sql<Date>`MAX(${userRecordings.createdAt})`,
		})
		.from(userRecordings)
		.leftJoin(analyses, eq(analyses.userRecordingId, userRecordings.id))
		.groupBy(userRecordings.userId)
		.orderBy(desc(sql`MAX(${userRecordings.createdAt})`));

	return results.map((r) => ({
		userId: r.userId,
		totalRecordings: r.totalRecordings,
		totalAnalyses: r.totalAnalyses,
		averageScore: r.averageScore,
		lastActiveDate: r.lastActiveDate,
	}));
}
