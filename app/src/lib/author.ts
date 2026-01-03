import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	type Author,
	deleteAuthor,
	getAuthorReferenceCount,
	getAuthorsWithReferenceCounts,
	insertAuthor,
	updateAuthor,
} from "@/db/author";
import {
	type ApiResponse,
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

// Schemas

const InsertAuthorSchema = z.object({
	name: z.string().min(1, "Name is required"),
	accent: z.string().nullable().optional(),
	style: z.string().nullable().optional(),
	languageCode: z.string().nullable().optional(),
	elevenlabsVoiceId: z.string().nullable().optional(),
});

const UpdateAuthorSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1).optional(),
	accent: z.string().nullable().optional(),
	style: z.string().nullable().optional(),
	languageCode: z.string().nullable().optional(),
	elevenlabsVoiceId: z.string().nullable().optional(),
});

const DeleteAuthorSchema = z.object({
	id: z.string().uuid(),
});

// Server Functions

export const serverGetAuthors = createServerFn({ method: "GET" }).handler(
	async (): Promise<ApiResponse<(Author & { referenceCount: number })[]>> => {
		try {
			const result = await getAuthorsWithReferenceCounts();
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Get authors error:", error);
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to fetch authors",
				undefined,
				500,
			);
		}
	},
);

export const serverInsertAuthor = createServerFn({ method: "POST" })
	.inputValidator(InsertAuthorSchema)
	.handler(async ({ data }): Promise<ApiResponse<Author>> => {
		try {
			const result = await insertAuthor({
				name: data.name,
				accent: data.accent,
				style: data.style,
				languageCode: data.languageCode,
				elevenlabsVoiceId: data.elevenlabsVoiceId,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Insert author error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.issues },
					400,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to create author",
				undefined,
				500,
			);
		}
	});

export const serverUpdateAuthor = createServerFn({ method: "POST" })
	.inputValidator(UpdateAuthorSchema)
	.handler(async ({ data }): Promise<ApiResponse<Author>> => {
		try {
			const result = await updateAuthor(data.id, {
				name: data.name,
				accent: data.accent,
				style: data.style,
				languageCode: data.languageCode,
				elevenlabsVoiceId: data.elevenlabsVoiceId,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Update author error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.issues },
					400,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to update author",
				undefined,
				500,
			);
		}
	});

export const serverDeleteAuthor = createServerFn({ method: "POST" })
	.inputValidator(DeleteAuthorSchema)
	.handler(async ({ data }): Promise<ApiResponse<{ success: boolean }>> => {
		try {
			// Check if author has references
			const refCount = await getAuthorReferenceCount(data.id);
			if (refCount > 0) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Cannot delete author with existing reference speeches",
					{ referenceCount: refCount },
					400,
				);
			}

			await deleteAuthor(data.id);
			return createSuccessResponse({ success: true });
		} catch (error) {
			console.error("Delete author error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.issues },
					400,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to delete author",
				undefined,
				500,
			);
		}
	});
