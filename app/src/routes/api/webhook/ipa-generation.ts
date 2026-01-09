import { createFileRoute } from "@tanstack/react-router";
import {
	getIpaGenerationJobByExternalId,
	updateIpaGenerationJob,
	updateReferenceSpeechIpa,
} from "@/db/ipa-generation-job";
import {
	mapRunPodStatusToDb,
	WebhookPayloadSchema,
} from "@/lib/runpod-schemas";

export const Route = createFileRoute("/api/webhook/ipa-generation")({
	server: {
		handlers: {
			// POST /api/webhook/ipa-generation - Receive webhook from RunPod
			POST: async ({ request }) => {
				try {
					const body = await request.json();

					// Validate webhook payload
					const parseResult = WebhookPayloadSchema.safeParse(body);

					if (!parseResult.success) {
						console.error("Invalid IPA generation webhook payload:", parseResult.error);
						return Response.json(
							{ success: false, error: "Invalid webhook payload" },
							{ status: 400 },
						);
					}

					const { id, status, output, error, executionTime, delayTime } =
						parseResult.data;

					// Find IPA generation job by external ID
					const job = await getIpaGenerationJobByExternalId(id);
					if (!job) {
						console.warn(`IPA generation webhook received for unknown job: ${id}`);
						// Return 200 to prevent RunPod from retrying
						return Response.json({
							success: true,
							message: "Job not found, ignored",
						});
					}

					// Update job status
					const dbStatus = mapRunPodStatusToDb(status);
					await updateIpaGenerationJob(id, {
						status: dbStatus,
						result: output ? (output as Record<string, unknown>) : undefined,
						error: error ?? null,
						executionTimeMs: executionTime ?? null,
						delayTimeMs: delayTime ?? null,
					});

					// If completed successfully, update the reference speech with IPA
					if (dbStatus === "completed" && output) {
						const ipaPhonemes = (output as { ipa_phonemes?: string }).ipa_phonemes;
						if (ipaPhonemes) {
							await updateReferenceSpeechIpa(
								job.referenceSpeechId,
								ipaPhonemes,
								"powsm",
							);
							console.log(
								`Updated reference speech ${job.referenceSpeechId} with IPA: ${ipaPhonemes.substring(0, 50)}...`,
							);
						} else {
							console.warn(
								`IPA generation completed but no ipa_phonemes in output for job ${id}`,
							);
						}
					}

					console.log(`IPA generation job ${id} updated via webhook: ${status}`);
					return Response.json({ success: true });
				} catch (error) {
					console.error("IPA generation webhook processing failed:", error);
					return Response.json(
						{ success: false, error: "Webhook processing failed" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
