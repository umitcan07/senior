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

// --- Assessment worker output (mod/assessment/assess.py, contract #22) -------

export const AbstentionReasonSchema = z.enum([
	"no_speech",
	"low_audio_quality",
	"duration_out_of_range",
	"wrong_sentence",
	"uncertain",
]);
export type AbstentionReason = z.infer<typeof AbstentionReasonSchema>;

const SignalQualitySchema = z
	.object({
		is_acceptable: z.boolean(),
		quality_score: z.number(),
		rms_db: z.number(),
		clipping_ratio: z.number(),
		silence_ratio: z.number(),
		snr_estimate_db: z.number(),
		duration_seconds: z.number(),
		warnings: z.array(z.string()),
		suggestions: z.array(z.string()),
	})
	.partial()
	.passthrough();

const AssessTimestampSchema = z
	.object({ start: z.number(), end: z.number() })
	.nullable()
	.optional();

const AssessPhonemeErrorSchema = z.object({
	type: z.enum(["substitute", "insert", "delete"]),
	position: z.number(),
	expected: z.string().nullable().optional(),
	actual: z.string().nullable().optional(),
	timestamp: AssessTimestampSchema,
	gop_score: z.number().nullable().optional(),
	entropy: z.number().nullable().optional(),
	uncertain: z.boolean().nullable().optional(),
});
export type AssessPhonemeError = z.infer<typeof AssessPhonemeErrorSchema>;

// Recognized (user) phone with timing + GOP — the free-alignment timeline.
const AssessPhoneSchema = z.object({
	token: z.string(),
	start_ms: z.number(),
	end_ms: z.number(),
	confidence: z.number().nullable().optional(),
	gop_score: z.number().nullable().optional(),
	entropy: z.number().nullable().optional(),
	uncertain: z.boolean().nullable().optional(),
});
export type AssessPhone = z.infer<typeof AssessPhoneSchema>;

// Scored result: a real assessment with per-phone GOP + CTC timestamps.
const ScoredOutputSchema = z.object({
	status: z.literal("scored"),
	score: z.number(),
	confidence: z.number(),
	actual_ipa: z.string(),
	target_ipa: z.string(),
	per: z.number().optional(),
	errors: z.array(AssessPhonemeErrorSchema),
	phones: z.array(AssessPhoneSchema).optional(),
	signal_quality: SignalQualitySchema.optional(),
	alignment_method: z.string().nullable().optional(),
});

// Abstained result: input wasn't scoreable; UI shows a banner (#38), score NULL.
const AbstainedOutputSchema = z.object({
	status: z.literal("abstained"),
	abstention: z.object({
		reason: AbstentionReasonSchema,
		detail: z.record(z.string(), z.unknown()).optional(),
	}),
	signal_quality: SignalQualitySchema.optional(),
});

export const AssessmentOutputSchema = z.discriminatedUnion("status", [
	ScoredOutputSchema,
	AbstainedOutputSchema,
]);
export type AssessmentOutput = z.infer<typeof AssessmentOutputSchema>;

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
