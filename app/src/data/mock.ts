/**
 * Mock data for development and demonstration
 * This file contains all mock data used when database connections aren't available
 *
 * NOTE: In production, replace these with actual database queries.
 * These mocks simulate the expected data shapes from the database schema.
 */

import type {
	Analysis,
	Author,
	PhonemeError,
	PracticeText,
	ReferenceSpeech,
	UserRecording,
	WordError,
} from "@/db/types";

// ============================================================================
// CUSTOM TYPES (UI/derived types not in DB schema)
// ============================================================================

export interface Attempt {
	id: string;
	textId: string;
	textPreview: string;
	score: number;
	date: Date;
	analysisId: string;
}

export interface UserStats {
	totalAttempts: number;
	weeklyAttempts: number;
	averageScore: number;
	weeklyProgress: number;
}

export interface CommonError {
	phoneme: string;
	count: number;
}

// Re-export DB types for convenience
export type {
	Analysis,
	Author,
	PhonemeError,
	PracticeText,
	ReferenceSpeech,
	UserRecording,
	WordError,
};

// ============================================================================
// MOCK AUTHORS
// ============================================================================

export const MOCK_AUTHORS: Author[] = [
	{
		id: "author-1",
		name: "Amy",
		accent: "US",
		style: "Neutral",
		languageCode: "en-US",
		createdAt: new Date("2024-01-01"),
		updatedAt: new Date("2024-01-01"),
	},
	{
		id: "author-2",
		name: "John",
		accent: "UK",
		style: "Formal",
		languageCode: "en-GB",
		createdAt: new Date("2024-01-02"),
		updatedAt: new Date("2024-01-02"),
	},
	{
		id: "author-3",
		name: "Sarah",
		accent: "US",
		style: "Casual",
		languageCode: "en-US",
		createdAt: new Date("2024-01-03"),
		updatedAt: new Date("2024-01-03"),
	},
	{
		id: "author-4",
		name: "David",
		accent: "AU",
		style: "Neutral",
		languageCode: "en-AU",
		createdAt: new Date("2024-01-04"),
		updatedAt: new Date("2024-01-04"),
	},
	{
		id: "author-5",
		name: "Emma",
		accent: "UK",
		style: "Formal",
		languageCode: "en-GB",
		createdAt: new Date("2024-01-05"),
		updatedAt: new Date("2024-01-05"),
	},
];

// ============================================================================
// MOCK PRACTICE TEXTS
// ============================================================================

export const MOCK_TEXTS: PracticeText[] = [
	{
		id: "text-1",
		content:
			"The quick brown fox jumps over the lazy dog. This pangram contains every letter of the English alphabet at least once.",
		createdAt: new Date("2024-06-01"),
		updatedAt: new Date("2024-06-01"),
	},
	{
		id: "text-2",
		content:
			"She sells seashells by the seashore. The shells she sells are seashells, I'm sure. So if she sells shells on the seashore, I'm sure she sells seashore shells.",
		createdAt: new Date("2024-06-02"),
		updatedAt: new Date("2024-06-02"),
	},
	{
		id: "text-3",
		content:
			"Peter Piper picked a peck of pickled peppers. A peck of pickled peppers Peter Piper picked. If Peter Piper picked a peck of pickled peppers, where's the peck of pickled peppers Peter Piper picked?",
		createdAt: new Date("2024-06-03"),
		updatedAt: new Date("2024-06-03"),
	},
	{
		id: "text-4",
		content:
			"How much wood would a woodchuck chuck if a woodchuck could chuck wood? He would chuck, he would, as much as he could, and chuck as much wood as a woodchuck would if a woodchuck could chuck wood.",
		createdAt: new Date("2024-06-04"),
		updatedAt: new Date("2024-06-04"),
	},
	{
		id: "text-5",
		content:
			"Whether the weather is cold, or whether the weather is hot, we'll weather the weather, whatever the weather, whether we like it or not.",
		createdAt: new Date("2024-06-05"),
		updatedAt: new Date("2024-06-05"),
	},
	{
		id: "text-6",
		content:
			"I thought I thought of thinking of thanking you. But the thought I thought wasn't the thought I thought I thought.",
		createdAt: new Date("2024-06-06"),
		updatedAt: new Date("2024-06-06"),
	},
];

// ============================================================================
// MOCK REFERENCE SPEECHES
// ============================================================================

export const MOCK_REFERENCES: ReferenceSpeech[] = [
	{
		id: "ref-1",
		storageKey: "references/text-1/author-1.wav",
		authorId: "author-1",
		textId: "text-1",
		generationMethod: "tts",
		ipaTranscription: null,
		ipaMethod: null,
		priority: 1,
		durationMs: 4200,
		fileSizeBytes: 168000,
		sampleRateHz: 44100,
		channels: 1,
		bitrateKbps: 320,
		createdAt: new Date("2024-06-01"),
		updatedAt: new Date("2024-06-01"),
	},
	{
		id: "ref-2",
		storageKey: "references/text-1/author-2.wav",
		authorId: "author-2",
		textId: "text-1",
		generationMethod: "native",
		ipaTranscription: null,
		ipaMethod: null,
		priority: 2,
		durationMs: 4800,
		fileSizeBytes: 192000,
		sampleRateHz: 44100,
		channels: 1,
		bitrateKbps: 320,
		createdAt: new Date("2024-06-01"),
		updatedAt: new Date("2024-06-01"),
	},
	{
		id: "ref-3",
		storageKey: "references/text-2/author-1.wav",
		authorId: "author-1",
		textId: "text-2",
		generationMethod: "tts",
		ipaTranscription: null,
		ipaMethod: null,
		priority: 1,
		durationMs: 8500,
		fileSizeBytes: 340000,
		sampleRateHz: 44100,
		channels: 1,
		bitrateKbps: 320,
		createdAt: new Date("2024-06-02"),
		updatedAt: new Date("2024-06-02"),
	},
	{
		id: "ref-4",
		storageKey: "references/text-3/author-3.wav",
		authorId: "author-3",
		textId: "text-3",
		generationMethod: "tts",
		ipaTranscription: null,
		ipaMethod: null,
		priority: 1,
		durationMs: 9200,
		fileSizeBytes: 368000,
		sampleRateHz: 44100,
		channels: 1,
		bitrateKbps: 320,
		createdAt: new Date("2024-06-03"),
		updatedAt: new Date("2024-06-03"),
	},
];

// ============================================================================
// MOCK ANALYSES & ATTEMPTS
// ============================================================================

export const MOCK_ANALYSES: Analysis[] = [
	{
		id: "analysis-1",
		userRecordingId: "recording-1",
		referenceSpeechId: "ref-1",
		processingDurationMs: 2340,
		overallScore: "0.8500",
		confidence: "0.9200",
		targetPhonemes: "ðə kwɪk braʊn fɑks",
		recognizedPhonemes: "ðə kwɪk braʊn bɑks",
		phonemeDistance: 2,
		phonemeScore: "0.8200",
		targetWords: "The quick brown fox",
		recognizedWords: "The quick brown box",
		wordDistance: 1,
		wordScore: "0.8800",
		createdAt: new Date("2024-12-15T10:30:00"),
	},
	{
		id: "analysis-2",
		userRecordingId: "recording-2",
		referenceSpeechId: "ref-3",
		processingDurationMs: 3150,
		overallScore: "0.7200",
		confidence: "0.8800",
		targetPhonemes: "ʃi sɛlz siʃɛlz",
		recognizedPhonemes: "ʃi sɛlz sisɛlz",
		phonemeDistance: 4,
		phonemeScore: "0.6800",
		targetWords: "She sells seashells",
		recognizedWords: "She sells sea sells",
		wordDistance: 2,
		wordScore: "0.7500",
		createdAt: new Date("2024-12-14T15:45:00"),
	},
	{
		id: "analysis-3",
		userRecordingId: "recording-3",
		referenceSpeechId: "ref-1",
		processingDurationMs: 2100,
		overallScore: "0.9100",
		confidence: "0.9500",
		targetPhonemes: "ðə kwɪk braʊn fɑks",
		recognizedPhonemes: "ðə kwɪk braʊn fɑks",
		phonemeDistance: 0,
		phonemeScore: "0.9500",
		targetWords: "The quick brown fox",
		recognizedWords: "The quick brown fox",
		wordDistance: 0,
		wordScore: "0.9200",
		createdAt: new Date("2024-12-13T09:15:00"),
	},
	{
		id: "analysis-4",
		userRecordingId: "recording-4",
		referenceSpeechId: "ref-4",
		processingDurationMs: 2800,
		overallScore: "0.6500",
		confidence: "0.8500",
		targetPhonemes: "pitər paɪpər",
		recognizedPhonemes: "pidər paɪpər",
		phonemeDistance: 3,
		phonemeScore: "0.6200",
		targetWords: "Peter Piper",
		recognizedWords: "Peder Piper",
		wordDistance: 1,
		wordScore: "0.6800",
		createdAt: new Date("2024-12-12T14:20:00"),
	},
	{
		id: "analysis-5",
		userRecordingId: "recording-5",
		referenceSpeechId: "ref-2",
		processingDurationMs: 2500,
		overallScore: "0.7800",
		confidence: "0.9000",
		targetPhonemes: "ðə kwɪk braʊn fɑks",
		recognizedPhonemes: "ðə kwɪk braʊn fɑks",
		phonemeDistance: 1,
		phonemeScore: "0.8000",
		targetWords: "The quick brown fox",
		recognizedWords: "The quick brown fox",
		wordDistance: 0,
		wordScore: "0.8200",
		createdAt: new Date("2024-12-11T11:00:00"),
	},
];

export const MOCK_PHONEME_ERRORS: PhonemeError[] = [
	{
		id: "perror-1",
		analysisId: "analysis-1",
		errorType: "substitute",
		position: 14,
		expected: "f",
		actual: "b",
		timestampStartMs: 2100,
		timestampEndMs: 2300,
		createdAt: new Date("2024-12-15T10:30:00"),
	},
	{
		id: "perror-2",
		analysisId: "analysis-2",
		errorType: "substitute",
		position: 8,
		expected: "ʃ",
		actual: "s",
		timestampStartMs: 1500,
		timestampEndMs: 1700,
		createdAt: new Date("2024-12-14T15:45:00"),
	},
	{
		id: "perror-3",
		analysisId: "analysis-2",
		errorType: "delete",
		position: 12,
		expected: "ɛ",
		actual: null,
		timestampStartMs: 2000,
		timestampEndMs: 2100,
		createdAt: new Date("2024-12-14T15:45:00"),
	},
	{
		id: "perror-4",
		analysisId: "analysis-4",
		errorType: "substitute",
		position: 2,
		expected: "t",
		actual: "d",
		timestampStartMs: 400,
		timestampEndMs: 500,
		createdAt: new Date("2024-12-12T14:20:00"),
	},
];

export const MOCK_WORD_ERRORS: WordError[] = [
	{
		id: "werror-1",
		analysisId: "analysis-1",
		errorType: "substitute",
		position: 3,
		expected: "fox",
		actual: "box",
		createdAt: new Date("2024-12-15T10:30:00"),
	},
	{
		id: "werror-2",
		analysisId: "analysis-2",
		errorType: "substitute",
		position: 2,
		expected: "seashells",
		actual: "sea sells",
		createdAt: new Date("2024-12-14T15:45:00"),
	},
	{
		id: "werror-3",
		analysisId: "analysis-4",
		errorType: "substitute",
		position: 0,
		expected: "Peter",
		actual: "Peder",
		createdAt: new Date("2024-12-12T14:20:00"),
	},
];

// ============================================================================
// MOCK ATTEMPTS (combines recording, analysis, and text data)
// ============================================================================

export const MOCK_ATTEMPTS: Attempt[] = [
	{
		id: "attempt-1",
		textId: "text-1",
		textPreview: "The quick brown fox jumps over the lazy dog...",
		score: 85,
		date: new Date("2024-12-15T10:30:00"),
		analysisId: "analysis-1",
	},
	{
		id: "attempt-2",
		textId: "text-2",
		textPreview: "She sells seashells by the seashore...",
		score: 72,
		date: new Date("2024-12-14T15:45:00"),
		analysisId: "analysis-2",
	},
	{
		id: "attempt-3",
		textId: "text-1",
		textPreview: "The quick brown fox jumps over the lazy dog...",
		score: 91,
		date: new Date("2024-12-13T09:15:00"),
		analysisId: "analysis-3",
	},
	{
		id: "attempt-4",
		textId: "text-3",
		textPreview: "Peter Piper picked a peck of pickled peppers...",
		score: 65,
		date: new Date("2024-12-12T14:20:00"),
		analysisId: "analysis-4",
	},
	{
		id: "attempt-5",
		textId: "text-1",
		textPreview: "The quick brown fox jumps over the lazy dog...",
		score: 78,
		date: new Date("2024-12-11T11:00:00"),
		analysisId: "analysis-5",
	},
	{
		id: "attempt-6",
		textId: "text-4",
		textPreview: "How much wood would a woodchuck chuck...",
		score: 82,
		date: new Date("2024-12-10T16:30:00"),
		analysisId: "analysis-6",
	},
	{
		id: "attempt-7",
		textId: "text-5",
		textPreview: "Whether the weather is cold, or whether...",
		score: 68,
		date: new Date("2024-12-09T12:00:00"),
		analysisId: "analysis-7",
	},
	{
		id: "attempt-8",
		textId: "text-2",
		textPreview: "She sells seashells by the seashore...",
		score: 79,
		date: new Date("2024-12-08T14:15:00"),
		analysisId: "analysis-8",
	},
];

// ============================================================================
// MOCK USER STATS
// ============================================================================

export const MOCK_USER_STATS: UserStats = {
	totalAttempts: 47,
	weeklyAttempts: 12,
	averageScore: 76,
	weeklyProgress: 8,
};

// ============================================================================
// MOCK COMMON ERRORS
// ============================================================================

export const MOCK_COMMON_ERRORS: CommonError[] = [
	{ phoneme: "/θ/", count: 23 },
	{ phoneme: "/ð/", count: 18 },
	{ phoneme: "/ʃ/", count: 15 },
	{ phoneme: "/r/", count: 12 },
	{ phoneme: "/l/", count: 9 },
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get references for a specific text
 */
export function getReferencesForText(
	textId: string,
): (ReferenceSpeech & { author: Author })[] {
	return MOCK_REFERENCES.filter((ref) => ref.textId === textId).map((ref) => ({
		...ref,
		author: MOCK_AUTHORS.find((a) => a.id === ref.authorId)!,
	}));
}

/**
 * Get text with reference count
 */
export function getTextsWithReferenceCounts(): (PracticeText & {
	referenceCount: number;
	wordCount: number;
})[] {
	return MOCK_TEXTS.map((text) => ({
		...text,
		referenceCount: MOCK_REFERENCES.filter((ref) => ref.textId === text.id)
			.length,
		wordCount: text.content.split(/\s+/).length,
	}));
}

/**
 * Get analysis by ID with all related data
 */
export function getAnalysisById(analysisId: string) {
	const analysis = MOCK_ANALYSES.find((a) => a.id === analysisId);
	if (!analysis) return null;

	const reference = MOCK_REFERENCES.find(
		(r) => r.id === analysis.referenceSpeechId,
	);
	const text = reference
		? MOCK_TEXTS.find((t) => t.id === reference.textId)
		: null;
	const author = reference
		? MOCK_AUTHORS.find((a) => a.id === reference.authorId)
		: null;
	const phonemeErrors = MOCK_PHONEME_ERRORS.filter(
		(e) => e.analysisId === analysisId,
	);
	const wordErrors = MOCK_WORD_ERRORS.filter(
		(e) => e.analysisId === analysisId,
	);

	return {
		analysis,
		reference,
		text,
		author,
		phonemeErrors,
		wordErrors,
	};
}

/**
 * Get recent attempts for a text
 */
export function getRecentAttemptsForText(textId: string, limit = 3): Attempt[] {
	return MOCK_ATTEMPTS.filter((a) => a.textId === textId)
		.sort((a, b) => b.date.getTime() - a.date.getTime())
		.slice(0, limit);
}

/**
 * Get author reference count
 */
export function getAuthorWithReferenceCount(
	authorId: string,
): Author & { referenceCount: number } {
	const author = MOCK_AUTHORS.find((a) => a.id === authorId);
	if (!author) throw new Error(`Author ${authorId} not found`);

	return {
		...author,
		referenceCount: MOCK_REFERENCES.filter((r) => r.authorId === authorId)
			.length,
	};
}

/**
 * Get all authors with reference counts
 */
export function getAuthorsWithReferenceCounts(): (Author & {
	referenceCount: number;
})[] {
	return MOCK_AUTHORS.map((author) => ({
		...author,
		referenceCount: MOCK_REFERENCES.filter((r) => r.authorId === author.id)
			.length,
	}));
}

/**
 * Format duration in milliseconds to MM:SS
 */
export function formatDuration(ms: number | null): string {
	if (ms === null) return "--:--";
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

/**
 * Format relative time (e.g., "2h ago", "1d ago")
 */
export function formatRelativeTime(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSeconds = Math.floor(diffMs / 1000);
	const diffMinutes = Math.floor(diffSeconds / 60);
	const diffHours = Math.floor(diffMinutes / 60);
	const diffDays = Math.floor(diffHours / 24);

	if (diffDays > 0) return `${diffDays}d ago`;
	if (diffHours > 0) return `${diffHours}h ago`;
	if (diffMinutes > 0) return `${diffMinutes}m ago`;
	return "just now";
}

/**
 * Get score color based on value
 */
export function getScoreColor(score: number): string {
	if (score >= 75) return "text-green-600 dark:text-green-400";
	if (score >= 50) return "text-yellow-600 dark:text-yellow-400";
	return "text-red-600 dark:text-red-400";
}

/**
 * Get score background color based on value
 */
export function getScoreBgColor(score: number): string {
	if (score >= 75) return "bg-green-100 dark:bg-green-900/30";
	if (score >= 50) return "bg-yellow-100 dark:bg-yellow-900/30";
	return "bg-red-100 dark:bg-red-900/30";
}
