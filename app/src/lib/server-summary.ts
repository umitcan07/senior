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
 */
export const serverGetSummary = createServerFn({ method: "GET" }).handler(
	async (): Promise<ApiResponse<SummaryData>> => {
		try {
			let userId = "guest";

			// Try to get authenticated userId from Clerk
			try {
				const authObj = await auth();
				if (authObj.userId) {
					userId = authObj.userId;
				}
			} catch {
				// Auth not available, use guest
			}

			// If guest, return empty data
			if (userId === "guest") {
				return createSuccessResponse({
					attempts: [],
					stats: {
						totalAttempts: 0,
						weeklyAttempts: 0,
						averageScore: 0,
						weeklyProgress: 0,
					},
					commonErrors: [],
					texts: [],
				});
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
				let userId = "guest";

				// Try to get authenticated userId from Clerk
				try {
					const authObj = await auth();
					if (authObj.userId) {
						userId = authObj.userId;
					}
				} catch {
					// Auth not available, use guest
				}

				// If guest, return empty array
				if (userId === "guest") {
					return createSuccessResponse([]);
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

