/**
 * IPA (International Phonetic Alphabet) utility functions
 */

/**
 * Format POWSM IPA output for display.
 * Removes slashes and adds spacing between phonemes for readability.
 *
 * @param ipaPhonemes - IPA string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
 * @returns Formatted string with spaces between phonemes (e.g., "h ɛ l o ʊ")
 */
export function formatIpaForDisplay(ipaPhonemes: string): string {
	// Input: "/h//ɛ//l//o//ʊ/"
	// Output: "h ɛ l o ʊ"
	return ipaPhonemes
		.replace(/^\/|\/$/g, "")
		.split("//")
		.filter(Boolean)
		.join(" ");
}

/**
 * Format POWSM IPA output as a clean continuous string without slashes.
 *
 * @param ipaPhonemes - IPA string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
 * @returns Clean string without slashes (e.g., "hɛloʊ")
 */
export function formatIpaClean(ipaPhonemes: string): string {
	return ipaPhonemes
		.replace(/^\/|\/$/g, "")
		.split("//")
		.filter(Boolean)
		.join("");
}

/**
 * Parse IPA string into individual phoneme array.
 *
 * @param ipaPhonemes - IPA string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
 * @returns Array of individual phonemes (e.g., ["h", "ɛ", "l", "o", "ʊ"])
 */
export function parsePhonemes(ipaPhonemes: string): string[] {
	return ipaPhonemes
		.replace(/^\/|\/$/g, "")
		.split("//")
		.filter(Boolean);
}

/**
 * Get display-friendly IPA method name.
 *
 * @param method - IPA method enum value
 * @returns Human-readable method name
 */
export function getIpaMethodLabel(
	method: "powsm" | "cmudict" | null | undefined,
): string {
	switch (method) {
		case "powsm":
			return "POWSM (Audio-guided)";
		case "cmudict":
			return "CMUDict (Dictionary)";
		default:
			return "Unknown";
	}
}

/**
 * Check if an IPA transcription exists and is valid.
 *
 * @param ipaTranscription - The IPA transcription string to check
 * @returns True if the transcription exists and has content
 */
export function hasIpaTranscription(
	ipaTranscription: string | null | undefined,
): boolean {
	return Boolean(ipaTranscription && ipaTranscription.trim().length > 0);
}
