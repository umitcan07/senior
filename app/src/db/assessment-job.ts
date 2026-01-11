import { eq, or } from "drizzle-orm";
import { db } from "./index";
import { assessmentJobs } from "./schema";

export type AssessmentJob = typeof assessmentJobs.$inferSelect;
export type NewAssessmentJob = typeof assessmentJobs.$inferInsert;

/**
 * Create a new assessment job
 */
export async function createAssessmentJob(
	analysisId: string,
	externalJobId: string,
): Promise<AssessmentJob> {
	const [job] = await db
		.insert(assessmentJobs)
		.values({
			analysisId,
			externalJobId,
			status: "in_queue",
		})
		.returning();

	return job;
}

/**
 * Get assessment job by external ID
 */
export async function getAssessmentJobByExternalId(
	externalJobId: string,
): Promise<AssessmentJob | null> {
	const [job] = await db
		.select()
		.from(assessmentJobs)
		.where(eq(assessmentJobs.externalJobId, externalJobId))
		.limit(1);

	return job ?? null;
}

/**
 * Get the latest assessment job for an analysis
 */
export async function getLatestAssessmentJob(
	analysisId: string,
): Promise<AssessmentJob | null> {
	const [job] = await db
		.select()
		.from(assessmentJobs)
		.where(eq(assessmentJobs.analysisId, analysisId))
		.orderBy(assessmentJobs.createdAt)
		.limit(1);

	return job ?? null;
}

/**
 * Update assessment job status and result
 */
export async function updateAssessmentJob(
	externalJobId: string,
	updates: {
		status?: AssessmentJob["status"];
		result?: Record<string, unknown>;
		error?: string | null;
		executionTimeMs?: number | null;
		delayTimeMs?: number | null;
	},
): Promise<AssessmentJob | null> {
	const [job] = await db
		.update(assessmentJobs)
		.set({
			...updates,
			updatedAt: new Date(),
		})
		.where(eq(assessmentJobs.externalJobId, externalJobId))
		.returning();

	return job ?? null;
}

/**
 * Get pending assessment jobs (for polling)
 */
export async function getPendingAssessmentJobs(): Promise<AssessmentJob[]> {
	return db
		.select()
		.from(assessmentJobs)
		.where(
			or(
				eq(assessmentJobs.status, "in_queue"),
				eq(assessmentJobs.status, "in_progress"),
			),
		);
}
