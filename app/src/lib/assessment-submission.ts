import { getAnalysisWithDetails, updateAnalysis } from "@/db/analysis";
import {
	createAssessmentJob,
	getLatestAssessmentJob,
} from "@/db/assessment-job";
import { getPublicUrl } from "@/lib/r2";
import {
	getRunPodConfig,
	getRunPodHeaders,
	getWebhookBaseUrl,
} from "@/lib/runpod-config";
import { RunJobResponseSchema } from "@/lib/runpod-schemas";

/**
 * Submit an assessment job for an analysis.
 * This function can be called directly from server functions or API routes.
 *
 * @param analysisId - The analysis ID to submit
 * @param userId - The authenticated user ID (must match the recording owner)
 * @param request - Optional request object for webhook URL construction
 * @returns Success response with job data, or error response
 */
export async function submitAssessmentJob(
	analysisId: string,
	userId: string,
	request?: Request,
): Promise<
	| {
			success: true;
			data: {
				id: string;
				analysisId: string;
				externalJobId: string;
				status: string;
			};
	  }
	| { success: false; error: string; statusCode: number }
> {
	try {
		// Get analysis with related data
		const data = await getAnalysisWithDetails(analysisId);
		if (!data) {
			return {
				success: false,
				error: "Analysis not found",
				statusCode: 404,
			};
		}

		const { analysis, userRecording, referenceSpeech } = data;

		// Verify the recording belongs to the authenticated user
		if (userRecording.userId !== userId) {
			return {
				success: false,
				error: "Forbidden",
				statusCode: 403,
			};
		}

		// Check if there's already a pending job
		const existingJob = await getLatestAssessmentJob(analysisId);
		if (
			existingJob &&
			(existingJob.status === "in_queue" ||
				existingJob.status === "in_progress")
		) {
			return {
				success: false,
				error: "Assessment already in progress",
				statusCode: 409,
			};
		}

		// Check if analysis is already completed
		if (analysis.status === "completed") {
			return {
				success: false,
				error: "Analysis is already completed",
				statusCode: 409,
			};
		}

		const config = getRunPodConfig();

		// Build webhook URL for assessment results
		let webhookBaseUrl = request
			? getWebhookBaseUrl(request)
			: process.env.WEBHOOK_BASE_URL || "http://localhost:3000";

		// FIX: If talking to local RunPod proxy (localhost), ensure webhook uses host.docker.internal
		if (
			config.apiUrl.includes("localhost") ||
			config.apiUrl.includes("127.0.0.1")
		) {
			if (
				webhookBaseUrl.includes("localhost") ||
				webhookBaseUrl.includes("127.0.0.1")
			) {
				console.log(
					"Detecting local RunPod proxy usage, rewriting webhook to host.docker.internal",
				);
				webhookBaseUrl = webhookBaseUrl
					.replace("localhost", "host.docker.internal")
					.replace("127.0.0.1", "host.docker.internal");
			}
		}

		const webhookUrl = new URL(
			"/api/webhook/assessment",
			webhookBaseUrl,
		).toString();

		// Get audio URL for user recording
		const audioUri = getPublicUrl(userRecording.storageKey);

		// Build RunPod input (contract #22): reference-based, aligner-only. We pass
		// the precomputed reference phones/IPA so the worker stays stateless (no DB
		// access in mod/) and never re-aligns the reference. Prefer the cached
		// phone_timings_json tokens; fall back to the IPA string.
		const referencePhones =
			referenceSpeech.phoneTimingsJson?.map((p) => p.token) ?? undefined;

		const runpodInput: {
			audio_uri: string;
			reference_id: string;
			reference_phones?: string[];
			reference_ipa?: string;
		} = {
			audio_uri: audioUri,
			reference_id: referenceSpeech.id,
		};
		if (referencePhones && referencePhones.length > 0) {
			runpodInput.reference_phones = referencePhones;
		}
		if (referenceSpeech.ipaTranscription) {
			runpodInput.reference_ipa = referenceSpeech.ipaTranscription;
		}

		// Submit job to RunPod
		const runpodResponse = await fetch(
			`${config.apiUrl}/v2/${config.endpoints.assessment}/run`,
			{
				method: "POST",
				headers: getRunPodHeaders(),
				body: JSON.stringify({
					input: runpodInput,
					webhook: webhookUrl,
				}),
			},
		);

		if (!runpodResponse.ok) {
			const errorText = await runpodResponse.text();
			console.error("RunPod assessment submission failed:", errorText);
			return {
				success: false,
				error: "Failed to submit assessment job",
				statusCode: 502,
			};
		}

		const runpodData = await runpodResponse.json();
		const runJobResult = RunJobResponseSchema.safeParse(runpodData);

		if (!runJobResult.success) {
			console.error("Invalid RunPod response:", runJobResult.error);
			return {
				success: false,
				error: "Invalid response from RunPod",
				statusCode: 502,
			};
		}

		// Create assessment job in database
		const job = await createAssessmentJob(analysisId, runJobResult.data.id);

		// Update analysis status to processing and set target text
		await updateAnalysis(analysisId, {
			status: "processing",
			targetWords: referenceSpeech.textContent,
		});

		console.log(
			`Assessment job submitted: ${runJobResult.data.id} for analysis ${analysisId}`,
		);

		return {
			success: true,
			data: {
				id: job.id,
				analysisId,
				externalJobId: job.externalJobId,
				status: job.status,
			},
		};
	} catch (error) {
		console.error("Failed to submit assessment job:", error);
		const message =
			error instanceof Error
				? error.message
				: "Failed to submit assessment job";
		return {
			success: false,
			error: message,
			statusCode: 500,
		};
	}
}
