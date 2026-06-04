#!/usr/bin/env tsx
/**
 * READ-ONLY inspection of live DB contents relevant to Epic E4.
 * Dumps practice_texts (with reference counts), authors, and a
 * reference_speeches summary. No writes.
 *
 * Run from app/: pnpm tsx scripts/inspect-db.ts
 * (run from app/ so node resolves deps and picks up app/.env)
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { config } from "dotenv";
import { drizzle } from "drizzle-orm/neon-serverless";
import { sql } from "drizzle-orm";
import ws from "ws";

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, "..", ".env") });

if (typeof WebSocket === "undefined") {
	neonConfig.webSocketConstructor = ws;
}
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);

async function main() {
	try {
		const texts = await db.execute(sql`
			SELECT pt.id, pt.content, pt.difficulty, pt.type, pt.word_count, pt.note,
			       count(rs.id) AS ref_count
			FROM practice_texts pt
			LEFT JOIN reference_speeches rs ON rs.text_id = pt.id
			GROUP BY pt.id
			ORDER BY pt.type, pt.difficulty, pt.word_count
		`);

		const authors = await db.execute(sql`
			SELECT a.id, a.name, a.accent, a.style, a.language_code,
			       count(rs.id) AS ref_count
			FROM authors a
			LEFT JOIN reference_speeches rs ON rs.author_id = a.id
			GROUP BY a.id
			ORDER BY a.name
		`);

		const refSummary = await db.execute(sql`
			SELECT generation_method, ipa_method, count(*) AS n,
			       count(ipa_transcription) AS with_ipa
			FROM reference_speeches
			GROUP BY generation_method, ipa_method
			ORDER BY generation_method, ipa_method
		`);

		console.log(`\n=== practice_texts (${texts.rows.length}) ===`);
		console.table(
			texts.rows.map((r: any) => ({
				type: r.type,
				diff: r.difficulty,
				wc: r.word_count,
				refs: Number(r.ref_count),
				content:
					r.content.length > 70 ? `${r.content.slice(0, 70)}…` : r.content,
			})),
		);

		console.log(`\n=== authors (${authors.rows.length}) ===`);
		console.table(
			authors.rows.map((r: any) => ({
				name: r.name,
				accent: r.accent,
				style: r.style,
				lang: r.language_code,
				refs: Number(r.ref_count),
			})),
		);

		console.log("\n=== reference_speeches summary ===");
		console.table(refSummary.rows);
	} finally {
		await pool.end();
	}
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
