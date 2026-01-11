import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	getAnalysisById,
	getAudioQualityMetricsByUserRecordingId,
	getPhonemeErrorsByAnalysisId,
	getWordErrorsByAnalysisId,
} from "@/db/analysis";
import { getLatestAssessmentJob, type AssessmentJob } from "@/db/assessment-job";
import { getUserRecordingById } from "@/db/recording";
import { getReferenceSpeechById } from "@/db/reference";
import type {
	Analysis,
	AudioQualityMetrics,
	PhonemeError,
	ReferenceSpeech,
	UserRecording,
	WordError,
} from "@/db/types";
import {
	type ApiResponse,
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

const GetAnalysisSchema = z.object({
	analysisId: z.string(),
});

type AnalysisDetails = {
	analysis: Analysis;
	userRecording: UserRecording | null;
	audioQualityMetrics: AudioQualityMetrics | null;
	reference: ReferenceSpeech | null;
	phonemeErrors: PhonemeError[];
	wordErrors: WordError[];
	assessmentJob: AssessmentJob | null;
};

export const serverGetAnalysisDetails = createServerFn({ method: "GET" })
	.inputValidator(GetAnalysisSchema)
	.handler(async ({ data }): Promise<ApiResponse<AnalysisDetails | null>> => {
		try {
			// Validate UUID format manually to avoid crashing on invalid URLs (e.g. from mock data)
			const uuidRegex =
				/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
			if (!uuidRegex.test(data.analysisId)) {
				return createSuccessResponse(null);
			}

			const analysis = await getAnalysisById(data.analysisId);

			// Return null if analysis doesn't exist
			if (!analysis) {
				return createSuccessResponse(null);
			}

			const [phonemeErrors, wordErrors, userRecording, assessmentJob, reference] = await Promise.all([
				getPhonemeErrorsByAnalysisId(analysis.id),
				getWordErrorsByAnalysisId(analysis.id),
				getUserRecordingById(analysis.userRecordingId),
				getLatestAssessmentJob(analysis.id),
				getReferenceSpeechById(analysis.referenceSpeechId),
			]);

			const qualityMetrics = userRecording
				? await getAudioQualityMetricsByUserRecordingId(userRecording.id)
				: null;

			return createSuccessResponse({
				analysis,
				userRecording,
				audioQualityMetrics: qualityMetrics,
				reference,
				phonemeErrors,
				wordErrors,
				assessmentJob,
			});
		} catch (error) {
			console.error("Get analysis details error:", error);
			if (error instanceof Error) {
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"Failed to retrieve analysis details",
					{ originalError: error.message },
					500,
				);
			}
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to retrieve analysis details",
				undefined,
				500,
			);
		}
	});

