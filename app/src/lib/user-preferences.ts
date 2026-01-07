import { createClerkClient } from "@clerk/backend";
import { getAuth } from "@clerk/tanstack-start/server";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

const GetUserPreferencesSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
});

const UpdateUserPreferencesSchema = z.object({
	userId: z.string().min(1, "User ID is required"),
	preferredAuthorId: z.string().uuid().nullable().optional(),
});

function getClerkSecretKey(): string {
	const secretKey =
		process.env.CLERK_SECRET_KEY || process.env.VITE_CLERK_SECRET_KEY;

	if (!secretKey) {
		throw new Error(
			"CLERK_SECRET_KEY or VITE_CLERK_SECRET_KEY environment variable is not set",
		);
	}

	return secretKey;
}

async function validateUserId(userId: string): Promise<boolean> {
	try {
		const secretKey = getClerkSecretKey();
		const clerk = createClerkClient({ secretKey });
		const user = await clerk.users.getUser(userId);
		return !!user;
	} catch (error) {
		console.error("User validation error:", error);
		return false;
	}
}

/**
 * Server function to get preferred author ID.
 * Uses getAuth from @clerk/tanstack-start/server for SSR auth context.
 * Falls back to "guest" if user is not authenticated.
 */
export const serverGetPreferredAuthorId = createServerFn({
	method: "GET",
}).handler(async (): Promise<string | null> => {
	try {
		let userId = "guest";

		// Try to get authenticated userId from Clerk
		try {
			const request = getRequest();
			const auth = await getAuth(request);
			if (auth.userId) {
				userId = auth.userId;
			}
		} catch {
			// Auth not available in this context, use guest
		}

		const prefs = await getUserPreferences(userId);
		return prefs?.preferredAuthorId ?? null;
	} catch (error) {
		console.error("Get preferred author ID error:", error);
		return null;
	}
});

// Server Functions

export const serverGetUserPreferences = createServerFn({ method: "POST" })
	.inputValidator(GetUserPreferencesSchema)
	.handler(async ({ data }): Promise<ApiResponse<UserPreferences | null>> => {
		try {
			const isValid = await validateUserId(data.userId);
			if (!isValid) {
				return createErrorResponse(
					ErrorCode.AUTH_ERROR,
					"Invalid user ID",
					undefined,
					401,
				);
			}

			const result = await getUserPreferences(data.userId);
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
			const isValid = await validateUserId(data.userId);
			if (!isValid) {
				return createErrorResponse(
					ErrorCode.AUTH_ERROR,
					"Invalid user ID",
					undefined,
					401,
				);
			}

			const result = await upsertUserPreferences(data.userId, {
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
