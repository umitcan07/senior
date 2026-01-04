import { createServerFn } from "@tanstack/react-start";
import { generateSpeech } from "./elevenlabs";
import { type ApiResponse, createSuccessResponse } from "./errors";
import { existsInR2, uploadToR2 } from "./r2";

// Brian's ElevenLabs voice ID - clear male British accent
const BRIAN_VOICE_ID = "nPczCjzI2devNBz1zQrb";

// All unique word audio files needed for IPA learning
// Derived from IPA_AUDIO_MAP in learn.tsx
// Using WAV PCM 16kHz format for consistency with reference speeches
const IPA_WORDS: { word: string; key: string }[] = [
	// Vowels (12)
	{ word: "see", key: "ipa/words/see.wav" }, // iː
	{ word: "sit", key: "ipa/words/sit.wav" }, // ɪ
	{ word: "bed", key: "ipa/words/bed.wav" }, // e
	{ word: "cat", key: "ipa/words/cat.wav" }, // æ
	{ word: "father", key: "ipa/words/father.wav" }, // ɑː
	{ word: "hot", key: "ipa/words/hot.wav" }, // ɒ
	{ word: "saw", key: "ipa/words/saw.wav" }, // ɔː
	{ word: "put", key: "ipa/words/put.wav" }, // ʊ
	{ word: "too", key: "ipa/words/too.wav" }, // uː
	{ word: "cup", key: "ipa/words/cup.wav" }, // ʌ
	{ word: "bird", key: "ipa/words/bird.wav" }, // ɜː
	{ word: "about", key: "ipa/words/about.wav" }, // ə
	// Diphthongs (8)
	{ word: "day", key: "ipa/words/day.wav" }, // eɪ
	{ word: "my", key: "ipa/words/my.wav" }, // aɪ
	{ word: "boy", key: "ipa/words/boy.wav" }, // ɔɪ
	{ word: "now", key: "ipa/words/now.wav" }, // aʊ
	{ word: "go", key: "ipa/words/go.wav" }, // əʊ
	{ word: "near", key: "ipa/words/near.wav" }, // ɪə
	{ word: "hair", key: "ipa/words/hair.wav" }, // eə
	{ word: "pure", key: "ipa/words/pure.wav" }, // ʊə
	// Consonants (24) - some have alternate keys for different sounds
	{ word: "pet", key: "ipa/words/pet.wav" }, // p
	{ word: "ten", key: "ipa/words/ten.wav" }, // t
	{ word: "dog", key: "ipa/words/dog.wav" }, // d
	{ word: "cat", key: "ipa/words/cat-k.wav" }, // k (different key than vowel 'cat')
	{ word: "go", key: "ipa/words/go-g.wav" }, // g (different key than diphthong 'go')
	{ word: "fan", key: "ipa/words/fan.wav" }, // f
	{ word: "van", key: "ipa/words/van.wav" }, // v
	{ word: "think", key: "ipa/words/think.wav" }, // θ
	{ word: "this", key: "ipa/words/this.wav" }, // ð
	{ word: "sit", key: "ipa/words/sit-s.wav" }, // s (different key than vowel 'sit')
	{ word: "zoo", key: "ipa/words/zoo.wav" }, // z
	{ word: "ship", key: "ipa/words/ship.wav" }, // ʃ
	{ word: "measure", key: "ipa/words/measure.wav" }, // ʒ
	{ word: "hat", key: "ipa/words/hat.wav" }, // h
	{ word: "church", key: "ipa/words/church.wav" }, // tʃ
	{ word: "judge", key: "ipa/words/judge.wav" }, // dʒ
	{ word: "man", key: "ipa/words/man.wav" }, // m
	{ word: "no", key: "ipa/words/no.wav" }, // n
	{ word: "sing", key: "ipa/words/sing.wav" }, // ŋ
	{ word: "let", key: "ipa/words/let.wav" }, // l
	{ word: "red", key: "ipa/words/red.wav" }, // r
	{ word: "yes", key: "ipa/words/yes.wav" }, // j
	{ word: "wet", key: "ipa/words/wet.wav" }, // w
];

export interface GenerateIPAAudioResult {
	generated: string[];
	skipped: string[];
	failed: string[];
}

/**
 * Generate IPA word audio files using ElevenLabs and upload to R2
 * Skips files that already exist in R2
 */
export const serverGenerateIPAAudio = createServerFn({
	method: "POST",
}).handler(async (): Promise<ApiResponse<GenerateIPAAudioResult>> => {
	const generated: string[] = [];
	const skipped: string[] = [];
	const failed: string[] = [];

	for (const { word, key } of IPA_WORDS) {
		try {
			// Check if file already exists
			const existsResult = await existsInR2(key);
			if (existsResult.success && existsResult.data) {
				skipped.push(key);
				console.log(`Skipped (exists): ${key}`);
				continue;
			}

			// Generate speech (PCM 16kHz, converted to WAV by generateSpeech)
			const speechResult = await generateSpeech({
				text: word,
				voiceId: BRIAN_VOICE_ID,
				modelId: "eleven_turbo_v2_5",
				outputFormat: "pcm_16000",
			});

			if (!speechResult.success) {
				console.error(
					`Failed to generate speech for "${word}":`,
					speechResult.error,
				);
				failed.push(key);
				continue;
			}

			// Upload to R2
			const uploadResult = await uploadToR2(
				speechResult.data.audio,
				key,
				"audio/wav",
			);

			if (!uploadResult.success) {
				console.error(`Failed to upload "${key}":`, uploadResult.error);
				failed.push(key);
				continue;
			}

			generated.push(key);
			console.log(`Generated: ${key}`);

			// Small delay to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 200));
		} catch (error) {
			console.error(`Error processing "${word}":`, error);
			failed.push(key);
		}
	}

	return createSuccessResponse({
		generated,
		skipped,
		failed,
	});
});

/**
 * Get the status of IPA audio files in R2
 */
export const serverGetIPAAudioStatus = createServerFn({
	method: "GET",
}).handler(
	async (): Promise<
		ApiResponse<{ existing: string[]; missing: string[]; total: number }>
	> => {
		const existing: string[] = [];
		const missing: string[] = [];

		for (const { key } of IPA_WORDS) {
			try {
				const existsResult = await existsInR2(key);
				if (existsResult.success && existsResult.data) {
					existing.push(key);
				} else {
					missing.push(key);
				}
			} catch {
				missing.push(key);
			}
		}

		return createSuccessResponse({
			existing,
			missing,
			total: IPA_WORDS.length,
		});
	},
);
