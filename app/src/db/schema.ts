import {
	decimal,
	index,
	integer,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
	uuid,
	varchar,
} from "drizzle-orm/pg-core";

// ENUMS

export const generationMethodEnum = pgEnum("generation_method", [
	"tts",
	"native",
]);
export const ipaMethodEnum = pgEnum("ipa_method", ["powsm", "cmudict"]);
export const recordingMethodEnum = pgEnum("recording_method", [
	"upload",
	"record",
]);
export const qualityStatusEnum = pgEnum("quality_status", [
	"accept",
	"warning",
	"reject",
]);
export const alignmentMethodEnum = pgEnum("alignment_method", [
	"mfa",
	"wav2textgrid",
]);
export const errorTypeEnum = pgEnum("error_type", [
	"substitute",
	"insert",
	"delete",
]);
export const textDifficultyEnum = pgEnum("text_difficulty", [
	"beginner",
	"intermediate",
	"advanced",
]);
export const textTypeEnum = pgEnum("text_type", [
	"daily",
	"professional",
	"academic",
	"phonetic_challenge",
	"common_phrase",
]);

// TABLES

/**
 * Texts for pronunciation practice
 */
export const practiceTexts = pgTable(
	"practice_texts",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		content: text("content").notNull(),
		difficulty: textDifficultyEnum("difficulty").notNull(),
		wordCount: integer("word_count").notNull(),
		type: textTypeEnum("type").notNull(),
		note: text("note"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_practice_texts_difficulty").on(table.difficulty),
		index("idx_practice_texts_type").on(table.type),
		index("idx_practice_texts_difficulty_type").on(
			table.difficulty,
			table.type,
		),
	],
);

/**
 * Authors/voices for reference speeches (TTS or native speakers)
 */
export const authors = pgTable("authors", {
	id: uuid("id").primaryKey().defaultRandom(),
	name: varchar("name", { length: 255 }).notNull(),
	accent: varchar("accent", { length: 50 }),
	style: varchar("style", { length: 50 }),
	languageCode: varchar("language_code", { length: 10 }),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Reference audio recordings (target pronunciations)
 */
export const referenceSpeeches = pgTable(
	"reference_speeches",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		storageKey: varchar("storage_key", { length: 500 }).notNull(),
		authorId: uuid("author_id")
			.notNull()
			.references(() => authors.id),
		textId: uuid("text_id")
			.notNull()
			.references(() => practiceTexts.id),
		generationMethod: generationMethodEnum("generation_method").notNull(),
		ipaTranscription: text("ipa_transcription"),
		ipaMethod: ipaMethodEnum("ipa_method"),
		priority: integer("priority").default(0),
		durationMs: integer("duration_ms"),
		fileSizeBytes: integer("file_size_bytes"),
		sampleRateHz: integer("sample_rate_hz"),
		channels: smallint("channels"),
		bitrateKbps: integer("bitrate_kbps"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_reference_speeches_author_id").on(table.authorId),
		index("idx_reference_speeches_text_id").on(table.textId),
	],
);

/**
 * User-submitted audio recordings
 */
export const userRecordings = pgTable(
	"user_recordings",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 255 }).notNull(),
		storageKey: varchar("storage_key", { length: 500 }).notNull(),
		recordingMethod: recordingMethodEnum("recording_method").notNull(),
		referenceSpeechId: uuid("reference_speech_id")
			.notNull()
			.references(() => referenceSpeeches.id),
		durationMs: integer("duration_ms"),
		fileSizeBytes: integer("file_size_bytes"),
		sampleRateHz: integer("sample_rate_hz"),
		channels: smallint("channels"),
		bitrateKbps: integer("bitrate_kbps"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_user_recordings_user_id").on(table.userId),
		index("idx_user_recordings_reference_speech_id").on(
			table.referenceSpeechId,
		),
		index("idx_user_recordings_created_at").on(table.createdAt),
	],
);

/**
 * Audio quality metrics for user recordings
 */
export const audioQualityMetrics = pgTable(
	"audio_quality_metrics",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userRecordingId: uuid("user_recording_id")
			.notNull()
			.references(() => userRecordings.id, { onDelete: "cascade" }),
		snrDb: decimal("snr_db", { precision: 5, scale: 2 }),
		noiseRatio: decimal("noise_ratio", { precision: 5, scale: 4 }),
		silenceRatio: decimal("silence_ratio", { precision: 5, scale: 4 }),
		clippingRatio: decimal("clipping_ratio", { precision: 5, scale: 4 }),
		qualityStatus: qualityStatusEnum("quality_status").notNull(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_audio_quality_metrics_user_recording_id").on(
			table.userRecordingId,
		),
	],
);

/**
 * Pronunciation analysis results
 */
export const analyses = pgTable(
	"analyses",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userRecordingId: uuid("user_recording_id")
			.notNull()
			.references(() => userRecordings.id, { onDelete: "cascade" }),
		referenceSpeechId: uuid("reference_speech_id")
			.notNull()
			.references(() => referenceSpeeches.id),
		processingDurationMs: integer("processing_duration_ms"),
		overallScore: decimal("overall_score", { precision: 5, scale: 4 }),
		confidence: decimal("confidence", { precision: 5, scale: 4 }),
		targetPhonemes: text("target_phonemes"),
		recognizedPhonemes: text("recognized_phonemes"),
		phonemeDistance: integer("phoneme_distance"),
		phonemeScore: decimal("phoneme_score", { precision: 5, scale: 4 }),
		targetWords: text("target_words"),
		recognizedWords: text("recognized_words"),
		wordDistance: integer("word_distance"),
		wordScore: decimal("word_score", { precision: 5, scale: 4 }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_analyses_user_recording_id").on(table.userRecordingId),
		index("idx_analyses_created_at").on(table.createdAt),
	],
);

/**
 * Alignment data storage (TextGrid files)
 */
export const alignments = pgTable("alignments", {
	id: uuid("id").primaryKey().defaultRandom(),
	analysisId: uuid("analysis_id")
		.notNull()
		.references(() => analyses.id, { onDelete: "cascade" }),
	storageKey: varchar("storage_key", { length: 500 }).notNull(),
	alignmentMethod: alignmentMethodEnum("alignment_method").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

/**
 * User preferences (e.g., preferred voice/author)
 */
export const userPreferences = pgTable(
	"user_preferences",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		userId: varchar("user_id", { length: 255 }).notNull().unique(),
		preferredAuthorId: uuid("preferred_author_id").references(() => authors.id),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [index("idx_user_preferences_user_id").on(table.userId)],
);

/**
 * Phoneme-level pronunciation errors (normalized for aggregation)
 */
export const phonemeErrors = pgTable(
	"phoneme_errors",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		analysisId: uuid("analysis_id")
			.notNull()
			.references(() => analyses.id, { onDelete: "cascade" }),
		errorType: errorTypeEnum("error_type").notNull(),
		position: integer("position").notNull(),
		expected: varchar("expected", { length: 10 }),
		actual: varchar("actual", { length: 10 }),
		timestampStartMs: integer("timestamp_start_ms"),
		timestampEndMs: integer("timestamp_end_ms"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_phoneme_errors_analysis_id").on(table.analysisId),
		index("idx_phoneme_errors_type").on(table.errorType),
		index("idx_phoneme_errors_expected").on(table.expected),
		index("idx_phoneme_errors_actual").on(table.actual),
	],
);

/**
 * Word-level pronunciation errors (normalized for aggregation)
 */
export const wordErrors = pgTable(
	"word_errors",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		analysisId: uuid("analysis_id")
			.notNull()
			.references(() => analyses.id, { onDelete: "cascade" }),
		errorType: errorTypeEnum("error_type").notNull(),
		position: integer("position").notNull(),
		expected: varchar("expected", { length: 100 }),
		actual: varchar("actual", { length: 100 }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_word_errors_analysis_id").on(table.analysisId),
		index("idx_word_errors_type").on(table.errorType),
		index("idx_word_errors_expected").on(table.expected),
		index("idx_word_errors_actual").on(table.actual),
	],
);
