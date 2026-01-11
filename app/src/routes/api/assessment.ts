import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
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

// Schema for the submit assessment job request body
const SubmitAssessmentRequestSchema = z.object({
	analysisId: z.string().uuid(),
});

export const Route = createFileRoute("/api/assessment")({
	server: {
		handlers: {
			// POST /api/assessment - Submit a new assessment job
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const parseResult = SubmitAssessmentRequestSchema.safeParse(body);

					if (!parseResult.success) {
						return Response.json(
							{
								success: false,
								error: "Invalid request body",
								details: parseResult.error.format(),
							},
							{ status: 400 },
						);
					}

					const { analysisId } = parseResult.data;

					// Get analysis with related data
					const data = await getAnalysisWithDetails(analysisId);
					if (!data) {
						return Response.json(
							{ success: false, error: "Analysis not found" },
							{ status: 404 },
						);
					}

					const { analysis, userRecording, referenceSpeech } = data;

					// Check if there's already a pending job
					const existingJob = await getLatestAssessmentJob(analysisId);
					if (
						existingJob &&
						(existingJob.status === "in_queue" ||
							existingJob.status === "in_progress")
					) {
						return Response.json(
							{
								success: false,
								error: "Assessment already in progress",
								jobId: existingJob.id,
							},
							{ status: 409 },
						);
					}

					// Check if analysis is already completed
					if (analysis.status === "completed") {
						return Response.json(
							{
								success: false,
								error: "Analysis is already completed",
								analysisId: analysis.id,
							},
							{ status: 409 },
						);
					}

					const config = getRunPodConfig();

					// Build webhook URL for assessment results
					let webhookBaseUrl = getWebhookBaseUrl(request);

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

					console.log(`Debug: Assessment webhook URL set to: ${webhookUrl}`);

					// Get audio URL for user recording
					const audioUri = getPublicUrl(userRecording.storageKey);
					console.log(`Debug: User recording audio URI: ${audioUri}`);

					// Build RunPod input
					const runpodInput: {
						audio_uri: string;
						target_text: string;
						target_ipa?: string;
					} = {
						audio_uri: audioUri,
						target_text: referenceSpeech.textContent,
					};

					// Include target IPA if available (avoids redundant G2P computation)
					if (referenceSpeech.ipaTranscription) {
						runpodInput.target_ipa = referenceSpeech.ipaTranscription;
					}

					console.log(
						`Debug: Submitting assessment job for analysis ${analysisId}`,
					);

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
						return Response.json(
							{ success: false, error: "Failed to submit assessment job" },
							{ status: 502 },
						);
					}

					const runpodData = await runpodResponse.json();
					const runJobResult = RunJobResponseSchema.safeParse(runpodData);

					if (!runJobResult.success) {
						console.error("Invalid RunPod response:", runJobResult.error);
						return Response.json(
							{ success: false, error: "Invalid response from RunPod" },
							{ status: 502 },
						);
					}

					// Create assessment job in database
					const job = await createAssessmentJob(
						analysisId,
						runJobResult.data.id,
					);

					// Update analysis status to processing and set target text
					await updateAnalysis(analysisId, {
						status: "processing",
						targetWords: referenceSpeech.textContent,
					});

					console.log(
						`Assessment job submitted: ${runJobResult.data.id} for analysis ${analysisId}`,
					);

					return Response.json({
						success: true,
						data: {
							id: job.id,
							analysisId,
							externalJobId: job.externalJobId,
							status: job.status,
						},
					});
				} catch (error) {
					console.error("Failed to submit assessment job:", error);
					const message =
						error instanceof Error
							? error.message
							: "Failed to submit assessment job";
					return Response.json(
						{ success: false, error: message },
						{ status: 500 },
					);
				}
			},
		},
	},
});
