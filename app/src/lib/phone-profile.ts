import type { PhonemeError } from "@/db/types";
import {
	coachingFor,
	featureSummary,
	type Severity,
	severityFor,
} from "./phone-hints";

/**
 * E7.6 / #57 — cross-attempt "Pronunciation Profile" for the summary page.
 *
 * The old "Most Challenging Sounds" grouped every error by its *target* phone and
 * filtered out insertions entirely, so it could only ever show sounds you
 * under-produced — never sounds you add redundantly, and it conflated "I replace θ"
 * with "I drop θ". This module reframes the same per-error rows along the two axes a
 * learner actually cares about:
 *
 *   • toMaster — substitutions (directional contrast pairs) + deletions: a target
 *     sound you produce wrong or omit. "Struggle to pronounce."
 *   • added    — insertions: a sound you produce that isn't in the word, dominated for
 *     Turkish-L1 speakers by epenthetic vowels breaking up consonant clusters.
 *     "Articulate redundantly."
 *
 * Severity, hints and feature categories are reused verbatim from `phone-hints.ts`
 * (Architecture B — pedagogy stays app-side), so a contrast reads identically here and
 * on the per-attempt diff. Ranking is recency-weighted (computed in SQL) × severity, so
 * a critical contrast you still make floats above a near-miss you made weeks ago.
 */

export type ErrorMode = "substitute" | "insert" | "delete";

/**
 * One compact per-(mode, expected, actual) aggregate, produced by
 * `getPhonemeChallengeProfile` in the DB layer. `featureDistance`/`featureDelta` mirror
 * the column types (Drizzle hands decimals back as strings) so the rows feed straight
 * into the `phone-hints` functions.
 */
export type ChallengeAggregate = {
	errorType: ErrorMode;
	expected: string | null;
	actual: string | null;
	/** Raw occurrence count across all scored attempts. */
	count: number;
	/** Σ of an exponential recency decay (half-life RECENCY_HALFLIFE_DAYS) over the
	 * contributing attempts — recent slips weigh more than old ones. */
	recencyWeight: number;
	/** AVG(feature_distance) as a decimal string, or null (ins/del / pre-Phase-2). */
	avgDistance: string | null;
	/** A representative feature delta (deterministic per pair), or null. */
	sampleDelta: Array<{ feature: string; ref: string; user: string }> | null;
	/** How many of the occurrences were flagged `uncertain` by the model. */
	uncertainCount: number;
	lastSeen: Date;
};

/** Weight a contrast's recency mass by its pedagogical severity when ranking. */
const SEVERITY_WEIGHT: Record<Severity, number> = {
	critical: 3,
	major: 2,
	minor: 1,
	none: 0.5,
};

// Deletions/insertions carry no contrast severity (phone-hints returns "none" for
// them), so they get a fixed mode weight: an omitted target matters a bit more than an
// extra inserted sound, but neither outranks a confirmed critical substitution.
const DELETION_WEIGHT = 1.5;
const INSERTION_WEIGHT = 1.0;

// Vowel inventory the model emits — used only to tell epenthetic vowels (the classic
// Turkish-L1 cluster breaker, e.g. "street" → "sitreet") from inserted consonants, so
// the coaching copy can name the right pattern. Includes the lax/reduced set and the
// diphthongs we annotate with an offglide.
const VOWELS = new Set([
	"i",
	"ɪ",
	"e",
	"ɛ",
	"æ",
	"ə",
	"ʌ",
	"ɑ",
	"a",
	"ɔ",
	"o",
	"ʊ",
	"u",
	"ɜ",
	"ɚ",
	"ɝ",
	"eɪ",
	"aɪ",
	"ɔɪ",
	"oʊ",
	"aʊ",
]);
function isVowel(tok: string | null | undefined): boolean {
	return !!tok && VOWELS.has(tok);
}

/** Shape a compact aggregate as the minimal PhonemeError the `phone-hints` helpers read
 * (errorType, expected, actual, featureDistance, featureDelta, uncertain). */
function toError(a: ChallengeAggregate): PhonemeError {
	return {
		errorType: a.errorType,
		expected: a.expected,
		actual: a.actual,
		featureDistance: a.avgDistance,
		featureDelta: a.sampleDelta,
		uncertain: a.uncertainCount > 0,
	} as PhonemeError;
}

/** A single ranked entry in the profile (a contrast pair, a dropped phone, or an added
 * phone). `severity` is "none" for deletions/insertions — they're colored by mode. */
export type ProfileItem = {
	key: string;
	/** Display label: "θ → s" (sub), "θ" (delete), "ɪ" (insert). */
	label: string;
	mode: ErrorMode;
	expected: string | null;
	actual: string | null;
	severity: Severity;
	hint: string | null;
	/** Plain-language feature categories that differ (substitutions only). */
	categories: string[];
	count: number;
	/** Ranking score = recencyWeight × mode/severity weight. */
	weight: number;
	lastSeen: Date;
	/** Insertions only: whether the added phone is a vowel (epenthesis). */
	isVowel?: boolean;
};

export type CategoryStat = {
	category: string;
	weight: number;
	count: number;
};

export type PronunciationProfile = {
	/** Substitutions + deletions, recency×severity ranked. */
	toMaster: ProfileItem[];
	/** Insertions (epenthesis-forward), recency ranked. */
	added: ProfileItem[];
	/** Higher-level "what kind of difference" rollup across all modes. */
	categories: CategoryStat[];
	/** Pre-truncation counts so the UI can say "+3 more". */
	totals: { toMaster: number; added: number };
};

const byWeight = (x: ProfileItem, y: ProfileItem) =>
	y.weight - x.weight || y.count - x.count;

/**
 * Turn the compact DB aggregates into the two-axis, severity-ranked profile the summary
 * page renders. Pure — no I/O — so it runs on the server (in the summary server fn) and
 * is unit-testable in isolation.
 */
export function buildPronunciationProfile(
	aggregates: ChallengeAggregate[],
	opts?: { maxPerSection?: number; maxCategories?: number },
): PronunciationProfile {
	const maxPerSection = opts?.maxPerSection ?? 8;
	const maxCategories = opts?.maxCategories ?? 5;

	const toMaster: ProfileItem[] = [];
	const added: ProfileItem[] = [];
	const categoryWeight = new Map<string, { weight: number; count: number }>();
	const bump = (cat: string, weight: number, count: number) => {
		const cur = categoryWeight.get(cat) ?? { weight: 0, count: 0 };
		cur.weight += weight;
		cur.count += count;
		categoryWeight.set(cat, cur);
	};

	for (const a of aggregates) {
		if (a.errorType === "substitute") {
			if (!a.expected || !a.actual) continue;
			const err = toError(a);
			const severity = severityFor(err);
			const { hint } = coachingFor(err);
			const categories = featureSummary(err);
			const weight = a.recencyWeight * SEVERITY_WEIGHT[severity];
			toMaster.push({
				key: `sub:${a.expected}→${a.actual}`,
				label: `${a.expected} → ${a.actual}`,
				mode: "substitute",
				expected: a.expected,
				actual: a.actual,
				severity,
				hint,
				categories,
				count: a.count,
				weight,
				lastSeen: a.lastSeen,
			});
			for (const c of categories) bump(c, weight, a.count);
		} else if (a.errorType === "delete") {
			if (!a.expected) continue;
			const weight = a.recencyWeight * DELETION_WEIGHT;
			toMaster.push({
				key: `del:${a.expected}`,
				label: a.expected,
				mode: "delete",
				expected: a.expected,
				actual: null,
				severity: "none",
				hint: `You tend to drop /${a.expected}/ — make sure it's fully pronounced, especially at the ends of words and in clusters.`,
				categories: [],
				count: a.count,
				weight,
				lastSeen: a.lastSeen,
			});
			bump("dropped sounds", weight, a.count);
		} else {
			if (!a.actual) continue;
			const vowel = isVowel(a.actual);
			const weight = a.recencyWeight * INSERTION_WEIGHT;
			added.push({
				key: `ins:${a.actual}`,
				label: a.actual,
				mode: "insert",
				expected: null,
				actual: a.actual,
				severity: "none",
				hint: vowel
					? `You add an extra /${a.actual}/ vowel that isn't in the word. Turkish breaks up consonant clusters with a vowel, but English keeps them together — say "street", not "sitreet".`
					: `You add an extra /${a.actual}/ that isn't in the word — keep the surrounding sounds connected without inserting it.`,
				categories: [],
				count: a.count,
				weight,
				lastSeen: a.lastSeen,
				isVowel: vowel,
			});
			bump(
				vowel ? "added vowels (epenthesis)" : "added consonants",
				weight,
				a.count,
			);
		}
	}

	const categories: CategoryStat[] = [...categoryWeight.entries()]
		.map(([category, v]) => ({ category, weight: v.weight, count: v.count }))
		.sort((a, b) => b.weight - a.weight)
		.slice(0, maxCategories);

	return {
		toMaster: [...toMaster].sort(byWeight).slice(0, maxPerSection),
		added: [...added].sort(byWeight).slice(0, maxPerSection),
		categories,
		totals: { toMaster: toMaster.length, added: added.length },
	};
}
