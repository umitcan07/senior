import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	deleteReferenceSpeech,
	getReferenceSpeechesForText,
	getReferenceSpeechesWithRelations,
	insertReferenceSpeech,
	type ReferenceSpeech,
	type ReferenceSpeechWithRelations,
	updateReferenceSpeech,
} from "@/db/reference";
import {
	type ApiResponse,
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

// Schemas

const InsertReferenceSchema = z.object({
	storageKey: z.string().min(1, "Storage key is required"),
	authorId: z.string().uuid("Invalid author ID"),
	textId: z.string().uuid("Invalid text ID"),
	generationMethod: z.enum(["tts", "native"]),
	ipaTranscription: z.string().nullable().optional(),
	priority: z.number().int().optional(),
	durationMs: z.number().int().nullable().optional(),
	fileSizeBytes: z.number().int().nullable().optional(),
	sampleRateHz: z.number().int().nullable().optional(),
	channels: z.number().int().nullable().optional(),
	bitrateKbps: z.number().int().nullable().optional(),
});

const UpdateReferenceSchema = z.object({
	id: z.string().uuid(),
	storageKey: z.string().min(1).optional(),
	authorId: z.string().uuid().optional(),
	textId: z.string().uuid().optional(),
	generationMethod: z.enum(["tts", "native"]).optional(),
	ipaTranscription: z.string().nullable().optional(),
	priority: z.number().int().optional(),
	durationMs: z.number().int().nullable().optional(),
	fileSizeBytes: z.number().int().nullable().optional(),
	sampleRateHz: z.number().int().nullable().optional(),
	channels: z.number().int().nullable().optional(),
	bitrateKbps: z.number().int().nullable().optional(),
});

const DeleteReferenceSchema = z.object({
	id: z.string().uuid(),
});

// Server Functions

export const serverGetReferences = createServerFn({ method: "GET" }).handler(
	async (): Promise<ApiResponse<ReferenceSpeechWithRelations[]>> => {
		try {
			const result = await getReferenceSpeechesWithRelations();
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Get references error:", error);
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to fetch reference speeches",
				undefined,
				500,
			);
		}
	},
);

const GetReferencesForTextSchema = z.object({
	textId: z.string().uuid("Invalid text ID"),
});

export const serverGetReferencesForText = createServerFn({ method: "GET" })
	.inputValidator(GetReferencesForTextSchema)
	.handler(
		async ({ data }): Promise<ApiResponse<ReferenceSpeechWithRelations[]>> => {
			try {
				const result = await getReferenceSpeechesForText(data.textId);
				return createSuccessResponse(result);
			} catch (error) {
				console.error("Get references for text error:", error);
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"Failed to fetch reference speeches for text",
					undefined,
					500,
				);
			}
		},
	);

export const serverInsertReference = createServerFn({ method: "POST" })
	.inputValidator(InsertReferenceSchema)
	.handler(async ({ data }): Promise<ApiResponse<ReferenceSpeech>> => {
		try {
			const result = await insertReferenceSpeech({
				storageKey: data.storageKey,
				authorId: data.authorId,
				textId: data.textId,
				generationMethod: data.generationMethod,
				ipaTranscription: data.ipaTranscription,
				priority: data.priority,
				durationMs: data.durationMs,
				fileSizeBytes: data.fileSizeBytes,
				sampleRateHz: data.sampleRateHz,
				channels: data.channels,
				bitrateKbps: data.bitrateKbps,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Insert reference error:", error);

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
				"Failed to create reference speech",
				undefined,
				500,
			);
		}
	});

export const serverUpdateReference = createServerFn({ method: "POST" })
	.inputValidator(UpdateReferenceSchema)
	.handler(async ({ data }): Promise<ApiResponse<ReferenceSpeech>> => {
		try {
			const result = await updateReferenceSpeech(data.id, {
				storageKey: data.storageKey,
				authorId: data.authorId,
				textId: data.textId,
				generationMethod: data.generationMethod,
				ipaTranscription: data.ipaTranscription,
				priority: data.priority,
				durationMs: data.durationMs,
				fileSizeBytes: data.fileSizeBytes,
				sampleRateHz: data.sampleRateHz,
				channels: data.channels,
				bitrateKbps: data.bitrateKbps,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Update reference error:", error);

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
				"Failed to update reference speech",
				undefined,
				500,
			);
		}
	});

export const serverDeleteReference = createServerFn({ method: "POST" })
	.inputValidator(DeleteReferenceSchema)
	.handler(async ({ data }): Promise<ApiResponse<{ success: boolean }>> => {
		try {
			await deleteReferenceSpeech(data.id);
			return createSuccessResponse({ success: true });
		} catch (error) {
			console.error("Delete reference error:", error);

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
				"Failed to delete reference speech",
				undefined,
				500,
			);
		}
	});

// Helper function for formatting duration
export function formatDuration(ms: number | null): string {
	if (ms === null) return "--:--";
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
