#!/usr/bin/env tsx
/**
 * Ingest precomputed native reference speeches into R2 + Postgres.
 *
 * Reads data/precompute/<author>/ref_NNN.json (written by
 * mod/precompute_references.py), uploads WAVs to R2 (idempotent), and upserts
 * authors / practice_texts / reference_speeches rows into the DB.
 *
 * Expected outcome: 4 authors, 25 practice_texts, 99 reference_speeches
 * (25×4 − 1, excluding genam_jordan/ref_019).
 *
 * Run from app/: pnpm tsx scripts/ingest-references.ts
 */

import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	HeadObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_ROOT = process.env.DATA_DIR ?? join(ROOT, "data");

config({ path: join(__dirname, "..", ".env") });

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v) throw new Error(`${name} not set`);
	return v;
}

const DATABASE_URL = requireEnv("DATABASE_URL");
const R2_ENDPOINT = requireEnv("R2_ENDPOINT");
const R2_ACCESS_KEY_ID = requireEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = requireEnv("R2_BUCKET_NAME");

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

// Import schema tables directly (avoids the env-var guard in app/src/lib/r2.ts)
import * as schema from "../src/db/schema";

const s3 = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

interface AuthorMeta {
	kind: string;
	dialect: string;
	name: string;
	accent: string;
	source: string;
}

interface ManifestEntry {
	id: string;
	text: string;
}

interface PrecomputeRecord {
	author: string;
	dialect: string;
	id: string;
	text: string;
	ipa_transcription: string;
	phone_timings: Array<{
		token: string;
		start_ms: number;
		end_ms: number;
		confidence: number;
	}>;
	model_tag: string;
}

async function existsInR2(key: string): Promise<boolean> {
	try {
		await s3.send(
			new HeadObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }),
		);
		return true;
	} catch (err: unknown) {
		if (
			err &&
			typeof err === "object" &&
			"$metadata" in err &&
			(err as { $metadata: { httpStatusCode?: number } }).$metadata
				.httpStatusCode === 404
		) {
			return false;
		}
		throw err;
	}
}

async function uploadToR2(
	buf: Buffer,
	key: string,
	contentType: string,
): Promise<void> {
	await s3.send(
		new PutObjectCommand({
			Bucket: R2_BUCKET_NAME,
			Key: key,
			Body: buf,
			ContentType: contentType,
		}),
	);
}

function readWavMeta(wavPath: string): {
	durationMs: number;
	fileSizeBytes: number;
	sampleRateHz: number;
	channels: number;
} {
	const buf = readFileSync(wavPath);
	// WAV header: bytes 22-23 = channels, 24-27 = sample rate, 40-43 = data chunk size
	// Use a simple header parse — no need for a full library.
	const channels = buf.readUInt16LE(22);
	const sampleRateHz = buf.readUInt32LE(24);
	const byteRate = buf.readUInt32LE(28);
	const fileSizeBytes = buf.length;
	// data chunk size is at offset 40 for standard PCM WAV
	const dataSize = buf.readUInt32LE(40);
	const durationMs = Math.round((dataSize / byteRate) * 1000);
	return { durationMs, fileSizeBytes, sampleRateHz, channels };
}

async function main() {
	const authorsPath = join(DATA_ROOT, "authors.json");
	const manifestPath = join(DATA_ROOT, "manifest.json");

	const authorsData: Record<string, AuthorMeta> = JSON.parse(
		readFileSync(authorsPath, "utf-8"),
	).authors;

	const manifest: ManifestEntry[] = JSON.parse(
		readFileSync(manifestPath, "utf-8"),
	).references;

	const referenceAuthors = Object.entries(authorsData).filter(
		([, meta]) => meta.kind === "reference",
	);

	// --- 1. Upsert authors ---
	const authorIdBySlug = new Map<string, string>();

	for (const [slug, meta] of referenceAuthors) {
		const existing = await db
			.select({ id: schema.authors.id })
			.from(schema.authors)
			.where(eq(schema.authors.slug, slug))
			.limit(1);

		if (existing.length > 0) {
			authorIdBySlug.set(slug, existing[0].id);
			console.log(`author exists: ${slug} → ${existing[0].id}`);
		} else {
			const [inserted] = await db
				.insert(schema.authors)
				.values({
					slug,
					name: meta.name,
					accent: meta.accent,
					languageCode: "en",
				})
				.returning({ id: schema.authors.id });
			authorIdBySlug.set(slug, inserted.id);
			console.log(`author inserted: ${slug} → ${inserted.id}`);
		}
	}

	// --- 2. Upsert practice_texts ---
	const textIdByContent = new Map<string, string>();

	for (const entry of manifest) {
		const content = entry.text;
		const wordCount = content.trim().split(/\s+/).length;

		const existing = await db
			.select({ id: schema.practiceTexts.id })
			.from(schema.practiceTexts)
			.where(eq(schema.practiceTexts.content, content))
			.limit(1);

		if (existing.length > 0) {
			textIdByContent.set(content, existing[0].id);
			console.log(`text exists: ${entry.id}`);
		} else {
			const [inserted] = await db
				.insert(schema.practiceTexts)
				.values({
					content,
					wordCount,
					type: "daily",
					difficulty: "intermediate",
				})
				.returning({ id: schema.practiceTexts.id });
			textIdByContent.set(content, inserted.id);
			console.log(`text inserted: ${entry.id} → ${inserted.id}`);
		}
	}

	// --- 3. Ingest reference_speeches ---
	let ingested = 0;
	let updated = 0;

	for (const [slug] of referenceAuthors) {
		const authorId = authorIdBySlug.get(slug)!;

		for (const entry of manifest) {
			const precomputePath = join(
				DATA_ROOT,
				"precompute",
				slug,
				`${entry.id}.json`,
			);

			if (!existsSync(precomputePath)) {
				console.log(`SKIP (no precompute): ${slug}/${entry.id}`);
				continue;
			}

			const precompute: PrecomputeRecord = JSON.parse(
				readFileSync(precomputePath, "utf-8"),
			);

			const textId = textIdByContent.get(entry.text);
			if (!textId) {
				console.error(`ERROR: no textId for "${entry.text}"`);
				continue;
			}

			// R2 upload (idempotent)
			const r2Key = `references/${slug}/${entry.id}.wav`;
			const wavPath = join(
				DATA_ROOT,
				"references",
				slug,
				`${entry.id}.wav`,
			);

			if (!(await existsInR2(r2Key))) {
				const buf = readFileSync(wavPath);
				await uploadToR2(buf, r2Key, "audio/wav");
				console.log(`uploaded: ${r2Key}`);
			}

			const wavMeta = readWavMeta(wavPath);

			const dialect = precompute.dialect as "genam" | "rp";

			// Upsert reference_speech keyed on (authorId, textId)
			const existing = await db
				.select({ id: schema.referenceSpeeches.id })
				.from(schema.referenceSpeeches)
				.where(
					and(
						eq(schema.referenceSpeeches.authorId, authorId),
						eq(schema.referenceSpeeches.textId, textId),
					),
				)
				.limit(1);

			const speechData = {
				storageKey: r2Key,
				authorId,
				textId,
				generationMethod: "native" as const,
				dialect,
				ipaTranscription: precompute.ipa_transcription,
				ipaMethod: "powsm" as const,
				phoneTimingsJson: precompute.phone_timings,
				...wavMeta,
			};

			if (existing.length > 0) {
				await db
					.update(schema.referenceSpeeches)
					.set({ ...speechData, updatedAt: new Date() })
					.where(eq(schema.referenceSpeeches.id, existing[0].id));
				updated++;
				console.log(`updated: ${slug}/${entry.id}`);
			} else {
				await db.insert(schema.referenceSpeeches).values(speechData);
				ingested++;
				console.log(`inserted: ${slug}/${entry.id}`);
			}
		}
	}

	console.log(
		`\nDone. authors=${authorIdBySlug.size} texts=${textIdByContent.size} inserted=${ingested} updated=${updated}`,
	);
	await pool.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
