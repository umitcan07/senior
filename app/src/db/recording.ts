import { eq } from "drizzle-orm";
import { db } from "./index";
import { userRecordings } from "./schema";
import type { NewUserRecording, UserRecording } from "./types";

export type { UserRecording, NewUserRecording };

export async function insertUserRecording(
	data: Omit<NewUserRecording, "id" | "createdAt" | "updatedAt">,
): Promise<UserRecording> {
	const [result] = await db.insert(userRecordings).values(data).returning();
	return result;
}

export async function getUserRecordings(
	userId: string,
): Promise<UserRecording[]> {
	return await db
		.select()
		.from(userRecordings)
		.where(eq(userRecordings.userId, userId))
		.orderBy(userRecordings.createdAt);
}

export async function getUserRecordingById(
	id: string,
): Promise<UserRecording | null> {
	const [result] = await db
		.select()
		.from(userRecordings)
		.where(eq(userRecordings.id, id))
		.limit(1);
	return result || null;
}

export async function deleteUserRecording(id: string): Promise<void> {
	await db.delete(userRecordings).where(eq(userRecordings.id, id));
}
