import { z } from "zod";

/**
 * Zod schemas for RunPod API responses
 * All external data must be validated through these schemas
 */

// Job statuses from RunPod
export const RunPodStatusSchema = z.enum([
	"IN_QUEUE",
	"IN_PROGRESS",
	"COMPLETED",
	"FAILED",
]);

export type RunPodStatus = z.infer<typeof RunPodStatusSchema>;

// Response from POST /v2/{endpoint}/run
export const RunJobResponseSchema = z.object({
	id: z.string(),
	status: RunPodStatusSchema,
});

export type RunJobResponse = z.infer<typeof RunJobResponseSchema>;

// Response from GET /v2/{endpoint}/status/{id}
export const JobStatusResponseSchema = z.object({
	id: z.string(),
	status: RunPodStatusSchema,
	output: z.unknown().nullable().optional(),
	error: z.string().nullable().optional(),
	executionTime: z.number().nullable().optional(),
	delayTime: z.number().nullable().optional(),
});

export type JobStatusResponse = z.infer<typeof JobStatusResponseSchema>;

// Webhook payload (same structure as status response)
export const WebhookPayloadSchema = z.object({
	id: z.string(),
	status: RunPodStatusSchema,
	output: z.unknown().nullable().optional(),
	error: z.string().nullable().optional(),
	executionTime: z.number().nullable().optional(),
	delayTime: z.number().nullable().optional(),
});

export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

// Helper to map RunPod status to DB status
export function mapRunPodStatusToDb(
	status: RunPodStatus,
): "in_queue" | "in_progress" | "completed" | "failed" {
	switch (status) {
		case "IN_QUEUE":
			return "in_queue";
		case "IN_PROGRESS":
			return "in_progress";
		case "COMPLETED":
			return "completed";
		case "FAILED":
			return "failed";
	}
}
