import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ErrorCode, createErrorResponse, createSuccessResponse } from "./errors";
import { uploadToR2 } from "./r2";
import { insertRecording } from "@/db/recording";
import type { ApiResponse } from "./errors";
import type { Recording } from "@/db/recording";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const RecordingUploadInputSchema = z.object({
	file: z.string(), // base64 encoded file
	fileName: z.string().min(1),
	contentType: z.string().refine(
		(val) => val.startsWith("audio/"),
		"File must be an audio file",
	),
	userId: z.string().min(1),
});

export const serverUploadRecording = createServerFn({
	method: "POST",
})
	.inputValidator(RecordingUploadInputSchema)
	.handler(async ({ data }): Promise<ApiResponse<Recording>> => {
		try {
			const { userId } = data;

			if (!userId) {
				return createErrorResponse(
					ErrorCode.AUTH_ERROR,
					"Authentication required. Please sign in to upload recordings.",
					undefined,
					401,
				);
			}

			const base64Data = data.file.replace(/^data:.*,/, "");
			const fileBuffer = Buffer.from(base64Data, "base64");

			if (fileBuffer.length > MAX_FILE_SIZE) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"File size exceeds maximum limit of 10MB",
					{ maxSize: MAX_FILE_SIZE, actualSize: fileBuffer.length },
					400,
				);
			}

			const timestamp = Date.now();
			const uuid = crypto.randomUUID();
			const key = `recordings/${userId}/${timestamp}-${uuid}.wav`;

			const uploadResult = await uploadToR2(
				fileBuffer,
				key,
				"audio/wav",
			);

			if (!uploadResult.success) {
				return uploadResult;
			}

			const recording = await insertRecording({
				userId,
				path: uploadResult.data.url,
			});

			return createSuccessResponse(recording);
		} catch (error) {
			console.error("Recording upload error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.message },
					400,
				);
			}

			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.UNKNOWN_ERROR,
					"An unexpected error occurred while uploading the recording",
					{ originalError: error.message },
					500,
				);
			}

			return createErrorResponse(
				ErrorCode.UNKNOWN_ERROR,
				"An unexpected error occurred while uploading the recording",
				undefined,
				500,
			);
		}
	});

