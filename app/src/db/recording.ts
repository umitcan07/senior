import { db } from "./index";
import { recordings } from "./schema";
import { eq } from "drizzle-orm";
import type { InferSelectModel, InferInsertModel } from "drizzle-orm";

export type Recording = InferSelectModel<typeof recordings>;
export type NewRecording = InferInsertModel<typeof recordings>;

export async function insertRecording(data: {
	userId: string;
	path: string;
}): Promise<Recording> {
	const [result] = await db
		.insert(recordings)
		.values({
			userId: data.userId,
			path: data.path,
		})
		.returning();
	return result;
}

export async function getRecordings(userId: string): Promise<Recording[]> {
	return await db
		.select()
		.from(recordings)
		.where(eq(recordings.userId, userId));
}

