import { createFileRoute } from "@tanstack/react-router";
import { getJobById, updateJob } from "@/db/job";
import { getRunPodConfig, getRunPodHeaders } from "@/lib/runpod-config";
import {
	JobStatusResponseSchema,
	mapRunPodStatusToDb,
} from "@/lib/runpod-schemas";

export const Route = createFileRoute("/api/jobs/$id")({
	server: {
		handlers: {
			// GET /api/jobs/:id - Poll RunPod for job status and update DB
			GET: async ({ params }) => {
				try {
					const { id } = params;
					const config = getRunPodConfig();

					// Get job from DB
					const job = await getJobById(id);
					if (!job) {
						return Response.json(
							{ success: false, error: "Job not found" },
							{ status: 404 },
						);
					}

					// If job is already completed or failed, just return it
					if (job.status === "completed" || job.status === "failed") {
						return Response.json({ success: true, data: job });
					}

					// Poll RunPod for status
					const runpodResponse = await fetch(
						`${config.apiUrl}/v2/${config.endpoints.assessment}/status/${job.externalJobId}`,
						{ headers: getRunPodHeaders() },
					);

					if (!runpodResponse.ok) {
						console.error(
							"RunPod status check failed:",
							await runpodResponse.text(),
						);
						// Return current DB state if RunPod is unavailable
						return Response.json({ success: true, data: job });
					}

					const runpodData = await runpodResponse.json();
					const statusResult = JobStatusResponseSchema.safeParse(runpodData);

					if (!statusResult.success) {
						console.error(
							"Invalid RunPod status response:",
							statusResult.error,
						);
						return Response.json({ success: true, data: job });
					}

					const { status, output, error, executionTime, delayTime } =
						statusResult.data;
					const dbStatus = mapRunPodStatusToDb(status);

					// Update job in DB if status changed
					if (dbStatus !== job.status) {
						const updatedJob = await updateJob(job.externalJobId, {
							status: dbStatus,
							result: output ?? undefined,
							error: error ?? null,
							executionTimeMs: executionTime ?? null,
							delayTimeMs: delayTime ?? null,
						});
						return Response.json({ success: true, data: updatedJob });
					}

					return Response.json({ success: true, data: job });
				} catch (error) {
					console.error("Failed to get job status:", error);
					const message =
						error instanceof Error ? error.message : "Failed to get job status";
					return Response.json(
						{ success: false, error: message },
						{ status: 500 },
					);
				}
			},
		},
	},
});
