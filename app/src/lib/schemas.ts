import { z } from "zod";
import { ErrorCode } from "./errors";

export const ErrorCodeSchema = z.nativeEnum(ErrorCode);

export const ApiErrorSchema = z.object({
	code: z.union([ErrorCodeSchema, z.string()]),
	message: z.string(),
	details: z.record(z.unknown()).optional(),
	statusCode: z.number().optional(),
});

export function createSuccessResponseSchema<T extends z.ZodTypeAny>(
	dataSchema: T,
) {
	return z.object({
		success: z.literal(true),
		data: dataSchema,
	});
}

export function createErrorResponseSchema() {
	return z.object({
		success: z.literal(false),
		error: ApiErrorSchema,
	});
}

export function createApiResponseSchema<T extends z.ZodTypeAny>(
	dataSchema: T,
) {
	return z.union([
		createSuccessResponseSchema(dataSchema),
		createErrorResponseSchema(),
	]);
}

export const RecordingSchema = z.object({
	id: z.number(),
	userId: z.string(),
	path: z.string(),
	createdAt: z.date().or(z.string()),
	updatedAt: z.date().or(z.string()).nullable(),
	deletedAt: z.date().or(z.string()).nullable(),
});

export const RecordingUploadInputSchema = z.object({
	file: z.instanceof(File).or(z.instanceof(Blob)),
});

export const RecordingUploadResponseSchema = createApiResponseSchema(
	RecordingSchema,
);

