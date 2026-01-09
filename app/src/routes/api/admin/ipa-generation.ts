import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
	createIpaGenerationJob,
	getIpaGenerationJobByExternalId,
	getLatestIpaGenerationJob,
} from "@/db/ipa-generation-job";
import { getReferenceSpeechWithText } from "@/db/reference";
import { getPublicUrl } from "@/lib/r2";
import {
	getRunPodConfig,
	getRunPodHeaders,
	getWebhookBaseUrl,
} from "@/lib/runpod-config";
import { RunJobResponseSchema } from "@/lib/runpod-schemas";

// Schema for the submit IPA generation job request body
const SubmitIpaGenerationRequestSchema = z.object({
	referenceSpeechId: z.string().uuid(),
});

export const Route = createFileRoute("/api/admin/ipa-generation")({
	server: {
		handlers: {
			// POST /api/admin/ipa-generation - Submit a new IPA generation job
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const parseResult = SubmitIpaGenerationRequestSchema.safeParse(body);

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

					const { referenceSpeechId } = parseResult.data;

					// Get reference speech with its text content
					const reference = await getReferenceSpeechWithText(referenceSpeechId);
					if (!reference) {
						return Response.json(
							{ success: false, error: "Reference speech not found" },
							{ status: 404 },
						);
					}

					// Check if there's already a pending job
					const existingJob = await getLatestIpaGenerationJob(referenceSpeechId);
					if (
						existingJob &&
						(existingJob.status === "in_queue" ||
							existingJob.status === "in_progress")
					) {
						return Response.json(
							{
								success: false,
								error: "IPA generation already in progress",
								jobId: existingJob.id,
							},
							{ status: 409 },
						);
					}

					const config = getRunPodConfig();

					// Build webhook URL for IPA generation results
					let webhookBaseUrl = getWebhookBaseUrl(request);
					
					// FIX: If talking to local RunPod proxy (localhost), ensure webhook uses host.docker.internal
					// This is needed because the proxy running in Docker can't reach 'localhost' (itself)
					if (config.apiUrl.includes("localhost") || config.apiUrl.includes("127.0.0.1")) {
						if (webhookBaseUrl.includes("localhost") || webhookBaseUrl.includes("127.0.0.1")) {
							console.log("Detecting local RunPod proxy usage, rewriting webhook to host.docker.internal");
							webhookBaseUrl = webhookBaseUrl.replace("localhost", "host.docker.internal").replace("127.0.0.1", "host.docker.internal");
						}
					}

					const webhookUrl = new URL(
						"/api/webhook/ipa-generation",
						webhookBaseUrl,
					).toString();
					
					console.log(`Debug: Webhook URL set to: ${webhookUrl}`);

					// Get audio URL
					// Strategy:
					// 1. In production, use R2 public URL (efficient)
					// 2. In local dev (RunPod proxy), use the backend's own API as a proxy
					//    This avoids R2 public access issues (CORS, SSL, blocked domains)
					//    and leverages the backend's authenticated R2 access.
					let audioUri: string;
					
					if (config.apiUrl.includes("localhost") || config.apiUrl.includes("127.0.0.1")) {
						// Local/Docker environment: Use local backend proxy
						// webhookBaseUrl is already set to host.docker.internal if needed
						audioUri = new URL(`/api/audio/${reference.id}`, webhookBaseUrl).toString();
						console.log("Debug: Using local backend audio proxy instead of R2 direct link");
					} else {
						// Production: Use direct R2 link
						audioUri = getPublicUrl(reference.storageKey);
					}
					
					console.log(`Debug: Generated audio URI: ${audioUri}`);

					// Submit job to RunPod
					const runpodResponse = await fetch(
						`${config.apiUrl}/v2/${config.endpoints.generation}/run`,
						{
							method: "POST",
							headers: getRunPodHeaders(),
							body: JSON.stringify({
								input: {
									text: reference.text.content,
									audio_uri: audioUri,
								},
								webhook: webhookUrl,
							}),
						},
					);

					if (!runpodResponse.ok) {
						const errorText = await runpodResponse.text();
						console.error("RunPod IPA generation submission failed:", errorText);
						return Response.json(
							{ success: false, error: "Failed to submit IPA generation job" },
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

					// Create IPA generation job in database
					const job = await createIpaGenerationJob(
						referenceSpeechId,
						runJobResult.data.id,
					);

					return Response.json({
						success: true,
						data: {
							id: job.id,
							externalJobId: job.externalJobId,
							status: job.status,
							referenceSpeechId: job.referenceSpeechId,
						},
					});
				} catch (error) {
					console.error("Failed to submit IPA generation job:", error);
					const message =
						error instanceof Error
							? error.message
							: "Failed to submit IPA generation job";
					return Response.json(
						{ success: false, error: message },
						{ status: 500 },
					);
				}
			},

			// GET /api/admin/ipa-generation?id=<job_id> - Get job status
			GET: async ({ request }) => {
				try {
					const url = new URL(request.url);
					const externalJobId = url.searchParams.get("id");

					if (!externalJobId) {
						return Response.json(
							{ success: false, error: "Missing job ID" },
							{ status: 400 },
						);
					}

					const job = await getIpaGenerationJobByExternalId(externalJobId);
					if (!job) {
						return Response.json(
							{ success: false, error: "Job not found" },
							{ status: 404 },
						);
					}

					return Response.json({
						success: true,
						data: job,
					});
				} catch (error) {
					console.error("Failed to get IPA generation job:", error);
					return Response.json(
						{ success: false, error: "Failed to get job" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
