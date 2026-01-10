import { createFileRoute } from "@tanstack/react-router";
import { getJobByExternalId, updateJob } from "@/db/job";
import {
	mapRunPodStatusToDb,
	WebhookPayloadSchema,
} from "@/lib/runpod-schemas";

export const Route = createFileRoute("/api/webhook/jobs")({
	server: {
		handlers: {
			// POST /api/webhook/jobs - Receive webhook from RunPod
			POST: async ({ request }) => {
				try {
					const body = await request.json();

					// Validate webhook payload
					const parseResult = WebhookPayloadSchema.safeParse(body);

					if (!parseResult.success) {
						console.error("Invalid webhook payload:", parseResult.error);
						return Response.json(
							{ success: false, error: "Invalid webhook payload" },
							{ status: 400 },
						);
					}

					const { id, status, output, error, executionTime, delayTime } =
						parseResult.data;

					// Find job by external ID
					const job = await getJobByExternalId(id);
					if (!job) {
						console.warn(`Webhook received for unknown job: ${id}`);
						// Return 200 to prevent RunPod from retrying
						return Response.json({
							success: true,
							message: "Job not found, ignored",
						});
					}

// Update job status
					let dbStatus = mapRunPodStatusToDb(status);
					const jobError = error ?? null;

					// Check if output contains error or status info
					if (output && typeof output === "object") {
						const outputObj = output as Record<string, unknown>;

						// If output explicitly says FAILED, update status
						// This allows us to mark the job as failed even if RunPod thinks it completed successfully
						if (outputObj.status === "FAILED") {
							dbStatus = "failed";
						}
					}

					await updateJob(id, {
						status: dbStatus,
						result: output ?? undefined,
						error: jobError,
						executionTimeMs: executionTime ?? null,
						delayTimeMs: delayTime ?? null,
					});

					console.log(`Job ${id} updated via webhook: ${status}`);
					return Response.json({ success: true });
				} catch (error) {
					console.error("Webhook processing failed:", error);
					return Response.json(
						{ success: false, error: "Webhook processing failed" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
