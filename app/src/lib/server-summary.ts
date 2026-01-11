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

			const [attempts, stats, commonErrors, texts] = await Promise.all([
				getUserAttempts(userId),
				getUserAttemptStats(userId),
				getCommonPhonemeErrors(userId, 10),
				getTextsWithAttempts(userId),
			]);

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

