import { config } from "dotenv";
import { writeFileSync } from "node:fs";
import { getReferenceSpeechesWithRelations } from "../src/db/reference.ts";

config();

/**
 * One-off dump of every reference_speeches row's stored phones, for the
 * deployed-model drift check (issue #94). Emits a JSON the model-side checker
 * (mod/check_reference_drift.py) re-aligns against and diffs.
 *
 *   tsx scripts/dump-reference-phones.ts > /tmp/ref_phones.json
 *
 * Each entry: { id, storageKey, authorSlug, dialect, ipaTranscription,
 * phones } where `phones` are the stored phone_timings_json tokens with the
 * ▁ word-boundary marker stripped (the same sequence ipaTranscription joins).
 */
const main = async () => {
	const rows = await getReferenceSpeechesWithRelations();
	const out = rows.map((r) => ({
		id: r.id,
		storageKey: r.storageKey,
		authorSlug: r.author.slug,
		dialect: r.dialect,
		generationMethod: r.generationMethod,
		ipaTranscription: r.ipaTranscription,
		phones: (r.phoneTimingsJson ?? [])
			.map((p) => p.token)
			.filter((t) => t !== "▁"),
	}));
	writeFileSync(1, JSON.stringify(out, null, 2));
	process.exit(0);
};

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
