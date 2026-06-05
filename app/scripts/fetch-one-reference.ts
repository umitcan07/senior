#!/usr/bin/env tsx
/**
 * READ-ONLY: pull a single reference_speech (text + IPA + audio) for the
 * POWSM CTC forced-alignment probe (Epic E1 experiment). Writes the WAV to
 * ../sig/exp/ctc_probe/<id>.wav and a sidecar JSON with text + IPA.
 *
 * Run from app/: pnpm tsx scripts/fetch-one-reference.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

function requireEnv(name: string): string {
	const value = process.env[name];
	if (!value) throw new Error(`${name} not set`);
	return value;
}

const DATABASE_URL = requireEnv("DATABASE_URL");
const R2_ENDPOINT = requireEnv("R2_ENDPOINT");
const R2_ACCESS_KEY_ID = requireEnv("R2_ACCESS_KEY_ID");
const R2_SECRET_ACCESS_KEY = requireEnv("R2_SECRET_ACCESS_KEY");
const R2_BUCKET_NAME = requireEnv("R2_BUCKET_NAME");

const outDir = join(__dirname, "..", "..", "sig", "exp", "ctc_probe");
mkdirSync(outDir, { recursive: true });

const pool = new Pool({ connectionString: DATABASE_URL });
const db = drizzle(pool);

const s3 = new S3Client({
	region: "auto",
	endpoint: R2_ENDPOINT,
	credentials: {
		accessKeyId: R2_ACCESS_KEY_ID,
		secretAccessKey: R2_SECRET_ACCESS_KEY,
	},
});

interface RefRow {
	id: string;
	storage_key: string;
	ipa_transcription: string;
	ipa_method: string | null;
	generation_method: string | null;
	content: string;
	word_count: number;
	author: string;
}

interface ManifestEntry {
	id: string;
	author: string;
	content: string;
	ipa: string;
	ipa_method: string | null;
	generation_method: string | null;
	storage_key: string;
	wav: string;
}

async function main() {
	// Prefer a short, clean sentence with a real IPA transcription.
	const res = await db.execute(sql`
		SELECT rs.id, rs.storage_key, rs.ipa_transcription, rs.ipa_method,
		       rs.generation_method, pt.content, pt.word_count, a.name AS author
		FROM reference_speeches rs
		JOIN practice_texts pt ON pt.id = rs.text_id
		JOIN authors a ON a.id = rs.author_id
		WHERE rs.ipa_transcription IS NOT NULL
		  AND length(rs.ipa_transcription) > 0
		ORDER BY pt.word_count ASC
		LIMIT 3
	`);

	if (res.rows.length === 0) {
		console.log("No reference with ipa_transcription found.");
		await pool.end();
		return;
	}

	const manifest: ManifestEntry[] = [];
	for (const r of res.rows as unknown as RefRow[]) {
		console.log("\n--- reference ---");
		console.log("id:        ", r.id);
		console.log("author:    ", r.author);
		console.log("content:   ", r.content);
		console.log("ipa_method:", r.ipa_method, "| gen:", r.generation_method);
		console.log("ipa:       ", r.ipa_transcription);
		console.log("storageKey:", r.storage_key);

		const obj = await s3.send(
			new GetObjectCommand({
				Bucket: R2_BUCKET_NAME,
				Key: r.storage_key,
			}),
		);
		if (!obj.Body) throw new Error(`empty R2 body for ${r.storage_key}`);
		const bytes = Buffer.from(await obj.Body.transformToByteArray());
		const wavPath = join(outDir, `${r.id}.wav`);
		writeFileSync(wavPath, bytes);
		console.log(`wrote ${wavPath} (${bytes.length} bytes)`);

		manifest.push({
			id: r.id,
			author: r.author,
			content: r.content,
			ipa: r.ipa_transcription,
			ipa_method: r.ipa_method,
			generation_method: r.generation_method,
			storage_key: r.storage_key,
			wav: `${r.id}.wav`,
		});
	}

	writeFileSync(
		join(outDir, "manifest.json"),
		JSON.stringify(manifest, null, 2),
	);
	console.log(`\nwrote manifest.json with ${manifest.length} entries`);
	await pool.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
