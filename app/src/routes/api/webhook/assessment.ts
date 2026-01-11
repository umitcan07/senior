import { createFileRoute } from "@tanstack/react-router";
import {
	getAnalysisById,
	insertAudioQualityMetrics,
	insertPhonemeErrors,
	insertWordErrors,
	updateAnalysis,
} from "@/db/analysis";
import {
	getAssessmentJobByExternalId,
	updateAssessmentJob,
} from "@/db/assessment-job";
import {
	mapRunPodStatusToDb,
	WebhookPayloadSchema,
} from "@/lib/runpod-schemas";

// Assessment output schema from mod/assessment/assess.py
interface AssessmentOutput {
	actual_ipa: string;
	actual_text?: string;
	actual_text_normalized?: string;
	target_text_normalized?: string;
	target_ipa: string;
	score: number;
	errors: Array<{
		type: "substitute" | "insert" | "delete";
		position: number;
		expected?: string | null;
		actual?: string | null;
		timestamp?: {
			start: number; // seconds
			end: number; // seconds
		};
	}>;
	signal_quality?: {
		is_acceptable: boolean;
		quality_score: number;
		rms_db: number;
		clipping_ratio: number;
		silence_ratio: number;
		snr_estimate_db: number;
		duration_seconds: number;
		warnings: string[];
		suggestions: string[];
	};
	word_errors?: Array<{
		type: "substitute" | "insert" | "delete";
		position: number;
		expected?: string | null;
		actual?: string | null;
		timestamp?: {
			start: number;
			end: number;
		};
	}>;
}

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
						console.warn(
							`Assessment webhook received for unknown job: ${id}`,
						);
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
							? String((output as Record<string, unknown>)?.error ?? "Unknown error")
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
						const assessmentOutput = output as AssessmentOutput;

						// Validate we have the expected output format
						if (
							typeof assessmentOutput.score !== "number" ||
							!Array.isArray(assessmentOutput.errors)
						) {
							console.error(
								`Invalid assessment output format for job ${id}:`,
								output,
							);
							await updateAnalysis(job.analysisId, {
								status: "failed",
								processingDurationMs: executionTime ?? null,
							});
							return Response.json({ success: true });
						}

						// Update analysis with results
						await updateAnalysis(job.analysisId, {
							status: "completed",
							overallScore: assessmentOutput.score.toFixed(4),
							phonemeScore: assessmentOutput.score.toFixed(4),
							targetPhonemes: parsePowsmPhonemes(assessmentOutput.target_ipa),
							recognizedPhonemes: parsePowsmPhonemes(assessmentOutput.actual_ipa),
							targetWords: assessmentOutput.target_text_normalized ?? null,
							recognizedWords: assessmentOutput.actual_text_normalized ?? assessmentOutput.actual_text ?? null,
							phonemeDistance: assessmentOutput.errors.length,
							processingDurationMs: executionTime ?? null,
						});

						// Insert audio quality metrics if available
						if (assessmentOutput.signal_quality) {
							const analysis = await getAnalysisById(job.analysisId);
							if (analysis) {
								const sq = assessmentOutput.signal_quality;
								await insertAudioQualityMetrics({
									userRecordingId: analysis.userRecordingId,
									snrDb: sq.snr_estimate_db.toString(),
									noiseRatio: null, // Not calculated
									silenceRatio: sq.silence_ratio.toString(),
									clippingRatio: sq.clipping_ratio.toString(),
									qualityStatus: sq.is_acceptable
										? sq.warnings.length > 0
											? "warning"
											: "accept"
										: "reject",
								});
							}
						}

						// Insert phoneme errors (convert timestamps from seconds to milliseconds)
						if (assessmentOutput.errors.length > 0) {
							console.log(
								`[Webhook] Processing ${assessmentOutput.errors.length} errors. Sample timestamp:`,
								assessmentOutput.errors[0]?.timestamp,
							);
							const phonemeErrors = assessmentOutput.errors.map((err) => ({
								analysisId: job.analysisId,
								errorType: err.type,
								position: err.position,
								expected: err.expected ?? null,
								actual: err.actual ?? null,
								// Convert seconds to milliseconds
								timestampStartMs: err.timestamp
									? Math.round(err.timestamp.start * 1000)
									: null,
								timestampEndMs: err.timestamp
									? Math.round(err.timestamp.end * 1000)
									: null,
							}));

							await insertPhonemeErrors(phonemeErrors);
							console.log(
								`Inserted ${phonemeErrors.length} phoneme errors for analysis ${job.analysisId}`,
							);
						}

						// Insert word errors
						if (assessmentOutput.word_errors && assessmentOutput.word_errors.length > 0) {
							console.log(
								`[Webhook] Processing ${assessmentOutput.word_errors.length} word errors`,
							);
							const wordErrors = assessmentOutput.word_errors.map((err) => ({
								analysisId: job.analysisId,
								errorType: err.type,
								position: err.position,
								expected: err.expected ?? null,
								actual: err.actual ?? null,
								// Word timestamps are optional currently
								timestampStartMs: err.timestamp
									? Math.round(err.timestamp.start * 1000)
									: null,
								timestampEndMs: err.timestamp
									? Math.round(err.timestamp.end * 1000)
									: null,
							}));

							await insertWordErrors(wordErrors);
							console.log(
								`Inserted ${wordErrors.length} word errors for analysis ${job.analysisId}`,
							);
						}

						console.log(
							`Assessment completed for analysis ${job.analysisId}: score=${assessmentOutput.score.toFixed(2)}`,
						);
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
