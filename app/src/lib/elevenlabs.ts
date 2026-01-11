import type { ApiResponse } from "./errors";
import {
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

if (!process.env.ELEVENLABS_API_KEY) {
	throw new Error("ELEVENLABS_API_KEY environment variable is not set");
}

const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

/**
 * Convert raw PCM audio data to WAV format by adding headers
 * @param pcmData Raw PCM audio data (16-bit, mono, 16kHz)
 * @param sampleRate Sample rate in Hz (default: 16000)
 * @param channels Number of channels (default: 1)
 * @param bitsPerSample Bits per sample (default: 16)
 * @returns WAV file as Buffer
 */
function pcmToWav(
	pcmData: Buffer,
	sampleRate: number = 16000,
	channels: number = 1,
	bitsPerSample: number = 16,
): Buffer {
	const byteRate = sampleRate * channels * (bitsPerSample / 8);
	const blockAlign = channels * (bitsPerSample / 8);
	const dataSize = pcmData.length;
	// RIFF chunk size = file size - 8 (doesn't include "RIFF" and size fields)
	const riffChunkSize = 36 + dataSize;

	// Create WAV header (44 bytes total)
	const header = Buffer.alloc(44);

	// RIFF header (12 bytes)
	header.write("RIFF", 0, "ascii");
	header.writeUInt32LE(riffChunkSize, 4); // File size - 8
	header.write("WAVE", 8, "ascii");

	// fmt chunk (24 bytes: 8 bytes header + 16 bytes data)
	header.write("fmt ", 12, "ascii");
	header.writeUInt32LE(16, 16); // fmt chunk size (16 for PCM)
	header.writeUInt16LE(1, 20); // audio format (1 = PCM)
	header.writeUInt16LE(channels, 22);
	header.writeUInt32LE(sampleRate, 24);
	header.writeUInt32LE(byteRate, 28);
	header.writeUInt16LE(blockAlign, 32);
	header.writeUInt16LE(bitsPerSample, 34);

	// data chunk header (8 bytes)
	header.write("data", 36, "ascii");
	header.writeUInt32LE(dataSize, 40);

	// Combine header and PCM data
	return Buffer.concat([header, pcmData]);
}

export interface VoiceSettings {
	stability?: number; // 0.0 to 1.0
	similarityBoost?: number; // 0.0 to 1.0
	style?: number; // 0.0 to 1.0
	useSpeakerBoost?: boolean;
}

export interface GenerateSpeechOptions {
	text: string;
	voiceId: string;
	modelId?: string;
	outputFormat?: string;
	voiceSettings?: VoiceSettings;
}

export interface GenerateSpeechResult {
	audio: Buffer;
	contentType: string;
}

/**
 * Generate speech using ElevenLabs TTS API
 * Returns audio as Buffer (WAV format, 16kHz mono for ML compatibility)
 */
export async function generateSpeech(
	options: GenerateSpeechOptions,
): Promise<ApiResponse<GenerateSpeechResult>> {
	try {
		const {
			text,
			voiceId,
			modelId = "eleven_turbo_v2_5",
			outputFormat = "pcm_16000", // PCM 16kHz for ML compatibility
			voiceSettings,
		} = options;

		const url = `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}?output_format=${outputFormat}`;

		const requestBody: {
			text: string;
			model_id: string;
			voice_settings?: {
				stability?: number;
				similarity_boost?: number;
				style?: number;
				use_speaker_boost?: boolean;
			};
		} = {
			text,
			model_id: modelId,
		};

		// Include voice_settings if provided
		// Default values: style 0.5, stability 0.5, similarity boost 0.5, enhance (use_speaker_boost) false
		if (voiceSettings) {
			requestBody.voice_settings = {
				stability: voiceSettings.stability ?? 0.5,
				similarity_boost: voiceSettings.similarityBoost ?? 0.5,
				style: voiceSettings.style ?? 0.5,
				use_speaker_boost: voiceSettings.useSpeakerBoost ?? false,
			};
		}

		const apiKey = process.env.ELEVENLABS_API_KEY;
		if (!apiKey) {
			return createErrorResponse(
				ErrorCode.EXTERNAL_API_ERROR,
				"ELEVENLABS_API_KEY is not configured",
				undefined,
				500,
			);
		}

		const response = await fetch(url, {
			method: "POST",
			headers: {
				"xi-api-key": apiKey,
				"Content-Type": "application/json",
			},
			body: JSON.stringify(requestBody),
		});

		if (!response.ok) {
			const errorText = await response.text().catch(() => "Unknown error");
			console.error("ElevenLabs API error:", response.status, errorText);

			return createErrorResponse(
				ErrorCode.EXTERNAL_API_ERROR,
				`ElevenLabs API error: ${response.status} ${response.statusText}`,
				{ details: errorText },
				response.status,
			);
		}

		const audioArrayBuffer = await response.arrayBuffer();
		let audioBuffer: Buffer = Buffer.from(audioArrayBuffer);

		// Log binary output for debugging
		const responseContentType = response.headers.get("content-type");
		console.log("ElevenLabs response details:", {
			outputFormat,
			bufferLength: audioBuffer.length,
			firstBytes: Array.from(audioBuffer.slice(0, 50)).map((b) =>
				b.toString(16).padStart(2, "0"),
			),
			firstBytesAscii: audioBuffer
				.slice(0, 50)
				.toString("ascii")
				.replace(/[^\x20-\x7E]/g, "."),
			contentType: responseContentType,
			hasRiffHeader: audioBuffer.slice(0, 4).toString("ascii") === "RIFF",
		});

		// Determine content type from output format
		let contentType = "audio/wav";

		// PCM formats return raw PCM data without headers - always convert to WAV
		// Check if it's PCM format OR if the buffer doesn't have a RIFF header
		const isPcmFormat = outputFormat.startsWith("pcm");
		const hasRiffHeader =
			audioBuffer.length >= 4 &&
			audioBuffer.slice(0, 4).toString("ascii") === "RIFF";

		if (isPcmFormat || !hasRiffHeader) {
			// Extract sample rate from format (e.g., "pcm_16000" -> 16000)
			let sampleRate = 16000; // default
			if (isPcmFormat) {
				const sampleRateMatch = outputFormat.match(/pcm_(\d+)/);
				sampleRate = sampleRateMatch
					? Number.parseInt(sampleRateMatch[1], 10)
					: 16000;
			}

			console.log("Converting PCM to WAV:", {
				isPcmFormat,
				hasRiffHeader,
				originalLength: audioBuffer.length,
				sampleRate,
				channels: 1,
				bitsPerSample: 16,
			});

			audioBuffer = pcmToWav(audioBuffer, sampleRate, 1, 16);

			console.log("After WAV conversion:", {
				newLength: audioBuffer.length,
				firstBytes: Array.from(audioBuffer.slice(0, 50)).map((b) =>
					b.toString(16).padStart(2, "0"),
				),
				headerAscii: audioBuffer.slice(0, 44).toString("ascii"),
				hasRiffHeader: audioBuffer.slice(0, 4).toString("ascii") === "RIFF",
			});

			contentType = "audio/wav";
		} else if (outputFormat.startsWith("mp3")) {
			contentType = "audio/mpeg";
		} else if (outputFormat.startsWith("opus")) {
			contentType = "audio/ogg";
		}

		return createSuccessResponse({
			audio: audioBuffer,
			contentType,
		});
	} catch (error) {
		console.error("ElevenLabs generation error:", error);

		if (error instanceof Error) {
			return createErrorResponse(
				ErrorCode.EXTERNAL_API_ERROR,
				"Failed to generate speech with ElevenLabs",
				{ originalError: error.message },
				500,
			);
		}

		return createErrorResponse(
			ErrorCode.EXTERNAL_API_ERROR,
			"Failed to generate speech with ElevenLabs",
			undefined,
			500,
		);
	}
}
