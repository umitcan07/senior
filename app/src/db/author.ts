import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { authors, referenceSpeeches } from "./schema";
import type { Author, NewAuthor } from "./types";

export type { Author, NewAuthor };

// Use schema-inferred type with additional computed field
export type AuthorWithReferenceCount = Author & {
	referenceCount: number;
};

export async function getAuthors(): Promise<Author[]> {
	return await db
		.select({
			id: authors.id,
			name: authors.name,
			accent: authors.accent,
			style: authors.style,
			languageCode: authors.languageCode,
			elevenlabsVoiceId: authors.elevenlabsVoiceId,
			createdAt: authors.createdAt,
			updatedAt: authors.updatedAt,
		})
		.from(authors)
		.orderBy(authors.name);
}

export async function getAuthorsWithReferenceCounts(): Promise<
	AuthorWithReferenceCount[]
> {
	const result = await db
		.select({
			id: authors.id,
			name: authors.name,
			accent: authors.accent,
			style: authors.style,
			languageCode: authors.languageCode,
			elevenlabsVoiceId: authors.elevenlabsVoiceId,
			createdAt: authors.createdAt,
			updatedAt: authors.updatedAt,
			referenceCount: sql<number>`count(${referenceSpeeches.id})::int`,
		})
		.from(authors)
		.leftJoin(referenceSpeeches, eq(authors.id, referenceSpeeches.authorId))
		.groupBy(authors.id)
		.orderBy(authors.name);

	return result;
}

export async function getAuthorById(id: string): Promise<Author | null> {
	const [result] = await db
		.select({
			id: authors.id,
			name: authors.name,
			accent: authors.accent,
			style: authors.style,
			languageCode: authors.languageCode,
			elevenlabsVoiceId: authors.elevenlabsVoiceId,
			createdAt: authors.createdAt,
			updatedAt: authors.updatedAt,
		})
		.from(authors)
		.where(eq(authors.id, id))
		.limit(1);
	return result || null;
}

export async function insertAuthor(data: {
	name: string;
	accent?: string | null;
	style?: string | null;
	languageCode?: string | null;
	elevenlabsVoiceId?: string | null;
}): Promise<Author> {
	const [result] = await db
		.insert(authors)
		.values({
			name: data.name,
			accent: data.accent ?? null,
			style: data.style ?? null,
			languageCode: data.languageCode ?? null,
			elevenlabsVoiceId: data.elevenlabsVoiceId ?? null,
		})
		.returning();
	return result;
}

export async function updateAuthor(
	id: string,
	data: {
		name?: string;
		accent?: string | null;
		style?: string | null;
		languageCode?: string | null;
		elevenlabsVoiceId?: string | null;
	},
): Promise<Author> {
	const updateData: Partial<NewAuthor> = {
		updatedAt: new Date(),
	};

	if (data.name !== undefined) {
		updateData.name = data.name;
	}
	if (data.accent !== undefined) {
		updateData.accent = data.accent;
	}
	if (data.style !== undefined) {
		updateData.style = data.style;
	}
	if (data.languageCode !== undefined) {
		updateData.languageCode = data.languageCode;
	}
	if (data.elevenlabsVoiceId !== undefined) {
		updateData.elevenlabsVoiceId = data.elevenlabsVoiceId;
	}

	const [result] = await db
		.update(authors)
		.set(updateData)
		.where(eq(authors.id, id))
		.returning();
	return result;
}

export async function deleteAuthor(id: string): Promise<void> {
	await db.delete(authors).where(eq(authors.id, id));
}

export async function getAuthorReferenceCount(id: string): Promise<number> {
	const [result] = await db
		.select({ count: sql<number>`count(*)::int` })
		.from(referenceSpeeches)
		.where(eq(referenceSpeeches.authorId, id));
	return result?.count ?? 0;
}
