import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { insertUserRecording } from "@/db/recording";
import { insertAnalysis, insertPhonemeErrors, insertWordErrors } from "@/db/analysis";
import { uploadToR2 } from "./r2";
import { createErrorResponse, createSuccessResponse, ErrorCode, type ApiResponse } from "./errors";

const UploadRecordingSchema = z.object({
	textId: z.string().uuid(),
	referenceId: z.string().uuid(),
	audioBase64: z.string(),
	mimeType: z.string(),
	durationMs: z.number().int().positive(),
});

export const serverUploadRecording = createServerFn({ method: "POST" })
	.inputValidator(UploadRecordingSchema)
	.handler(async ({ data }): Promise<ApiResponse<{ analysisId: string }>> => {
		try {
			// 1. Decode Audio
			const buffer = Buffer.from(data.audioBase64, "base64");
			
			// 2. Upload to R2
			// Generate a unique key
			const userId = "guest"; 
			const fileExtension = data.mimeType.split("/")[1] || "webm";
			const storageKey = `users/${userId}/recordings/${crypto.randomUUID()}.${fileExtension}`;
			
			const uploadResult = await uploadToR2(buffer, storageKey, data.mimeType);

			if (!uploadResult.success) {
				return createErrorResponse(
					ErrorCode.R2_UPLOAD_ERROR,
					"Failed to upload recording",
					{ originalError: uploadResult.error.message },
					500
				);
			}

			// 3. Create UserRecording Record
			const recording = await insertUserRecording({
				userId,
				storageKey,
				recordingMethod: "record",
				referenceSpeechId: data.referenceId,
				durationMs: data.durationMs,
				fileSizeBytes: buffer.length,
				sampleRateHz: 48000,
				channels: 1,
				bitrateKbps: 128,
			});

			if (!recording) {
				throw new Error("Failed to create recording record");
			}

			// 4. Mock Analysis (Placeholder)
			const mockScore = 0.7 + Math.random() * 0.3; // Random score 70-100%
			
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

            // Insert mock errors if score is low
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
                    }
                 ]);
                 
                 await insertWordErrors([
                     {
                         analysisId: analysis.id,
                         errorType: "substitute",
                         position: 1,
                         expected: "quick",
                         actual: "kwick",
                     }
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
                    500
                );
            }
            return createErrorResponse(
                ErrorCode.INTERNAL_ERROR,
                "Failed to process recording",
                undefined,
                500
            );
		}
	});
