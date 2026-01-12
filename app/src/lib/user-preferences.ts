import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";

import { z } from "zod";
import {
	getUserPreferences,
	type UserPreferences,
	upsertUserPreferences,
} from "@/db/user-preferences";
import {
	type ApiResponse,
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

// Schemas

const UpdateUserPreferencesSchema = z.object({
	preferredAuthorId: z.string().uuid().nullable().optional(),
});

/**
 * Server function to get preferred author ID.
 * Requires authentication - returns null if user is not authenticated.
 */
export const serverGetPreferredAuthorId = createServerFn({
	method: "GET",
}).handler(async (): Promise<string | null> => {
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
			return null;
		}

		if (!isAuthenticated || !userId) {
			return null;
		}

		const prefs = await getUserPreferences(userId);
		return prefs?.preferredAuthorId ?? null;
	} catch (error) {
		console.error("Get preferred author ID error:", error);
		return null;
	}
});

// Server Functions

export const serverGetUserPreferences = createServerFn({ method: "GET" })
	.handler(async (): Promise<ApiResponse<UserPreferences | null>> => {
		try {
			// Get authenticated userId from Clerk - require authentication
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

			const result = await getUserPreferences(userId);
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Get user preferences error:", error);
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to fetch user preferences",
				undefined,
				500,
			);
		}
	});

export const serverUpdateUserPreferences = createServerFn({ method: "POST" })
	.inputValidator(UpdateUserPreferencesSchema)
	.handler(async ({ data }): Promise<ApiResponse<UserPreferences>> => {
		try {
			// Get authenticated userId from Clerk - require authentication
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

			const result = await upsertUserPreferences(userId, {
				preferredAuthorId: data.preferredAuthorId ?? null,
			});

			return createSuccessResponse(result);
		} catch (error) {
			console.error("Update user preferences error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.issues },
					400,
				);
			}

			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"An error occurred while updating user preferences",
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"An error occurred while updating user preferences",
				undefined,
				500,
			);
		}
	});
