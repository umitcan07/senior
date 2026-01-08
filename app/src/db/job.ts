import { desc, eq } from "drizzle-orm";
import { db } from "./index";
import { jobs } from "./schema";

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export async function createJob(externalJobId: string): Promise<Job> {
	const [job] = await db.insert(jobs).values({ externalJobId }).returning();
	return job;
}

export async function getJobByExternalId(
	externalJobId: string,
): Promise<Job | null> {
	const [job] = await db
		.select()
		.from(jobs)
		.where(eq(jobs.externalJobId, externalJobId))
		.limit(1);
	return job ?? null;
}

export async function getJobById(id: string): Promise<Job | null> {
	const [job] = await db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
	return job ?? null;
}

export async function getAllJobs(): Promise<Job[]> {
	return db.select().from(jobs).orderBy(desc(jobs.createdAt));
}

export async function updateJob(
	externalJobId: string,
	data: {
		status?: "in_queue" | "in_progress" | "completed" | "failed";
		result?: unknown;
		error?: string | null;
		executionTimeMs?: number | null;
		delayTimeMs?: number | null;
	},
): Promise<Job | null> {
	const [job] = await db
		.update(jobs)
		.set({
			...data,
			updatedAt: new Date(),
		})
		.where(eq(jobs.externalJobId, externalJobId))
		.returning();
	return job ?? null;
}
