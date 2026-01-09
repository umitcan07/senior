import { and, eq } from "drizzle-orm";
import { db } from "./index";
import { ipaGenerationJobs, referenceSpeeches } from "./schema";

export type IpaGenerationJob = typeof ipaGenerationJobs.$inferSelect;
export type NewIpaGenerationJob = typeof ipaGenerationJobs.$inferInsert;

/**
 * Create a new IPA generation job
 */
export async function createIpaGenerationJob(
	referenceSpeechId: string,
	externalJobId: string,
): Promise<IpaGenerationJob> {
	const [job] = await db
		.insert(ipaGenerationJobs)
		.values({
			referenceSpeechId,
			externalJobId,
			status: "in_queue",
		})
		.returning();

	return job;
}

/**
 * Get IPA generation job by external ID
 */
export async function getIpaGenerationJobByExternalId(
	externalJobId: string,
): Promise<IpaGenerationJob | null> {
	const [job] = await db
		.select()
		.from(ipaGenerationJobs)
		.where(eq(ipaGenerationJobs.externalJobId, externalJobId))
		.limit(1);

	return job ?? null;
}

/**
 * Get the latest IPA generation job for a reference speech
 */
export async function getLatestIpaGenerationJob(
	referenceSpeechId: string,
): Promise<IpaGenerationJob | null> {
	const [job] = await db
		.select()
		.from(ipaGenerationJobs)
		.where(eq(ipaGenerationJobs.referenceSpeechId, referenceSpeechId))
		.orderBy(ipaGenerationJobs.createdAt)
		.limit(1);

	return job ?? null;
}

/**
 * Update IPA generation job status and result
 */
export async function updateIpaGenerationJob(
	externalJobId: string,
	updates: {
		status?: IpaGenerationJob["status"];
		result?: Record<string, unknown>;
		error?: string | null;
		executionTimeMs?: number | null;
		delayTimeMs?: number | null;
	},
): Promise<IpaGenerationJob | null> {
	const [job] = await db
		.update(ipaGenerationJobs)
		.set({
			...updates,
			updatedAt: new Date(),
		})
		.where(eq(ipaGenerationJobs.externalJobId, externalJobId))
		.returning();

	return job ?? null;
}

/**
 * Update reference speech IPA transcription
 */
export async function updateReferenceSpeechIpa(
	referenceSpeechId: string,
	ipaTranscription: string,
	ipaMethod: "powsm" | "cmudict" = "powsm",
): Promise<void> {
	await db
		.update(referenceSpeeches)
		.set({
			ipaTranscription,
			ipaMethod,
			updatedAt: new Date(),
		})
		.where(eq(referenceSpeeches.id, referenceSpeechId));
}

/**
 * Get pending IPA generation jobs (for polling)
 */
export async function getPendingIpaGenerationJobs(): Promise<
	IpaGenerationJob[]
> {
	return db
		.select()
		.from(ipaGenerationJobs)
		.where(
			and(
				eq(ipaGenerationJobs.status, "in_queue"),
				eq(ipaGenerationJobs.status, "in_progress"),
			),
		);
}
