import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	getCommonPhonemeErrors,
	getTextsWithAttempts,
	getUserAttempts,
	getUserAttemptStats,
	type CommonError,
	type UserAttempt,
} from "@/db/summary";
import type { ApiResponse } from "./errors";
import {
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

export type SummaryData = {
	attempts: UserAttempt[];
	stats: {
		totalAttempts: number;
		weeklyAttempts: number;
		averageScore: number;
		weeklyProgress: number;
	};
	commonErrors: CommonError[];
	texts: Array<{ id: string; content: string }>;
};

/**
 * Get summary data for the current user
 * Requires authentication - returns error if user is not authenticated.
 */
export const serverGetSummary = createServerFn({ method: "GET" }).handler(
	async (): Promise<ApiResponse<SummaryData>> => {
		try {
			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/d2b68487-89be-4953-bab3-f54ee4c6a9fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server-summary.ts:38',message:'serverGetSummary called',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'route-transition',hypothesisId:'B'})}).catch(()=>{});
			// #endregion
			// Get authenticated userId from Clerk
			let isAuthenticated = false;
			let userId: string | null = null;
			try {
				const authResult = await auth();
				isAuthenticated = authResult.isAuthenticated ?? false;
				userId = authResult.userId ?? null;
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/d2b68487-89be-4953-bab3-f54ee4c6a9fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server-summary.ts:47',message:'Auth in server function',data:{isAuthenticated,userId:userId?.substring(0,10)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'route-transition',hypothesisId:'B'})}).catch(()=>{});
				// #endregion
			} catch (authError) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/d2b68487-89be-4953-bab3-f54ee4c6a9fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server-summary.ts:52',message:'Auth error in server function',data:{error:String(authError)},timestamp:Date.now(),sessionId:'debug-session',runId:'route-transition',hypothesisId:'B'})}).catch(()=>{});
				// #endregion
				// Auth context not available
				return createErrorResponse(
					ErrorCode.AUTH_ERROR,
					"User is not authenticated",
					undefined,
					401,
				);
			}

			if (!isAuthenticated || !userId) {
				// #region agent log
				fetch('http://127.0.0.1:7242/ingest/d2b68487-89be-4953-bab3-f54ee4c6a9fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server-summary.ts:63',message:'Not authenticated in server function',data:{isAuthenticated,hasUserId:!!userId},timestamp:Date.now(),sessionId:'debug-session',runId:'route-transition',hypothesisId:'B'})}).catch(()=>{});
				// #endregion
				return createErrorResponse(
					ErrorCode.AUTH_ERROR,
					"User is not authenticated",
					undefined,
					401,
				);
			}

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/d2b68487-89be-4953-bab3-f54ee4c6a9fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server-summary.ts:72',message:'Fetching data from DB',data:{userId:userId.substring(0,10)+'...'},timestamp:Date.now(),sessionId:'debug-session',runId:'route-transition',hypothesisId:'B'})}).catch(()=>{});
			// #endregion
			const [attempts, stats, commonErrors, texts] = await Promise.all([
				getUserAttempts(userId),
				getUserAttemptStats(userId),
				getCommonPhonemeErrors(userId, 10),
				getTextsWithAttempts(userId),
			]);

			// #region agent log
			fetch('http://127.0.0.1:7242/ingest/d2b68487-89be-4953-bab3-f54ee4c6a9fb',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'server-summary.ts:80',message:'Data fetched',data:{attemptsCount:attempts.length,statsTotal:stats.totalAttempts},timestamp:Date.now(),sessionId:'debug-session',runId:'route-transition',hypothesisId:'B'})}).catch(()=>{});
			// #endregion

			return createSuccessResponse({
				attempts,
				stats,
				commonErrors,
				texts,
			});
		} catch (error) {
			console.error("Get summary error:", error);
			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"Failed to retrieve summary data",
					{ originalError: error.message },
					500,
				);
			}
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to retrieve summary data",
				undefined,
				500,
			);
		}
	},
);

const GetRecentAttemptsSchema = z.object({
	textId: z.string().uuid(),
});

/**
 * Get recent attempts for a specific text
 * Requires authentication - returns error if user is not authenticated.
 */
export const serverGetRecentAttemptsForText = createServerFn({
	method: "GET",
})
	.inputValidator(GetRecentAttemptsSchema)
	.handler(
		async ({
			data,
		}): Promise<ApiResponse<UserAttempt[]>> => {
			try {
				// Get authenticated userId from Clerk
				let isAuthenticated = false;
				let userId: string | null = null;
				try {
					const authResult = await auth();
					isAuthenticated = authResult.isAuthenticated ?? false;
					userId = authResult.userId ?? null;
				} catch (authError) {
					// Auth context not available
					return createErrorResponse(
						ErrorCode.AUTH_ERROR,
						"User is not authenticated",
						undefined,
						401,
					);
				}

				if (!isAuthenticated || !userId) {
					return createErrorResponse(
						ErrorCode.AUTH_ERROR,
						"User is not authenticated",
						undefined,
						401,
					);
				}

				const attempts = await getUserAttempts(userId, {
					textId: data.textId,
					limit: 10,
				});

				return createSuccessResponse(attempts);
			} catch (error) {
				console.error("Get recent attempts error:", error);
				if (error instanceof Error) {
					return createErrorResponse(
						ErrorCode.DATABASE_ERROR,
						"Failed to retrieve recent attempts",
						{ originalError: error.message },
						500,
					);
				}
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"Failed to retrieve recent attempts",
					undefined,
					500,
				);
			}
		},
	);

