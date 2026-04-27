import { createServerFn } from "@tanstack/react-start";
import {
	getAnalysesOverTime,
	getOverviewStats,
	getProcessingTimeStats,
	getScoreDistribution,
	getTopPhonemeConfusions,
	getTopPhonemeErrors,
	getUserActivityList,
	type AnalysesOverTimePoint,
	type OverviewStats,
	type PhonemeConfusion,
	type PhonemeErrorStat,
	type ProcessingTimeStats,
	type ScoreDistributionBucket,
	type UserActivity,
} from "@/db/admin-stats";
import type { ApiResponse } from "./errors";
import {
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

export const serverGetOverviewStats = createServerFn({
	method: "GET",
}).handler(async (): Promise<ApiResponse<OverviewStats>> => {
	try {
		const stats = await getOverviewStats();
		return createSuccessResponse(stats);
	} catch (error) {
		console.error("Get overview stats error:", error);
		return createErrorResponse(
			ErrorCode.DATABASE_ERROR,
			"Failed to retrieve overview statistics",
			error instanceof Error
				? { originalError: error.message }
				: undefined,
			500,
		);
	}
});

export type AnalyticsData = {
	scoreDistribution: ScoreDistributionBucket[];
	topPhonemeErrors: PhonemeErrorStat[];
	topPhonemeConfusions: PhonemeConfusion[];
	analysesOverTime: AnalysesOverTimePoint[];
	processingTime: ProcessingTimeStats;
};

export const serverGetAnalyticsData = createServerFn({
	method: "GET",
}).handler(async (): Promise<ApiResponse<AnalyticsData>> => {
	try {
		const [
			scoreDistribution,
			topPhonemeErrors,
			topPhonemeConfusions,
			analysesOverTime,
			processingTime,
		] = await Promise.all([
			getScoreDistribution(),
			getTopPhonemeErrors(10),
			getTopPhonemeConfusions(10),
			getAnalysesOverTime(30),
			getProcessingTimeStats(),
		]);

		return createSuccessResponse({
			scoreDistribution,
			topPhonemeErrors,
			topPhonemeConfusions,
			analysesOverTime,
			processingTime,
		});
	} catch (error) {
		console.error("Get analytics data error:", error);
		return createErrorResponse(
			ErrorCode.DATABASE_ERROR,
			"Failed to retrieve analytics data",
			error instanceof Error
				? { originalError: error.message }
				: undefined,
			500,
		);
	}
});

export const serverGetUserActivity = createServerFn({
	method: "GET",
}).handler(async (): Promise<ApiResponse<UserActivity[]>> => {
	try {
		const users = await getUserActivityList();
		return createSuccessResponse(users);
	} catch (error) {
		console.error("Get user activity error:", error);
		return createErrorResponse(
			ErrorCode.DATABASE_ERROR,
			"Failed to retrieve user activity",
			error instanceof Error
				? { originalError: error.message }
				: undefined,
			500,
		);
	}
});
