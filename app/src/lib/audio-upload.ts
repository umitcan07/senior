import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	insertAnalysis,
	insertPhonemeErrors,
	insertWordErrors,
} from "@/db/analysis";
import { insertUserRecording } from "@/db/recording";
import {
	type ApiResponse,
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";
import { uploadToR2 } from "./r2";

const UploadAudioSchema = z.object({
	textId: z.string().uuid(),
	referenceId: z.string().uuid(),
	audioBase64: z.string(),
	mimeType: z.string(),
	// Relaxed validation: allow any number, we'll round it server-side
	duration: z.number(),
});

export const uploadAudioRecording = createServerFn({ method: "POST" })
	.inputValidator(UploadAudioSchema)
	.handler(async ({ data }): Promise<ApiResponse<{ analysisId: string }>> => {
		try {
			console.log("[Server] Uploading audio...", {
				textId: data.textId,
				duration: data.duration,
				inputType: typeof data.duration,
			});

			const buffer = Buffer.from(data.audioBase64, "base64");
			const userId = "guest";
			const fileExtension = data.mimeType.split("/")[1] || "webm";
			const storageKey = `users/${userId}/recordings/${crypto.randomUUID()}.${fileExtension}`;

			const uploadResult = await uploadToR2(buffer, storageKey, data.mimeType);

			if (!uploadResult.success) {
				return createErrorResponse(
					ErrorCode.R2_UPLOAD_ERROR,
					"Failed to upload recording",
					{ originalError: uploadResult.error.message },
					500,
				);
			}

			const recording = await insertUserRecording({
				userId,
				storageKey,
				recordingMethod: "record",
				referenceSpeechId: data.referenceId,
				// Explicitly round to integer for DB
				durationMs: Math.round(data.duration),
				fileSizeBytes: buffer.length,
				sampleRateHz: 48000,
				channels: 1,
				bitrateKbps: 128,
			});

			if (!recording) {
				throw new Error("Failed to create recording record");
			}

			// Mock Analysis
			const mockScore = 0.7 + Math.random() * 0.3;

			const analysis = await insertAnalysis({
				userRecordingId: recording.id,
				referenceSpeechId: data.referenceId,
				processingDurationMs: 500,
				overallScore: mockScore.toFixed(4),
				confidence: "0.95",
				targetPhonemes: "ð ə k w ɪ k b r aʊ n f ɒ k s",
				recognizedPhonemes: "ð ə k w ɪ k b r aʊ n f ɒ k s",
				phonemeScore: mockScore.toFixed(4),
				targetWords: "the quick brown fox",
				recognizedWords: "the quick brown fox",
				wordScore: mockScore.toFixed(4),
			});

			if (!analysis) {
				throw new Error("Failed to create analysis record");
			}

			if (mockScore < 0.9) {
				await insertPhonemeErrors([
					{
						analysisId: analysis.id,
						errorType: "substitute",
						position: 5,
						expected: "ɪ",
						actual: "i",
						timestampStartMs: 1200,
						timestampEndMs: 1300,
					},
				]);

				await insertWordErrors([
					{
						analysisId: analysis.id,
						errorType: "substitute",
						position: 1,
						expected: "quick",
						actual: "kwick",
					},
				]);
			}

			return createSuccessResponse({ analysisId: analysis.id });
		} catch (error) {
			console.error("Upload recording error:", error);
			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.INTERNAL_ERROR,
					"Failed to process recording",
					{ originalError: error.message },
					500,
				);
			}
			return createErrorResponse(
				ErrorCode.INTERNAL_ERROR,
				"Failed to process recording",
				undefined,
				500,
			);
		}
	});
