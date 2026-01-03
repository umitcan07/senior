import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthorById } from "@/db/author";
import {
	deleteReferenceSpeech,
	getReferenceSpeechesForText,
	getReferenceSpeechesWithRelations,
	insertReferenceSpeech,
	type ReferenceSpeech,
	type ReferenceSpeechWithRelations,
	updateReferenceSpeech,
} from "@/db/reference";
import { getPracticeTextById } from "@/db/text";
import { generateSpeech } from "./elevenlabs";
import {
	type ApiResponse,
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";
import { existsInR2, getFromR2, uploadToR2 } from "./r2";

// Schemas

const InsertReferenceSchema = z.object({
	storageKey: z.string().min(1, "Storage key is required"),
	authorId: z.string().uuid("Invalid author ID"),
	textId: z.string().uuid("Invalid text ID"),
	generationMethod: z.enum(["tts", "native"]),
	ipaTranscription: z.string().nullable().optional(),
	priority: z.number().int().optional(),
	durationMs: z.number().int().nullable().optional(),
	fileSizeBytes: z.number().int().nullable().optional(),
	sampleRateHz: z.number().int().nullable().optional(),
	channels: z.number().int().nullable().optional(),
	bitrateKbps: z.number().int().nullable().optional(),
});

const UpdateReferenceSchema = z.object({
	id: z.string().uuid(),
	storageKey: z.string().min(1).optional(),
	authorId: z.string().uuid().optional(),
	textId: z.string().uuid().optional(),
	generationMethod: z.enum(["tts", "native"]).optional(),
	ipaTranscription: z.string().nullable().optional(),
	priority: z.number().int().optional(),
	durationMs: z.number().int().nullable().optional(),
	fileSizeBytes: z.number().int().nullable().optional(),
	sampleRateHz: z.number().int().nullable().optional(),
	channels: z.number().int().nullable().optional(),
	bitrateKbps: z.number().int().nullable().optional(),
});

const DeleteReferenceSchema = z.object({
	id: z.string().uuid(),
});

const GenerateSpeechSchema = z.object({
	textId: z.string().uuid("Invalid text ID"),
	authorId: z.string().uuid("Invalid author ID"),
	voiceSettings: z
		.object({
			stability: z.number().min(0).max(1).optional(),
			similarityBoost: z.number().min(0).max(1).optional(),
			style: z.number().min(0).max(1).optional(),
			useSpeakerBoost: z.boolean().optional(),
		})
		.optional(),
});

// Server Functions

export const serverGetReferences = createServerFn({ method: "GET" }).handler(
	async (): Promise<ApiResponse<ReferenceSpeechWithRelations[]>> => {
		try {
			const result = await getReferenceSpeechesWithRelations();
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Get references error:", error);
			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to fetch reference speeches",
				undefined,
				500,
			);
		}
	},
);

const GetReferencesForTextSchema = z.object({
	textId: z.string().uuid("Invalid text ID"),
});

export const serverGetReferencesForText = createServerFn({ method: "GET" })
	.inputValidator(GetReferencesForTextSchema)
	.handler(
		async ({ data }): Promise<ApiResponse<ReferenceSpeechWithRelations[]>> => {
			try {
				const result = await getReferenceSpeechesForText(data.textId);
				return createSuccessResponse(result);
			} catch (error) {
				console.error("Get references for text error:", error);
				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"Failed to fetch reference speeches for text",
					undefined,
					500,
				);
			}
		},
	);

export const serverInsertReference = createServerFn({ method: "POST" })
	.inputValidator(InsertReferenceSchema)
	.handler(async ({ data }): Promise<ApiResponse<ReferenceSpeech>> => {
		try {
			const result = await insertReferenceSpeech({
				storageKey: data.storageKey,
				authorId: data.authorId,
				textId: data.textId,
				generationMethod: data.generationMethod,
				ipaTranscription: data.ipaTranscription,
				priority: data.priority,
				durationMs: data.durationMs,
				fileSizeBytes: data.fileSizeBytes,
				sampleRateHz: data.sampleRateHz,
				channels: data.channels,
				bitrateKbps: data.bitrateKbps,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Insert reference error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.issues },
					400,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to create reference speech",
				undefined,
				500,
			);
		}
	});

export const serverUpdateReference = createServerFn({ method: "POST" })
	.inputValidator(UpdateReferenceSchema)
	.handler(async ({ data }): Promise<ApiResponse<ReferenceSpeech>> => {
		try {
			const result = await updateReferenceSpeech(data.id, {
				storageKey: data.storageKey,
				authorId: data.authorId,
				textId: data.textId,
				generationMethod: data.generationMethod,
				ipaTranscription: data.ipaTranscription,
				priority: data.priority,
				durationMs: data.durationMs,
				fileSizeBytes: data.fileSizeBytes,
				sampleRateHz: data.sampleRateHz,
				channels: data.channels,
				bitrateKbps: data.bitrateKbps,
			});
			return createSuccessResponse(result);
		} catch (error) {
			console.error("Update reference error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.issues },
					400,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to update reference speech",
				undefined,
				500,
			);
		}
	});

export const serverDeleteReference = createServerFn({ method: "POST" })
	.inputValidator(DeleteReferenceSchema)
	.handler(async ({ data }): Promise<ApiResponse<{ success: boolean }>> => {
		try {
			await deleteReferenceSpeech(data.id);
			return createSuccessResponse({ success: true });
		} catch (error) {
			console.error("Delete reference error:", error);

			if (error instanceof z.ZodError) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Invalid input data",
					{ errors: error.issues },
					400,
				);
			}

			return createErrorResponse(
				ErrorCode.DATABASE_ERROR,
				"Failed to delete reference speech",
				undefined,
				500,
			);
		}
	});

/**
 * Parse WAV file metadata from buffer
 * Returns sample rate, channels, and duration in milliseconds
 */
function parseWavMetadata(buffer: Buffer): {
	sampleRate: number;
	channels: number;
	durationMs: number;
} {
	// WAV header structure:
	// 0-3: "RIFF"
	// 4-7: file size
	// 8-11: "WAVE"
	// 12-15: "fmt "
	// 16-19: fmt chunk size (16)
	// 20-21: audio format (1 = PCM)
	// 22-23: num channels
	// 24-27: sample rate
	// 28-31: byte rate
	// 32-33: block align
	// 34-35: bits per sample
	// 36-39: "data"
	// 40-43: data size

	if (buffer.length < 44) {
		throw new Error(
			`Invalid WAV file: too short (${buffer.length} bytes, need at least 44)`,
		);
	}

	// Verify RIFF header
	const riffHeader = buffer.toString("ascii", 0, 4);
	if (riffHeader !== "RIFF") {
		throw new Error(
			`Invalid WAV file: missing RIFF header (found: ${riffHeader})`,
		);
	}

	const waveHeader = buffer.toString("ascii", 8, 12);
	if (waveHeader !== "WAVE") {
		throw new Error(
			`Invalid WAV file: missing WAVE header (found: ${waveHeader})`,
		);
	}

	const fmtHeader = buffer.toString("ascii", 12, 16);
	if (fmtHeader !== "fmt ") {
		throw new Error(
			`Invalid WAV file: missing fmt chunk (found: ${fmtHeader})`,
		);
	}

	const channels = buffer.readUInt16LE(22);
	const sampleRate = buffer.readUInt32LE(24);
	const bitsPerSample = buffer.readUInt16LE(34);

	// Find data chunk - start from offset 36 (standard location)
	let dataOffset = 36;
	let dataSize = 0;

	// First check if "data" is at the standard offset
	const chunkId = buffer.toString("ascii", dataOffset, dataOffset + 4);
	if (chunkId === "data") {
		dataSize = buffer.readUInt32LE(dataOffset + 4);
	} else {
		// Search for "data" chunk (might not be at offset 36 if there are extra chunks)
		dataOffset = 36;
		while (dataOffset < buffer.length - 8) {
			const currentChunkId = buffer.toString(
				"ascii",
				dataOffset,
				dataOffset + 4,
			);
			if (currentChunkId === "data") {
				dataSize = buffer.readUInt32LE(dataOffset + 4);
				break;
			}
			// Move to next chunk
			const chunkSize = buffer.readUInt32LE(dataOffset + 4);
			dataOffset += 8 + chunkSize;

			// Safety check to avoid infinite loop
			if (chunkSize === 0 || chunkSize > buffer.length) {
				break;
			}
		}
	}

	if (dataSize === 0) {
		// Log debug info
		console.error("WAV parsing error - buffer details:", {
			length: buffer.length,
			firstBytes: Array.from(buffer.slice(0, 50)).map((b) =>
				b.toString(16).padStart(2, "0"),
			),
			headerAscii: buffer.slice(0, 44).toString("ascii"),
			chunkAt36: buffer.toString("ascii", 36, 40),
		});
		throw new Error("Invalid WAV file: data chunk not found");
	}

	// Calculate duration: data size / (sample rate * channels * bytes per sample)
	const bytesPerSample = bitsPerSample / 8;
	const durationSeconds = dataSize / (sampleRate * channels * bytesPerSample);
	const durationMs = Math.round(durationSeconds * 1000);

	return {
		sampleRate,
		channels,
		durationMs,
	};
}

/**
 * Generate speech using ElevenLabs TTS and store in R2
 * Checks if audio already exists before generating to avoid duplicate API calls
 */
export const serverGenerateSpeech = createServerFn({ method: "POST" })
	.inputValidator(GenerateSpeechSchema)
	.handler(
		async ({ data }): Promise<ApiResponse<ReferenceSpeechWithRelations>> => {
			try {
				const { textId, authorId, voiceSettings } = data;

				// Fetch author and text
				const author = await getAuthorById(authorId);
				if (!author) {
					return createErrorResponse(
						ErrorCode.VALIDATION_ERROR,
						"Author not found",
						undefined,
						404,
					);
				}

				if (!author.elevenlabsVoiceId) {
					return createErrorResponse(
						ErrorCode.VALIDATION_ERROR,
						"Author does not have an ElevenLabs voice ID configured",
						undefined,
						400,
					);
				}

				const text = await getPracticeTextById(textId);
				if (!text) {
					return createErrorResponse(
						ErrorCode.VALIDATION_ERROR,
						"Text not found",
						undefined,
						404,
					);
				}

				// Generate deterministic storage key
				const storageKey = `references/${textId}/${authorId}.wav`;

				// Check if reference already exists in R2
				const existsResult = await existsInR2(storageKey);
				if (!existsResult.success) {
					return createErrorResponse(
						ErrorCode.R2_UPLOAD_ERROR,
						"Failed to check if audio exists",
						undefined,
						500,
					);
				}

				let audioBuffer: Buffer;
				let contentType = "audio/wav";
				let sampleRate = 16000;
				let channels = 1;
				let durationMs: number | null = null;
				let fileSizeBytes: number;

				if (existsResult.data) {
					// File exists, retrieve it
					const getResult = await getFromR2(storageKey);
					if (!getResult.success) {
						return createErrorResponse(
							ErrorCode.R2_UPLOAD_ERROR,
							"Failed to retrieve existing audio",
							undefined,
							500,
						);
					}
					audioBuffer = getResult.data.data;
					contentType = getResult.data.contentType;

					// Parse metadata from existing file
					try {
						const metadata = parseWavMetadata(audioBuffer);
						sampleRate = metadata.sampleRate;
						channels = metadata.channels;
						durationMs = metadata.durationMs;
					} catch (error) {
						console.warn("Failed to parse WAV metadata:", error);
					}
				} else {
					// File doesn't exist, generate with ElevenLabs
					const generateResult = await generateSpeech({
						text: text.content,
						voiceId: author.elevenlabsVoiceId,
						voiceSettings,
					});

					if (!generateResult.success) {
						return generateResult;
					}

					audioBuffer = generateResult.data.audio;
					contentType = generateResult.data.contentType;

					// Parse metadata from generated audio
					try {
						// Log buffer info before parsing
						console.log("Parsing WAV metadata in reference.ts:", {
							bufferLength: audioBuffer.length,
							firstBytes: Array.from(audioBuffer.slice(0, 50)).map((b) =>
								b.toString(16).padStart(2, "0"),
							),
							headerAscii: audioBuffer.slice(0, 44).toString("ascii"),
							contentType,
						});

						const metadata = parseWavMetadata(audioBuffer);
						sampleRate = metadata.sampleRate;
						channels = metadata.channels;
						durationMs = metadata.durationMs;

						console.log("Successfully parsed WAV metadata:", metadata);
					} catch (error) {
						console.error("Failed to parse WAV metadata:", error);
						console.error("Buffer details:", {
							length: audioBuffer.length,
							firstBytes: Array.from(audioBuffer.slice(0, 50)).map((b) =>
								b.toString(16).padStart(2, "0"),
							),
							headerAscii: audioBuffer.slice(0, 44).toString("ascii"),
							contentType,
						});
						// Default values for PCM 16kHz
						sampleRate = 16000;
						channels = 1;
					}
				}

				fileSizeBytes = audioBuffer.length;

				// Upload to R2 if it doesn't exist
				if (!existsResult.data) {
					const uploadResult = await uploadToR2(
						audioBuffer,
						storageKey,
						contentType,
					);

					if (!uploadResult.success) {
						return uploadResult;
					}
				}

				// Check if reference speech record already exists
				const existingReferences = await getReferenceSpeechesForText(textId);
				const existingRef = existingReferences.find(
					(r) => r.authorId === authorId && r.storageKey === storageKey,
				);

				let referenceSpeech: ReferenceSpeech;

				if (existingRef) {
					// Update existing record
					referenceSpeech = await updateReferenceSpeech(existingRef.id, {
						durationMs,
						fileSizeBytes,
						sampleRateHz: sampleRate,
						channels,
						bitrateKbps: null, // PCM doesn't have bitrate
					});
				} else {
					// Create new record
					referenceSpeech = await insertReferenceSpeech({
						storageKey,
						authorId,
						textId,
						generationMethod: "tts",
						durationMs,
						fileSizeBytes,
						sampleRateHz: sampleRate,
						channels,
						bitrateKbps: null,
						priority: 0,
					});
				}

				// Return with relations
				const referencesWithRelations =
					await getReferenceSpeechesWithRelations();
				const result = referencesWithRelations.find(
					(r) => r.id === referenceSpeech.id,
				);

				if (!result) {
					return createErrorResponse(
						ErrorCode.DATABASE_ERROR,
						"Failed to fetch created reference speech",
						undefined,
						500,
					);
				}

				return createSuccessResponse(result);
			} catch (error) {
				console.error("Generate speech error:", error);

				if (error instanceof z.ZodError) {
					return createErrorResponse(
						ErrorCode.VALIDATION_ERROR,
						"Invalid input data",
						{ errors: error.issues },
						400,
					);
				}

				return createErrorResponse(
					ErrorCode.DATABASE_ERROR,
					"Failed to generate speech",
					undefined,
					500,
				);
			}
		},
	);

// Helper function for formatting duration
export function formatDuration(ms: number | null): string {
	if (ms === null) return "--:--";
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
