import {
	boolean,
	decimal,
	index,
	integer,
	jsonb,
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
// Reference dialect. Values match data/authors.json + mod/dev/verify.py (genam/rp),
// not the us/uk in the original #23 brief. The E7 selector (#36) renders US/UK labels
// but filters on these values.
export const dialectEnum = pgEnum("dialect", ["genam", "rp"]);
export const recordingMethodEnum = pgEnum("recording_method", [
	"upload",
	"record",
]);
export const qualityStatusEnum = pgEnum("quality_status", [
	"accept",
	"warning",
	"reject",
]);
// `mfa` and `wav2textgrid` are V1-only, kept for historical rows. V2 writes
// `powsm_ctc` (added in E1 / #13). See doc/db.md.
export const alignmentMethodEnum = pgEnum("alignment_method", [
	"mfa",
	"wav2textgrid",
	"powsm_ctc",
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
export const analysisStatusEnum = pgEnum("analysis_status", [
	"pending",
	"processing",
	"completed",
	"failed",
]);
export const jobStatusEnum = pgEnum("job_status", [
	"in_queue",
	"in_progress",
	"completed",
	"failed",
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
 * Authors/voices for reference speeches (native speakers)
 */
export const authors = pgTable("authors", {
	id: uuid("id").primaryKey().defaultRandom(),
	// Stable external key from data/authors.json (e.g. "genam_jordan"). Nullable
	// so pre-existing V1 author rows (no slug) are unaffected; unique so ingest can
	// upsert idempotently on it.
	slug: varchar("slug", { length: 100 }).unique(),
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
		// Nullable so V1 TTS rows (no dialect) stay valid.
		dialect: dialectEnum("dialect"),
		ipaTranscription: text("ipa_transcription"),
		ipaMethod: ipaMethodEnum("ipa_method"),
		// Cached POWSMAligner free_alignment output: array of
		// { token, start_ms, end_ms, confidence }. Read by the assess path so it
		// doesn't recompute reference alignment on every call.
		phoneTimingsJson:
			jsonb("phone_timings_json").$type<
				Array<{
					token: string;
					start_ms: number;
					end_ms: number;
					confidence: number;
				}>
			>(),
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
		index("idx_reference_speeches_dialect").on(table.dialect),
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
		jobId: varchar("job_id", { length: 255 }),
		status: analysisStatusEnum("status").default("pending").notNull(),
		// Non-null when the worker abstained from scoring (E3.3 / #20): one of
		// no_speech | low_audio_quality | duration_out_of_range | wrong_sentence |
		// uncertain. Score columns are left NULL in this case; the UI shows a
		// banner (#38). status stays "completed".
		abstentionReason: text("abstention_reason"),
		// Recognized (user) phone timeline from POWSM free alignment: per-phone
		// { token, start_ms, end_ms, gop_score, uncertain }. Mirrors
		// reference_speeches.phone_timings_json; drives the per-phone overlay +
		// live readout on the "Your Recording" waveform.
		recognizedPhoneTimingsJson: jsonb("recognized_phone_timings_json").$type<
			Array<{
				token: string;
				start_ms: number;
				end_ms: number;
				gop_score: number | null;
				uncertain: boolean | null;
			}>
		>(),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_analyses_user_recording_id").on(table.userRecordingId),
		index("idx_analyses_job_id").on(table.jobId),
		index("idx_analyses_created_at").on(table.createdAt),
	],
);

/**
 * Alignment data storage (V1; alignment via the alignment_method enum)
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
		// Legacy V1 columns (added in 0009_chief_tiger_shark). Unused by current
		// code but present in the live DB; kept here so schema.ts matches the
		// database and a `db:push` doesn't drop them.
		targetPosition: integer("target_position"),
		actualPosition: integer("actual_position"),
		expected: varchar("expected", { length: 10 }),
		actual: varchar("actual", { length: 10 }),
		timestampStartMs: integer("timestamp_start_ms"),
		timestampEndMs: integer("timestamp_end_ms"),
		// Per-phone Goodness-of-Pronunciation from POWSM CTC (E2.3 / #16):
		// gopScore = mean logP(target) − mean best-competitor logP (can be
		// negative); entropy in nats; uncertain = entropy over threshold.
		gopScore: decimal("gop_score", { precision: 6, scale: 3 }),
		entropy: decimal("entropy", { precision: 6, scale: 3 }),
		uncertain: boolean("uncertain").default(false),
		// Articulatory feature distance (0–2, = 2·Δfeatures/24) for the app-side
		// severity/hint layer (E7.6 / #57). Substitutions only; null otherwise.
		featureDistance: decimal("feature_distance", { precision: 6, scale: 3 }),
		// The specific articulatory features that differ on a substitution (PanPhon
		// name + ternary ref/user values), e.g. [{feature:"voi",ref:"-",user:"+"}].
		// Drives place/voicing/manner hints + a future LLM coaching pass (E7.6 / #57).
		featureDelta:
			jsonb("feature_delta").$type<
				Array<{ feature: string; ref: string; user: string }>
			>(),
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
		// Legacy V1 columns (added in 0009_chief_tiger_shark). Unused by current
		// code but present in the live DB; kept here so schema.ts matches the
		// database and a `db:push` doesn't drop them.
		targetPosition: integer("target_position"),
		actualPosition: integer("actual_position"),
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

/**
 * RunPod job tracking for testing the simulation flow
 */
export const jobs = pgTable(
	"jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		externalJobId: varchar("external_job_id", { length: 255 })
			.notNull()
			.unique(),
		status: jobStatusEnum("status").default("in_queue").notNull(),
		result: jsonb("result"),
		error: text("error"),
		executionTimeMs: integer("execution_time_ms"),
		delayTimeMs: integer("delay_time_ms"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_jobs_external_job_id").on(table.externalJobId),
		index("idx_jobs_status").on(table.status),
		index("idx_jobs_created_at").on(table.createdAt),
	],
);

/**
 * IPA generation job tracking for reference speeches
 */
export const ipaGenerationJobs = pgTable(
	"ipa_generation_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		referenceSpeechId: uuid("reference_speech_id")
			.notNull()
			.references(() => referenceSpeeches.id, { onDelete: "cascade" }),
		externalJobId: varchar("external_job_id", { length: 255 })
			.notNull()
			.unique(),
		status: jobStatusEnum("status").default("in_queue").notNull(),
		result: jsonb("result"),
		error: text("error"),
		executionTimeMs: integer("execution_time_ms"),
		delayTimeMs: integer("delay_time_ms"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_ipa_generation_jobs_reference_speech_id").on(
			table.referenceSpeechId,
		),
		index("idx_ipa_generation_jobs_external_job_id").on(table.externalJobId),
		index("idx_ipa_generation_jobs_status").on(table.status),
	],
);

/**
 * Assessment job tracking for user recordings
 */
export const assessmentJobs = pgTable(
	"assessment_jobs",
	{
		id: uuid("id").primaryKey().defaultRandom(),
		analysisId: uuid("analysis_id")
			.notNull()
			.references(() => analyses.id, { onDelete: "cascade" }),
		externalJobId: varchar("external_job_id", { length: 255 })
			.notNull()
			.unique(),
		status: jobStatusEnum("status").default("in_queue").notNull(),
		result: jsonb("result"),
		error: text("error"),
		executionTimeMs: integer("execution_time_ms"),
		delayTimeMs: integer("delay_time_ms"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at").defaultNow().notNull(),
	},
	(table) => [
		index("idx_assessment_jobs_analysis_id").on(table.analysisId),
		index("idx_assessment_jobs_external_job_id").on(table.externalJobId),
		index("idx_assessment_jobs_status").on(table.status),
	],
);
