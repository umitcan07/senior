import { createFileRoute } from "@tanstack/react-router";
import {
	getAnalysisById,
	insertAudioQualityMetrics,
	insertPhonemeErrors,
	updateAnalysis,
} from "@/db/analysis";
import {
	getAssessmentJobByExternalId,
	updateAssessmentJob,
} from "@/db/assessment-job";
import {
	AssessmentOutputSchema,
	mapRunPodStatusToDb,
	WebhookPayloadSchema,
} from "@/lib/runpod-schemas";

/**
 * Parse POWSM phoneme format (/a//ɪ//n/) to space-separated phonemes (a ɪ n)
 */
function parsePowsmPhonemes(input: string): string {
	if (!input) return "";
	// Split by // and filter out empty strings, then join with spaces
	return input
		.split(/\/+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
		.join(" ");
}

export const Route = createFileRoute("/api/webhook/assessment")({
	server: {
		handlers: {
			// POST /api/webhook/assessment - Receive webhook from RunPod
			POST: async ({ request }) => {
				try {
					const body = await request.json();

					// Validate webhook payload
					const parseResult = WebhookPayloadSchema.safeParse(body);

					if (!parseResult.success) {
						console.error(
							"Invalid assessment webhook payload:",
							parseResult.error,
						);
						return Response.json(
							{ success: false, error: "Invalid webhook payload" },
							{ status: 400 },
						);
					}

					const { id, status, output, error, executionTime, delayTime } =
						parseResult.data;

					// Find assessment job by external ID
					const job = await getAssessmentJobByExternalId(id);
					if (!job) {
						console.warn(`Assessment webhook received for unknown job: ${id}`);
						// Return 200 to prevent RunPod from retrying
						return Response.json({
							success: true,
							message: "Job not found, ignored",
						});
					}

					// Map RunPod status to job status
					const jobStatus = mapRunPodStatusToDb(status);
					const jobError = error ?? null;

					// Check if output contains error info
					let hasOutputError = false;
					if (output && typeof output === "object") {
						const outputObj = output as Record<string, unknown>;
						if (outputObj.status === "FAILED" || outputObj.error) {
							hasOutputError = true;
						}
					}

					// Update job record
					await updateAssessmentJob(id, {
						status: hasOutputError ? "failed" : jobStatus,
						result: output as Record<string, unknown> | undefined,
						error: hasOutputError
							? String(
									(output as Record<string, unknown>)?.error ?? "Unknown error",
								)
							: jobError,
						executionTimeMs: executionTime ?? null,
						delayTimeMs: delayTime ?? null,
					});

					// Determine analysis status
					const analysisStatus = hasOutputError
						? "failed"
						: jobStatus === "completed"
							? "completed"
							: jobStatus === "failed"
								? "failed"
								: "processing";

					// Update analysis based on status
					if (analysisStatus === "completed" && output) {
						// Parse the worker output (scored | abstained — contract #22).
						const parsed = AssessmentOutputSchema.safeParse(output);
						if (!parsed.success) {
							console.error(
								`Invalid assessment output format for job ${id}:`,
								parsed.error,
							);
							await updateAnalysis(job.analysisId, {
								status: "failed",
								processingDurationMs: executionTime ?? null,
							});
							return Response.json({ success: true });
						}
						const assessmentOutput = parsed.data;

						// Persist audio quality metrics for either branch (if present).
						if (assessmentOutput.signal_quality) {
							const analysis = await getAnalysisById(job.analysisId);
							const sq = assessmentOutput.signal_quality;
							if (analysis && sq.snr_estimate_db != null) {
								await insertAudioQualityMetrics({
									userRecordingId: analysis.userRecordingId,
									snrDb: sq.snr_estimate_db.toString(),
									noiseRatio: null, // Not calculated
									silenceRatio: sq.silence_ratio?.toString() ?? null,
									clippingRatio: sq.clipping_ratio?.toString() ?? null,
									qualityStatus: sq.is_acceptable
										? (sq.warnings?.length ?? 0) > 0
											? "warning"
											: "accept"
										: "reject",
								});
							}
						}

						if (assessmentOutput.status === "abstained") {
							// Non-happy path: store the reason, leave score columns NULL.
							// status stays "completed"; the UI renders a banner (#38).
							await updateAnalysis(job.analysisId, {
								status: "completed",
								abstentionReason: assessmentOutput.abstention.reason,
								processingDurationMs: executionTime ?? null,
							});
							console.log(
								`Assessment abstained for analysis ${job.analysisId}: ${assessmentOutput.abstention.reason}`,
							);
						} else {
							// Scored path. Insert phoneme errors BEFORE flipping status to
							// "completed" so the polling analysis page never reads a
							// completed row with missing errors (the #53 race that showed
							// a false "Perfect Pronunciation").
							const phonemeErrorRows = assessmentOutput.errors.map((err) => ({
								analysisId: job.analysisId,
								errorType: err.type,
								position: err.position,
								expected: err.expected ?? null,
								actual: err.actual ?? null,
								// Convert seconds to milliseconds.
								timestampStartMs: err.timestamp
									? Math.round(err.timestamp.start * 1000)
									: null,
								timestampEndMs: err.timestamp
									? Math.round(err.timestamp.end * 1000)
									: null,
								gopScore:
									err.gop_score != null ? err.gop_score.toFixed(3) : null,
								entropy: err.entropy != null ? err.entropy.toFixed(3) : null,
								uncertain: err.uncertain ?? false,
							}));
							await insertPhonemeErrors(phonemeErrorRows);

							await updateAnalysis(job.analysisId, {
								status: "completed",
								abstentionReason: null,
								overallScore: assessmentOutput.score.toFixed(4),
								phonemeScore: assessmentOutput.score.toFixed(4),
								confidence: assessmentOutput.confidence.toFixed(4),
								targetPhonemes: parsePowsmPhonemes(assessmentOutput.target_ipa),
								recognizedPhonemes: parsePowsmPhonemes(
									assessmentOutput.actual_ipa,
								),
								phonemeDistance: assessmentOutput.errors.length,
								processingDurationMs: executionTime ?? null,
							});
							console.log(
								`Assessment completed for analysis ${job.analysisId}: score=${assessmentOutput.score.toFixed(2)}, ${phonemeErrorRows.length} errors`,
							);
						}
					} else {
						// Update status only (for in_queue, in_progress, or failed)
						await updateAnalysis(job.analysisId, {
							status: analysisStatus,
							processingDurationMs: executionTime ?? null,
						});
					}

					console.log(
						`Assessment job ${id} updated via webhook: ${status} -> ${analysisStatus}`,
					);
					return Response.json({ success: true });
				} catch (error) {
					console.error("Assessment webhook processing failed:", error);
					return Response.json(
						{ success: false, error: "Webhook processing failed" },
						{ status: 500 },
					);
				}
			},
		},
	},
});
