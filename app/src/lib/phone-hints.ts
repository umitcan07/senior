import { cva, type VariantProps } from "class-variance-authority";

import type { PhonemeError, WordError } from "@/db/types";

/**
 * E7.6 / issue #57 — app-side severity + coaching-hint layer.
 *
 * The worker emits one number per substitution: `featureDistance` (an articulatory
 * PanPhon feature distance, 0–2, = 2·Δfeatures/24; identical = 0). This module turns
 * that number — plus a curated Turkish-L1 contrast table — into a pedagogical
 * `severity` and a plain-language `hint`, entirely on the client so coaching copy
 * iterates with a frontend deploy (no GPU worker rebuild).
 *
 * HYBRID severity (feasibility §3.4): a curated `(expected, actual)` table OVERRIDES
 * the distance bucket, because 10/13 core Turkish-L1 §4 contrasts are feature-*close*
 * (Δ≤3) yet pedagogically *critical* (θ→s, ð→d, æ→ɛ…). Pure feature distance would
 * wrongly downplay them, so "close (for alignment) ≠ ignorable (for reporting)".
 */

/**
 * Pedagogical severity of a substitution — distinct from the diff *color*
 * (substitute = red). Severity only modulates emphasis WITHIN the red family.
 *   critical → a textbook Turkish-L1 §4 error we always surface
 *   major    → articulatorily far (large feature distance), clearly audible
 *   minor    → articulatorily close near-miss (small feature distance)
 *   none     → not a scorable substitution (insert/delete, word diff, or no data)
 */
export type Severity = "critical" | "major" | "minor" | "none";

type DiffErrorLike = PhonemeError | WordError;

interface HintEntry {
	severity: Severity;
	/** Plain-language, imperative coaching cue. */
	hint: string;
	/** Short label for the focus strip, e.g. "θ → s". */
	contrast: string;
}

/**
 * Curated Turkish-L1 contrasts, keyed `"${expected}→${actual}"` (directional — the
 * cost is symmetric but coaching is "you said X, aim for Y"). Severity is asserted by
 * pedagogy, NOT by feature distance. Transcribed from `doc/e7.6_poc_results.md` §4,
 * `doc/V2_CONTEXT.md` §4, and issue #57. This table is the artifact to iterate before
 * the defense — editing it is a frontend-only change.
 */
const CONTRASTS: Record<string, HintEntry> = {
	// §4.1 consonants Turkish lacks — critical regardless of feature distance.
	"θ→t": {
		severity: "critical",
		contrast: "θ → t",
		hint: "Put your tongue tip between your teeth and blow — don't stop the air with a hard /t/.",
	},
	"θ→s": {
		severity: "critical",
		contrast: "θ → s",
		hint: "Push your tongue tip out between your teeth for 'th' — /s/ keeps the tongue behind the teeth.",
	},
	"ð→d": {
		severity: "critical",
		contrast: "ð → d",
		hint: "Voiced 'th' (this): tongue tip between the teeth with voice on — not a hard /d/.",
	},
	"ð→z": {
		severity: "critical",
		contrast: "ð → z",
		hint: "For voiced 'th', let your tongue tip touch the teeth edge — /z/ hides the tongue behind them.",
	},
	"w→v": {
		severity: "critical",
		contrast: "w → v",
		hint: "Round your lips for /w/ and keep your teeth off your lip — /v/ presses teeth to the lower lip.",
	},
	"ŋ→n": {
		severity: "critical",
		contrast: "ŋ → n",
		hint: "'ng' is one sound at the back of the mouth — don't switch to /n/ or add a hard /g/.",
	},
	"ɹ→ɾ": {
		severity: "critical",
		contrast: "ɹ → ɾ",
		hint: "English /r/ curls the tongue back without touching — avoid the quick Turkish tap.",
	},
	"ɹ→r": {
		severity: "critical",
		contrast: "ɹ → r",
		hint: "English /r/ is a smooth glide — don't trill or tap it like a Turkish 'r'.",
	},
	// §4.2 vowel collapses — meaning-bearing minimal pairs, critical though feature-close.
	"æ→a": {
		severity: "critical",
		contrast: "æ → a",
		hint: "The 'bat' vowel spreads the lips wider and lowers the jaw — it's brighter than Turkish 'a'.",
	},
	"æ→ɛ": {
		severity: "critical",
		contrast: "æ → ɛ",
		hint: "Keep 'bat' and 'bet' apart — /æ/ is lower and wider than /ɛ/.",
	},
	"ʌ→a": {
		severity: "critical",
		contrast: "ʌ → a",
		hint: "The 'but' vowel is central and relaxed — not the open Turkish 'a'.",
	},
	"ɪ→i": {
		severity: "critical",
		contrast: "ɪ → i",
		hint: "'ship' is short and lax; 'sheep' is long and tense — keep them distinct.",
	},
	"ʊ→u": {
		severity: "critical",
		contrast: "ʊ → u",
		hint: "'full' is short and lax; 'fool' is long and tense — don't merge them.",
	},
	// One rung down — real but less minimal-pair-critical.
	"ə→a": {
		severity: "major",
		contrast: "ə → a",
		hint: "Unstressed vowels reduce to a soft 'uh' (schwa) — don't fully pronounce the written vowel.",
	},
	"ɛ→a": {
		severity: "major",
		contrast: "ɛ → a",
		hint: "The 'bet' vowel sits higher and more front than the open Turkish 'a'.",
	},
};

// Feature-distance buckets. cost = 2·(Δ/24): Δ3 → 0.25 (the "close" ceiling),
// Δ7 → ~0.583. Distance alone NEVER yields "critical" — only the curated table does.
const MINOR_MAX = 0.25; // Δ ≤ 3 — a close near-miss
const MAJOR_MIN = 0.58; // Δ ≥ 7 — clearly audible / far

/** Read featureDistance as a number, tolerating Drizzle's decimal string + null. */
function distanceOf(error: DiffErrorLike): number | null {
	if (!("featureDistance" in error) || error.featureDistance == null)
		return null;
	const n = Number(error.featureDistance);
	return Number.isFinite(n) ? n : null;
}

/** Curated lookup key, or null if not a substitution with both phones present. */
function keyOf(error: DiffErrorLike): string | null {
	if (error.errorType !== "substitute" || !error.expected || !error.actual) {
		return null;
	}
	return `${error.expected}→${error.actual}`;
}

/** Per-error model uncertainty (PhonemeError only): "unsure what it heard here". */
function isUncertain(error: DiffErrorLike): boolean {
	return "uncertain" in error && error.uncertain === true;
}

function bucketByDistance(
	cost: number,
): Exclude<Severity, "none" | "critical"> {
	return cost >= MAJOR_MIN ? "major" : "minor";
}

/** PanPhon feature name → a plain-language category. Several features collapse to one
 * category (e.g. the place features). Anything unmapped is dropped from display. */
const FEATURE_CATEGORY: Record<string, string> = {
	voi: "voicing",
	nas: "nasality",
	round: "lip rounding",
	cont: "manner of articulation",
	delrel: "manner of articulation",
	son: "manner of articulation",
	cons: "manner of articulation",
	lat: "manner of articulation",
	strid: "stridency",
	ant: "place of articulation",
	cor: "place of articulation",
	distr: "place of articulation",
	lab: "place of articulation",
	hi: "tongue position",
	lo: "tongue position",
	back: "tongue position",
	tense: "tenseness",
	long: "length",
	sg: "voice quality",
	cg: "voice quality",
};

/** Display order so the summary reads most-salient-first. */
const CATEGORY_ORDER = [
	"rhoticity",
	"voicing",
	"place of articulation",
	"manner of articulation",
	"nasality",
	"lip rounding",
	"tongue position",
	"stridency",
	"tenseness",
	"length",
	"voice quality",
];

// PanPhon has no single "rhotic" feature, so detect it from the token (the ˞ hook
// or the rhotic phones) and surface it as its own category.
const RHOTIC = new Set(["ɹ", "ɾ", "r", "ɚ", "ɝ"]);
function isRhotic(tok: string | null | undefined): boolean {
	return !!tok && (tok.includes("˞") || RHOTIC.has(tok));
}

/** The structured feature delta (PhonemeError only); null otherwise. */
function deltaOf(
	error: DiffErrorLike,
): Array<{ feature: string; ref: string; user: string }> | null {
	if (!("featureDelta" in error) || error.featureDelta == null) return null;
	return error.featureDelta;
}

/**
 * Plain-language categories in which a substitution differs from the target, deduped
 * and ordered, capped to the top `limit`. Empty when there's no delta. Adds
 * "rhoticity" from the token (PanPhon can't express it as one feature).
 */
export function featureSummary(error: DiffErrorLike, limit = 3): string[] {
	if (error.errorType !== "substitute") return [];
	const cats = new Set<string>();
	if (isRhotic(error.expected) !== isRhotic(error.actual))
		cats.add("rhoticity");
	for (const d of deltaOf(error) ?? []) {
		const cat = FEATURE_CATEGORY[d.feature];
		if (cat) cats.add(cat);
	}
	return [...cats]
		.sort((a, b) => {
			const ia = CATEGORY_ORDER.indexOf(a);
			const ib = CATEGORY_ORDER.indexOf(b);
			return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
		})
		.slice(0, limit);
}

/** Join 1–3 category labels into readable prose ("voicing and place of articulation"). */
function joinCategories(cats: string[]): string {
	if (cats.length <= 1) return cats[0] ?? "";
	if (cats.length === 2) return `${cats[0]} and ${cats[1]}`;
	return `${cats.slice(0, -1).join(", ")}, and ${cats[cats.length - 1]}`;
}

/**
 * Hybrid severity: curated map FIRST (so θ→s is critical despite a small distance),
 * else the distance bucket, else `none` (insert/delete, word diff, or pre-Phase-2
 * rows with no distance).
 */
export function severityFor(error: DiffErrorLike): Severity {
	if (error.errorType !== "substitute") return "none";
	const key = keyOf(error);
	if (key && CONTRASTS[key]) return CONTRASTS[key].severity;
	const cost = distanceOf(error);
	if (cost == null) return "none";
	return bucketByDistance(cost);
}

/**
 * Coaching hint, in precedence order:
 *   1. curated §4 specific text (the pedagogically important pairs);
 *   2. a feature-category line built from the structured delta ("Mainly a difference
 *      in voicing and place of articulation");
 *   3. a generic distance-bucketed line (uncovered phones have a distance but no delta);
 *   4. null when there's nothing useful to say.
 */
export function hintFor(error: DiffErrorLike): string | null {
	if (error.errorType !== "substitute") return null;
	const key = keyOf(error);
	if (key && CONTRASTS[key]) return CONTRASTS[key].hint;

	const cats = featureSummary(error);
	if (cats.length > 0) {
		return `Mainly a difference in ${joinCategories(cats)} — compare with the reference.`;
	}

	const cost = distanceOf(error);
	if (cost == null) return null;
	if (cost >= MAJOR_MIN) {
		return "This sound is clearly different from the target — listen to the reference and match the mouth shape.";
	}
	if (cost > MINOR_MAX) {
		return "Close, but noticeably off — compare with the reference to fine-tune it.";
	}
	return "Very close — a small adjustment will match the target sound.";
}

function lowerFirst(s: string): string {
	return s.charAt(0).toLowerCase() + s.slice(1);
}

export interface PhoneCoaching {
	severity: Severity;
	/** Null when there's nothing to coach (insert/delete, word diff, no data). */
	hint: string | null;
	/** True when the model was unsure what it heard here — the hint is hedged. */
	softened: boolean;
}

/**
 * One call the renderer uses. Gating rule: we soften (hedge) the hint when the model
 * was locally `uncertain` (entropy over threshold — "unsure what it heard"), but we
 * NEVER suppress on a low GOP, because a low GOP IS the mispronunciation we want to
 * coach. Severity/styling are unchanged by softening.
 */
export function coachingFor(error: DiffErrorLike): PhoneCoaching {
	const severity = severityFor(error);
	let hint = hintFor(error);
	const softened = isUncertain(error);
	if (hint && softened) {
		hint = `We weren't fully sure what you said here, but it may help to: ${lowerFirst(hint)}`;
	}
	return { severity, hint, softened };
}

/** A deduped "focus area" for the analysis-page summary strip. */
export interface FocusContrast {
	/** Short directional label, e.g. "θ → s" (curated) or "/æ/ → /a/" (generic). */
	contrast: string;
	severity: Severity;
	hint: string | null;
}

/**
 * Critical/major contrasts present in this attempt, deduped by (expected, actual),
 * ordered critical-first. Drives the focus-areas strip on the analysis page.
 */
export function focusContrasts(errors: DiffErrorLike[]): FocusContrast[] {
	const byKey = new Map<string, FocusContrast>();
	for (const error of errors) {
		const severity = severityFor(error);
		if (severity !== "critical" && severity !== "major") continue;
		const key = keyOf(error);
		if (!key || byKey.has(key)) continue;
		const curated = CONTRASTS[key];
		byKey.set(key, {
			contrast: curated?.contrast ?? `/${error.expected}/ → /${error.actual}/`,
			severity,
			hint: hintFor(error),
		});
	}
	const order: Record<string, number> = { critical: 0, major: 1 };
	return [...byKey.values()].sort(
		(a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9),
	);
}

/**
 * Emphasis ring layered ON TOP of the red substitute color — never replaces it.
 * Additive: critical/major stand out; minor/none look exactly like today.
 */
export const severityRingVariants = cva("", {
	variants: {
		severity: {
			critical: "ring-2 ring-destructive/70 font-bold",
			major: "ring-1 ring-destructive/50",
			minor: "",
			none: "",
		},
	},
	defaultVariants: { severity: "none" },
});

export type SeverityVariantProps = VariantProps<typeof severityRingVariants>;
