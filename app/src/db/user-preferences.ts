import { eq } from "drizzle-orm";
import { db } from "./index";
import { userPreferences } from "./schema";
import type { NewUserPreferences, UserPreferences } from "./types";

export type { NewUserPreferences, UserPreferences };

export async function getUserPreferences(
	userId: string,
): Promise<UserPreferences | null> {
	const [result] = await db
		.select()
		.from(userPreferences)
		.where(eq(userPreferences.userId, userId))
		.limit(1);
	return result || null;
}

export async function upsertUserPreferences(
	userId: string,
	data: {
		preferredAuthorId?: string | null;
	},
): Promise<UserPreferences> {
	const existing = await getUserPreferences(userId);

	if (existing) {
		const [result] = await db
			.update(userPreferences)
			.set({
				preferredAuthorId: data.preferredAuthorId ?? null,
				updatedAt: new Date(),
			})
			.where(eq(userPreferences.userId, userId))
			.returning();
		return result;
	}

	const [result] = await db
		.insert(userPreferences)
		.values({
			userId,
			preferredAuthorId: data.preferredAuthorId ?? null,
		})
		.returning();
	return result;
}
