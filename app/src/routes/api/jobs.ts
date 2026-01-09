import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { createJob, getAllJobs, updateJob } from "@/db/job";
import {
	getRunPodConfig,
	getRunPodHeaders,
	getWebhookBaseUrl,
} from "@/lib/runpod-config";
import {
	JobStatusResponseSchema,
	mapRunPodStatusToDb,
	RunJobResponseSchema,
} from "@/lib/runpod-schemas";

// Schema for the submit job request body
const SubmitJobRequestSchema = z.object({
	input: z.record(z.string(), z.unknown()).default({}),
});

export const Route = createFileRoute("/api/jobs")({
	server: {
		handlers: {
			// GET /api/jobs - List all jobs (and poll pending ones)
			GET: async () => {
				try {
					const jobs = await getAllJobs();
					const config = getRunPodConfig();

					// Poll RunPod for any pending jobs and update the database
					const pendingJobs = jobs.filter(
						(j) => j.status === "in_queue" || j.status === "in_progress",
					);

					for (const job of pendingJobs) {
						try {
							const response = await fetch(
								`${config.apiUrl}/v2/${config.endpoints.assessment}/status/${job.externalJobId}`,
								{ headers: getRunPodHeaders() },
							);

							if (response.ok) {
								const data = await response.json();
								const statusResult = JobStatusResponseSchema.safeParse(data);

								if (statusResult.success) {
									const { status, output, error, executionTime, delayTime } =
										statusResult.data;
									const dbStatus = mapRunPodStatusToDb(status);

									if (dbStatus !== job.status) {
										await updateJob(job.externalJobId, {
											status: dbStatus,
											result: output ?? undefined,
											error: error ?? null,
											executionTimeMs: executionTime ?? null,
											delayTimeMs: delayTime ?? null,
										});
									}
								}
							}
						} catch (pollError) {
							console.warn(
								`Failed to poll job ${job.externalJobId}:`,
								pollError,
							);
							// Continue with other jobs even if one fails
						}
					}

					// Re-fetch jobs to get updated statuses
					const updatedJobs =
						pendingJobs.length > 0 ? await getAllJobs() : jobs;
					return Response.json({ success: true, data: updatedJobs });
				} catch (error) {
					console.error("Failed to list jobs:", error);
					return Response.json(
						{ success: false, error: "Failed to list jobs" },
						{ status: 500 },
					);
				}
			},

			// POST /api/jobs - Submit a new job
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const parseResult = SubmitJobRequestSchema.safeParse(body);

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

					const { input } = parseResult.data;
					const config = getRunPodConfig();

					// Build webhook URL (prefers WEBHOOK_BASE_URL env var, falls back to request origin)
					const webhookBaseUrl = getWebhookBaseUrl(request);
					const webhookUrl = new URL(
						"/api/webhook/jobs",
						webhookBaseUrl,
					).toString();

					// Submit job to RunPod
					const runpodResponse = await fetch(
						`${config.apiUrl}/v2/${config.endpoints.assessment}/run`,
						{
							method: "POST",
							headers: getRunPodHeaders(),
							body: JSON.stringify({
								input,
								webhook: webhookUrl,
							}),
						},
					);

					if (!runpodResponse.ok) {
						const errorText = await runpodResponse.text();
						console.error("RunPod submission failed:", errorText);
						return Response.json(
							{ success: false, error: "Failed to submit job to RunPod" },
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

					// Create job in database
					const job = await createJob(runJobResult.data.id);

					return Response.json({
						success: true,
						data: {
							id: job.id,
							externalJobId: job.externalJobId,
							status: job.status,
						},
					});
				} catch (error) {
					console.error("Failed to submit job:", error);
					const message =
						error instanceof Error ? error.message : "Failed to submit job";
					return Response.json(
						{ success: false, error: message },
						{ status: 500 },
					);
				}
			},
		},
	},
});
