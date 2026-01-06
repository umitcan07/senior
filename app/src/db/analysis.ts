import { eq } from "drizzle-orm";
import { db } from "./index";
import { analyses, phonemeErrors, wordErrors } from "./schema";
import type {
	NewAnalysis,
	NewPhonemeError,
	NewWordError,
	Analysis,
	PhonemeError,
	WordError,
} from "./types";

export async function insertAnalysis(
	analysis: Omit<NewAnalysis, "id" | "createdAt">,
): Promise<Analysis> {
	const [result] = await db.insert(analyses).values(analysis).returning();
	return result;
}

export async function getAnalysisById(
	id: string,
): Promise<Analysis | null> {
	const [result] = await db
		.select()
		.from(analyses)
		.where(eq(analyses.id, id))
		.limit(1);
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
