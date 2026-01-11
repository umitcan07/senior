import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { insertAnalysis } from "@/db/analysis";
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

			// Get authenticated user ID - require authentication
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

			console.log(`[Server] attribution recording to user: ${userId}`);
			
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

			// Create analysis with pending status (will be processed by RunPod)
			const analysis = await insertAnalysis({
				userRecordingId: recording.id,
				referenceSpeechId: data.referenceId,
				status: "pending",
			});

			if (!analysis) {
				throw new Error("Failed to create analysis record");
			}

			console.log(
				`[Server] Analysis ${analysis.id} created with status=pending`,
			);

			// Submit assessment job to RunPod
			try {
				const assessmentResponse = await fetch(
					new URL("/api/assessment", process.env.WEBHOOK_BASE_URL || "http://localhost:3000").toString(),
					{
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ analysisId: analysis.id }),
					},
				);

				if (!assessmentResponse.ok) {
					const errorText = await assessmentResponse.text();
					console.error(
						`[Server] Failed to submit assessment job: ${errorText}`,
					);
					// Don't fail the upload - the analysis is created and can be retried
					// The UI will show "pending" status
				} else {
					const jobResult = await assessmentResponse.json();
					console.log(
						`[Server] Assessment job submitted: ${jobResult?.data?.externalJobId}`,
					);
				}
			} catch (assessmentError) {
				// Log but don't fail - analysis record exists and can be retried
				console.error("[Server] Assessment submission error:", assessmentError);
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

