import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import type { Database, Schema } from "./index.ts";
import type * as schema from "./schema.ts";

export type { Database, Schema };

// Practice text types
export type PracticeText = InferSelectModel<typeof schema.practiceTexts>;
export type NewPracticeText = InferInsertModel<typeof schema.practiceTexts>;

// Author types
export type Author = InferSelectModel<typeof schema.authors>;
export type NewAuthor = InferInsertModel<typeof schema.authors>;

// Reference speech types
export type ReferenceSpeech = InferSelectModel<typeof schema.referenceSpeeches>;
export type NewReferenceSpeech = InferInsertModel<
	typeof schema.referenceSpeeches
>;

// User recording types
export type UserRecording = InferSelectModel<typeof schema.userRecordings>;
export type NewUserRecording = InferInsertModel<typeof schema.userRecordings>;

// Audio quality metrics types
export type AudioQualityMetrics = InferSelectModel<
	typeof schema.audioQualityMetrics
>;
export type NewAudioQualityMetrics = InferInsertModel<
	typeof schema.audioQualityMetrics
>;

// Analysis types
export type Analysis = InferSelectModel<typeof schema.analyses>;
export type NewAnalysis = InferInsertModel<typeof schema.analyses>;

// Alignment types
export type Alignment = InferSelectModel<typeof schema.alignments>;
export type NewAlignment = InferInsertModel<typeof schema.alignments>;

// User preferences types
export type UserPreferences = InferSelectModel<typeof schema.userPreferences>;
export type NewUserPreferences = InferInsertModel<
	typeof schema.userPreferences
>;

// Phoneme error types
export type PhonemeError = InferSelectModel<typeof schema.phonemeErrors>;
export type NewPhonemeError = InferInsertModel<typeof schema.phonemeErrors>;

// Word error types
export type WordError = InferSelectModel<typeof schema.wordErrors>;
export type NewWordError = InferInsertModel<typeof schema.wordErrors>;

// IPA generation job types
export type IpaGenerationJob = InferSelectModel<
	typeof schema.ipaGenerationJobs
>;
export type NewIpaGenerationJob = InferInsertModel<
	typeof schema.ipaGenerationJobs
>;

// Enum types
export type GenerationMethod =
	(typeof schema.generationMethodEnum.enumValues)[number];
export type IpaMethod = (typeof schema.ipaMethodEnum.enumValues)[number];
export type RecordingMethod =
	(typeof schema.recordingMethodEnum.enumValues)[number];
export type QualityStatus =
	(typeof schema.qualityStatusEnum.enumValues)[number];
export type AlignmentMethod =
	(typeof schema.alignmentMethodEnum.enumValues)[number];
export type ErrorType = (typeof schema.errorTypeEnum.enumValues)[number];
export type TextDifficulty =
	(typeof schema.textDifficultyEnum.enumValues)[number];
export type TextType = (typeof schema.textTypeEnum.enumValues)[number];
export type JobStatus = (typeof schema.jobStatusEnum.enumValues)[number];

