import { eq } from "drizzle-orm";
import { db } from "./index";
import { analyses,  audioQualityMetrics, phonemeErrors, wordErrors } from "./schema";
import type {
	Analysis,
	AudioQualityMetrics,
	NewAnalysis,
	NewAudioQualityMetrics,
	NewPhonemeError,
	NewWordError,
	PhonemeError,
	WordError,
} from "./types";

export async function insertAnalysis(
	analysis: Omit<NewAnalysis, "id" | "createdAt">,
): Promise<Analysis> {
	const [result] = await db.insert(analyses).values(analysis).returning();
	return result;
}

export async function getAnalysisById(id: string): Promise<Analysis | null> {
	const [result] = await db
		.select()
		.from(analyses)
		.where(eq(analyses.id, id))
		.limit(1);
	return result || null;
}

export async function getAnalysisByJobId(jobId: string): Promise<Analysis | null> {
	const [result] = await db
		.select()
		.from(analyses)
		.where(eq(analyses.jobId, jobId))
		.limit(1);
	return result || null;
}

export async function updateAnalysis(
	id: string,
	updates: Partial<Omit<Analysis, "id" | "createdAt">>,
): Promise<Analysis | null> {
	const [result] = await db
		.update(analyses)
		.set(updates)
		.where(eq(analyses.id, id))
		.returning();
	return result || null;
}

export async function insertPhonemeErrors(
	errors: Omit<NewPhonemeError, "id" | "createdAt">[],
): Promise<PhonemeError[]> {
	if (errors.length === 0) return [];
	return await db.insert(phonemeErrors).values(errors).returning();
}

export async function insertWordErrors(
	errors: Omit<NewWordError, "id" | "createdAt">[],
): Promise<WordError[]> {
	if (errors.length === 0) return [];
	return await db.insert(wordErrors).values(errors).returning();
}

export async function getPhonemeErrorsByAnalysisId(
	analysisId: string,
): Promise<PhonemeError[]> {
	return await db
		.select()
		.from(phonemeErrors)
		.where(eq(phonemeErrors.analysisId, analysisId));
}

export async function getWordErrorsByAnalysisId(
	analysisId: string,
): Promise<WordError[]> {
	return await db
		.select()
		.from(wordErrors)
		.where(eq(wordErrors.analysisId, analysisId));
}

export async function insertAudioQualityMetrics(
	metrics: Omit<NewAudioQualityMetrics, "id" | "createdAt">,
): Promise<AudioQualityMetrics> {
	const [result] = await db.insert(audioQualityMetrics).values(metrics).returning();
	return result;
}

export async function getAudioQualityMetricsByUserRecordingId(
	userRecordingId: string,
): Promise<AudioQualityMetrics | null> {
	const [result] = await db
		.select()
		.from(audioQualityMetrics)
		.where(eq(audioQualityMetrics.userRecordingId, userRecordingId))
		.limit(1);
	return result || null;
}

/**
 * Get analysis with user recording and reference speech for job submission
 */
export async function getAnalysisWithDetails(analysisId: string): Promise<{
	analysis: Analysis;
	userRecording: {
		id: string;
		storageKey: string;
	};
	referenceSpeech: {
		id: string;
		ipaTranscription: string | null;
		textContent: string;
	};
} | null> {
	const { referenceSpeeches, userRecordings, practiceTexts } = await import(
		"./schema"
	);

	const [result] = await db
		.select({
			analysis: analyses,
			userRecording: {
				id: userRecordings.id,
				storageKey: userRecordings.storageKey,
			},
			reference: {
				id: referenceSpeeches.id,
				ipaTranscription: referenceSpeeches.ipaTranscription,
			},
			text: {
				content: practiceTexts.content,
			},
		})
		.from(analyses)
		.innerJoin(userRecordings, eq(analyses.userRecordingId, userRecordings.id))
		.innerJoin(
			referenceSpeeches,
			eq(analyses.referenceSpeechId, referenceSpeeches.id),
		)
		.innerJoin(practiceTexts, eq(referenceSpeeches.textId, practiceTexts.id))
		.where(eq(analyses.id, analysisId))
		.limit(1);

	if (!result) return null;

	return {
		analysis: result.analysis,
		userRecording: result.userRecording,
		referenceSpeech: {
			id: result.reference.id,
			ipaTranscription: result.reference.ipaTranscription,
			textContent: result.text.content,
		},
	};
}

/**
 * Update analysis by job ID (for webhook processing)
 */
export async function updateAnalysisByJobId(
	jobId: string,
	updates: Partial<Omit<Analysis, "id" | "createdAt">>,
): Promise<Analysis | null> {
	const [result] = await db
		.update(analyses)
		.set(updates)
		.where(eq(analyses.jobId, jobId))
		.returning();
	return result || null;
}
