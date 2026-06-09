#!/usr/bin/env tsx
/**
 * Re-point reference_speeches phone timings to a specific POWSM model.
 *
 * The assess worker is stateless and diffs the learner's phones against the
 * reference phones the app sends from reference_speeches.phone_timings_json. Those
 * must come from the SAME model the worker runs, or the diff conflates model
 * differences with pronunciation errors. After deploying the l2a_ppl adapter we
 * re-precompute references with it (mod/precompute_references.py) and run this to
 * update ONLY phone_timings_json + ipa_transcription (no R2, no wav metadata).
 *
 * Matches reference_speeches by author slug + practice-text content, exactly like
 * scripts/ingest-references.ts.
 *
 * Run from app/:
 *   pnpm tsx scripts/update-reference-timings.ts                  # dry run (default)
 *   pnpm tsx scripts/update-reference-timings.ts --write          # apply
 *   pnpm tsx scripts/update-reference-timings.ts --dir ../data/precompute_l2a_ppl
 */

import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "../src/db/schema";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const DATA_ROOT = process.env.DATA_DIR ?? join(ROOT, "data");

config({ path: join(__dirname, "..", ".env") });
if (typeof WebSocket === "undefined") neonConfig.webSocketConstructor = ws;

const WRITE = process.argv.includes("--write");
const dirArg = process.argv.indexOf("--dir");
const PRECOMPUTE_DIR =
	dirArg >= 0 ? process.argv[dirArg + 1] : join(DATA_ROOT, "precompute_l2a_ppl");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

interface PrecomputeRecord {
	author: string;
	id: string;
	text: string;
	ipa_transcription: string;
	phone_timings: Array<{
		token: string;
		start_ms: number;
		end_ms: number;
		confidence: number;
	}>;
	model_version?: string;
}

async function main() {
	const authorsData: Record<string, { kind: string }> = JSON.parse(
		readFileSync(join(DATA_ROOT, "authors.json"), "utf-8"),
	).authors;
	const manifest: Array<{ id: string; text: string }> = JSON.parse(
		readFileSync(join(DATA_ROOT, "manifest.json"), "utf-8"),
	).references;

	const refAuthors = Object.entries(authorsData)
		.filter(([, m]) => m.kind === "reference")
		.map(([slug]) => slug);

	console.log(
		`${WRITE ? "WRITE" : "DRY RUN"} · source=${PRECOMPUTE_DIR}\n`,
	);

	let changed = 0;
	let unchanged = 0;
	let missingRow = 0;
	let missingJson = 0;
	const modelVersions = new Set<string>();

	for (const slug of refAuthors) {
		const [author] = await db
			.select({ id: schema.authors.id })
			.from(schema.authors)
			.where(eq(schema.authors.slug, slug))
			.limit(1);
		if (!author) {
			console.log(`SKIP author (no row): ${slug}`);
			continue;
		}

		for (const entry of manifest) {
			const jsonPath = join(PRECOMPUTE_DIR, slug, `${entry.id}.json`);
			if (!existsSync(jsonPath)) {
				missingJson++;
				continue;
			}
			const rec: PrecomputeRecord = JSON.parse(readFileSync(jsonPath, "utf-8"));
			if (rec.model_version) modelVersions.add(rec.model_version);

			const [text] = await db
				.select({ id: schema.practiceTexts.id })
				.from(schema.practiceTexts)
				.where(eq(schema.practiceTexts.content, entry.text))
				.limit(1);
			if (!text) {
				missingRow++;
				continue;
			}

			const [row] = await db
				.select({
					id: schema.referenceSpeeches.id,
					phoneTimingsJson: schema.referenceSpeeches.phoneTimingsJson,
				})
				.from(schema.referenceSpeeches)
				.where(
					and(
						eq(schema.referenceSpeeches.authorId, author.id),
						eq(schema.referenceSpeeches.textId, text.id),
					),
				)
				.limit(1);
			if (!row) {
				missingRow++;
				continue;
			}

			const oldTokens = (row.phoneTimingsJson ?? []).map((p) => p.token).join(" ");
			const newTokens = rec.phone_timings.map((p) => p.token).join(" ");
			if (oldTokens === newTokens) {
				unchanged++;
				continue;
			}

			changed++;
			console.log(`CHANGE ${slug}/${entry.id}`);
			console.log(`   old: ${oldTokens.slice(0, 90)}`);
			console.log(`   new: ${newTokens.slice(0, 90)}`);

			if (WRITE) {
				await db
					.update(schema.referenceSpeeches)
					.set({
						phoneTimingsJson: rec.phone_timings,
						ipaTranscription: rec.ipa_transcription,
						updatedAt: new Date(),
					})
					.where(eq(schema.referenceSpeeches.id, row.id));
			}
		}
	}

	console.log(
		`\n${WRITE ? "Updated" : "Would update"}: ${changed}   unchanged: ${unchanged}   ` +
			`missing-row: ${missingRow}   missing-json: ${missingJson}`,
	);
	console.log(`model_version(s) in source: ${[...modelVersions].join(", ")}`);
	if (!WRITE) console.log("\n(dry run — re-run with --write to apply)");
	await pool.end();
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
