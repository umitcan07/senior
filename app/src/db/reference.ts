import { eq } from "drizzle-orm";
import { db } from "./index";
import { authors, practiceTexts, referenceSpeeches } from "./schema";
import type {
	Author,
	GenerationMethod,
	NewReferenceSpeech,
	PracticeText,
	ReferenceSpeech,
} from "./types";

export type { ReferenceSpeech, NewReferenceSpeech };

// Use schema-inferred types directly
export type ReferenceSpeechWithRelations = ReferenceSpeech & {
	author: Author;
	text: PracticeText;
};

export async function getReferenceSpeeches(): Promise<ReferenceSpeech[]> {
	return await db.select().from(referenceSpeeches);
}

export async function getReferenceSpeechesWithRelations(): Promise<
	ReferenceSpeechWithRelations[]
> {
	const result = await db
		.select({
			id: referenceSpeeches.id,
			storageKey: referenceSpeeches.storageKey,
			authorId: referenceSpeeches.authorId,
			textId: referenceSpeeches.textId,
			generationMethod: referenceSpeeches.generationMethod,
			ipaTranscription: referenceSpeeches.ipaTranscription,
			ipaMethod: referenceSpeeches.ipaMethod,
			priority: referenceSpeeches.priority,
			durationMs: referenceSpeeches.durationMs,
			fileSizeBytes: referenceSpeeches.fileSizeBytes,
			sampleRateHz: referenceSpeeches.sampleRateHz,
			channels: referenceSpeeches.channels,
			bitrateKbps: referenceSpeeches.bitrateKbps,
			createdAt: referenceSpeeches.createdAt,
			updatedAt: referenceSpeeches.updatedAt,
			author: {
				id: authors.id,
				name: authors.name,
				accent: authors.accent,
				style: authors.style,
				languageCode: authors.languageCode,
				elevenlabsVoiceId: authors.elevenlabsVoiceId,
				createdAt: authors.createdAt,
				updatedAt: authors.updatedAt,
			},
			text: {
				id: practiceTexts.id,
				content: practiceTexts.content,
				difficulty: practiceTexts.difficulty,
				wordCount: practiceTexts.wordCount,
				type: practiceTexts.type,
				note: practiceTexts.note,
				createdAt: practiceTexts.createdAt,
				updatedAt: practiceTexts.updatedAt,
			},
		})
		.from(referenceSpeeches)
		.innerJoin(authors, eq(referenceSpeeches.authorId, authors.id))
		.innerJoin(practiceTexts, eq(referenceSpeeches.textId, practiceTexts.id))
		.orderBy(referenceSpeeches.createdAt);

	return result;
}

export async function getReferenceSpeechById(
	id: string,
): Promise<ReferenceSpeech | null> {
	const [result] = await db
		.select()
		.from(referenceSpeeches)
		.where(eq(referenceSpeeches.id, id))
		.limit(1);
	return result || null;
}

export async function getReferenceSpeechWithText(
	id: string,
): Promise<(ReferenceSpeech & { text: PracticeText }) | null> {
	const [result] = await db
		.select({
			id: referenceSpeeches.id,
			storageKey: referenceSpeeches.storageKey,
			authorId: referenceSpeeches.authorId,
			textId: referenceSpeeches.textId,
			generationMethod: referenceSpeeches.generationMethod,
			ipaTranscription: referenceSpeeches.ipaTranscription,
			ipaMethod: referenceSpeeches.ipaMethod,
			priority: referenceSpeeches.priority,
			durationMs: referenceSpeeches.durationMs,
			fileSizeBytes: referenceSpeeches.fileSizeBytes,
			sampleRateHz: referenceSpeeches.sampleRateHz,
			channels: referenceSpeeches.channels,
			bitrateKbps: referenceSpeeches.bitrateKbps,
			createdAt: referenceSpeeches.createdAt,
			updatedAt: referenceSpeeches.updatedAt,
			text: {
				id: practiceTexts.id,
				content: practiceTexts.content,
				difficulty: practiceTexts.difficulty,
				wordCount: practiceTexts.wordCount,
				type: practiceTexts.type,
				note: practiceTexts.note,
				createdAt: practiceTexts.createdAt,
				updatedAt: practiceTexts.updatedAt,
			},
		})
		.from(referenceSpeeches)
		.innerJoin(practiceTexts, eq(referenceSpeeches.textId, practiceTexts.id))
		.where(eq(referenceSpeeches.id, id))
		.limit(1);
	return result || null;
}

export async function getReferenceSpeechesForText(
	textId: string,
): Promise<ReferenceSpeechWithRelations[]> {
	const result = await db
		.select({
			id: referenceSpeeches.id,
			storageKey: referenceSpeeches.storageKey,
			authorId: referenceSpeeches.authorId,
			textId: referenceSpeeches.textId,
			generationMethod: referenceSpeeches.generationMethod,
			ipaTranscription: referenceSpeeches.ipaTranscription,
			ipaMethod: referenceSpeeches.ipaMethod,
			priority: referenceSpeeches.priority,
			durationMs: referenceSpeeches.durationMs,
			fileSizeBytes: referenceSpeeches.fileSizeBytes,
			sampleRateHz: referenceSpeeches.sampleRateHz,
			channels: referenceSpeeches.channels,
			bitrateKbps: referenceSpeeches.bitrateKbps,
			createdAt: referenceSpeeches.createdAt,
			updatedAt: referenceSpeeches.updatedAt,
			author: {
				id: authors.id,
				name: authors.name,
				accent: authors.accent,
				style: authors.style,
				languageCode: authors.languageCode,
				elevenlabsVoiceId: authors.elevenlabsVoiceId,
				createdAt: authors.createdAt,
				updatedAt: authors.updatedAt,
			},
			text: {
				id: practiceTexts.id,
				content: practiceTexts.content,
				difficulty: practiceTexts.difficulty,
				wordCount: practiceTexts.wordCount,
				type: practiceTexts.type,
				note: practiceTexts.note,
				createdAt: practiceTexts.createdAt,
				updatedAt: practiceTexts.updatedAt,
			},
		})
		.from(referenceSpeeches)
		.innerJoin(authors, eq(referenceSpeeches.authorId, authors.id))
		.innerJoin(practiceTexts, eq(referenceSpeeches.textId, practiceTexts.id))
		.where(eq(referenceSpeeches.textId, textId))
		.orderBy(referenceSpeeches.priority);

	return result;
}

export async function insertReferenceSpeech(data: {
	storageKey: string;
	authorId: string;
	textId: string;
	generationMethod: GenerationMethod;
	ipaTranscription?: string | null;
	priority?: number;
	durationMs?: number | null;
	fileSizeBytes?: number | null;
	sampleRateHz?: number | null;
	channels?: number | null;
	bitrateKbps?: number | null;
}): Promise<ReferenceSpeech> {
	const [result] = await db
		.insert(referenceSpeeches)
		.values({
			storageKey: data.storageKey,
			authorId: data.authorId,
			textId: data.textId,
			generationMethod: data.generationMethod,
			ipaTranscription: data.ipaTranscription ?? null,
			priority: data.priority ?? 0,
			durationMs: data.durationMs ?? null,
			fileSizeBytes: data.fileSizeBytes ?? null,
			sampleRateHz: data.sampleRateHz ?? null,
			channels: data.channels ?? null,
			bitrateKbps: data.bitrateKbps ?? null,
		})
		.returning();
	return result;
}

export async function updateReferenceSpeech(
	id: string,
	data: {
		storageKey?: string;
		authorId?: string;
		textId?: string;
		generationMethod?: GenerationMethod;
		ipaTranscription?: string | null;
		priority?: number;
		durationMs?: number | null;
		fileSizeBytes?: number | null;
		sampleRateHz?: number | null;
		channels?: number | null;
		bitrateKbps?: number | null;
	},
): Promise<ReferenceSpeech> {
	const updateData: Partial<NewReferenceSpeech> = {
		updatedAt: new Date(),
	};

	if (data.storageKey !== undefined) updateData.storageKey = data.storageKey;
	if (data.authorId !== undefined) updateData.authorId = data.authorId;
	if (data.textId !== undefined) updateData.textId = data.textId;
	if (data.generationMethod !== undefined)
		updateData.generationMethod = data.generationMethod;
	if (data.ipaTranscription !== undefined)
		updateData.ipaTranscription = data.ipaTranscription;
	if (data.priority !== undefined) updateData.priority = data.priority;
	if (data.durationMs !== undefined) updateData.durationMs = data.durationMs;
	if (data.fileSizeBytes !== undefined)
		updateData.fileSizeBytes = data.fileSizeBytes;
	if (data.sampleRateHz !== undefined)
		updateData.sampleRateHz = data.sampleRateHz;
	if (data.channels !== undefined) updateData.channels = data.channels;
	if (data.bitrateKbps !== undefined) updateData.bitrateKbps = data.bitrateKbps;

	const [result] = await db
		.update(referenceSpeeches)
		.set(updateData)
		.where(eq(referenceSpeeches.id, id))
		.returning();
	return result;
}

export async function deleteReferenceSpeech(id: string): Promise<void> {
	await db.delete(referenceSpeeches).where(eq(referenceSpeeches.id, id));
}
