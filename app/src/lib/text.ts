import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	deletePracticeText,
	getPracticeTextById,
	getPracticeTexts,
	getPracticeTextsWithReferenceCounts,
	insertPracticeText,
	type PracticeText,
	type PracticeTextWithReferenceCount,
	updatePracticeText,
} from "@/db/text";
import type { ApiResponse } from "./errors";
import {
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

const PracticeTextSchema = z.object({
	content: z.string().min(1),
	difficulty: z.enum(["beginner", "intermediate", "advanced"]),
	type: z.enum([
		"daily",
		"professional",
		"academic",
		"phonetic_challenge",
		"common_phrase",
	]),
	wordCount: z.number().int().positive().optional(),
	note: z.string().nullable().optional(),
});

const UpdatePracticeTextSchema = z.object({
	id: z.string().uuid(),
	content: z.string().min(1).optional(),
	difficulty: z.enum(["beginner", "intermediate", "advanced"]).optional(),
	type: z
		.enum([
			"daily",
			"professional",
			"academic",
			"phonetic_challenge",
			"common_phrase",
		])
		.optional(),
	wordCount: z.number().int().positive().optional(),
	note: z.string().nullable().optional(),
});

const DeletePracticeTextSchema = z.object({
	id: z.string().uuid(),
});

export const serverInsertPracticeText = createServerFn({ method: "POST" })
	.inputValidator(PracticeTextSchema)
	.handler(async ({ data }): Promise<ApiResponse<PracticeText>> => {
		// Note: Server-side auth check requires request access
		// Currently relying on client-side protection via <Protect> component in admin layout
		// TODO: Implement proper server-side auth when request context is available

		try {
			const result = await insertPracticeText({
				content: data.content,
				difficulty: data.difficulty,
				type: data.type,
				wordCount: data.wordCount,
				note: data.note,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Insert practice text error:", error);

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
					"An error occurred while inserting the practice text",
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"An error occurred while inserting the practice text",
				undefined,
				500,
			);
		}
	});

export const serverGetPracticeTexts = createServerFn({ method: "GET" }).handler(
	async (): Promise<ApiResponse<PracticeText[]>> => {
		try {
			const result = await getPracticeTexts();
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Get practice texts error:", error);

			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"An error occurred while getting the practice texts",
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"An error occurred while getting the practice texts",
				undefined,
				500,
			);
		}
	},
);

export const serverGetPracticeTextsWithReferences = createServerFn({
	method: "GET",
}).handler(async (): Promise<ApiResponse<PracticeTextWithReferenceCount[]>> => {
	try {
		const result = await getPracticeTextsWithReferenceCounts();
		return createSuccessResponse(result);
	} catch (error) {
		console.error("Get practice texts with references error:", error);

		if (error instanceof Error) {
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"An error occurred while getting the practice texts",
				{ originalError: error.message },
				500,
			);
		}

		return createErrorResponse(
			ErrorCode.DATABASE_ERROR,
			"An error occurred while getting the practice texts",
			undefined,
			500,
		);
	}
});

const GetPracticeTextByIdSchema = z.object({
	id: z.string().uuid(),
});

export const serverGetPracticeTextById = createServerFn({ method: "GET" })
	.inputValidator(GetPracticeTextByIdSchema)
	.handler(async ({ data }): Promise<ApiResponse<PracticeText | null>> => {
		// Note: Server-side auth check requires request access
		// Currently relying on client-side protection via <Protect> component in admin layout
		// TODO: Implement proper server-side auth when request context is available

		try {
			const result = await getPracticeTextById(data.id);
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Get practice text by id error:", error);

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
					"An error occurred while getting the practice text",
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"An error occurred while getting the practice text",
				undefined,
				500,
			);
		}
	});

export const serverUpdatePracticeText = createServerFn({ method: "POST" })
	.inputValidator(UpdatePracticeTextSchema)
	.handler(async ({ data }): Promise<ApiResponse<PracticeText>> => {
		// Note: Server-side auth check requires request access
		// Currently relying on client-side protection via <Protect> component in admin layout
		// TODO: Implement proper server-side auth when request context is available

		try {
			const result = await updatePracticeText(data.id, {
				content: data.content,
				difficulty: data.difficulty,
				type: data.type,
				wordCount: data.wordCount,
				note: data.note,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Update practice text error:", error);

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
					"An error occurred while updating the practice text",
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"An error occurred while updating the practice text",
				undefined,
				500,
			);
		}
	});

export const serverDeletePracticeText = createServerFn({ method: "POST" })
	.inputValidator(DeletePracticeTextSchema)
	.handler(async ({ data }): Promise<ApiResponse<void>> => {
		// Note: Server-side auth check requires request access
		// Currently relying on client-side protection via <Protect> component in admin layout
		// TODO: Implement proper server-side auth when request context is available

		try {
			await deletePracticeText(data.id);
			return createSuccessResponse(undefined);
		} catch (error) {
			console.error("Delete practice text error:", error);

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
					"An error occurred while deleting the practice text",
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"An error occurred while deleting the practice text",
				undefined,
				500,
			);
		}
	});
