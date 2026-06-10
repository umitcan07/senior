import type { PhonemeError, WordError } from "@/db/types";
import { CATEGORY_ORDER, FEATURE_CATEGORY, isRhotic } from "@/lib/phone-hints";

/**
 * E7.6 follow-up — per-feature explanation cards.
 *
 * `hintFor` can only say "Mainly a difference in voicing" for uncurated pairs. These
 * cards turn each differing feature *category* into a small teachable unit: what the
 * feature is, what to physically do, and an example pair. Crucially they are
 * DIRECTION-AWARE: the worker's `featureDelta` carries ternary ref/user values
 * (`{feature:"voi", ref:"+", user:"-"}`), so we can tell "switch your voice ON"
 * apart from "switch it OFF" instead of the vague "voicing differs".
 *
 * Like the curated contrast table, this copy is a frontend-only artifact — iterate
 * freely without touching the worker.
 */

export interface FeatureCard {
	/** Plain-language category, also the popover card title (e.g. "voicing"). */
	category: string;
	/** One sentence: what this articulatory dimension is. */
	what: string;
	/** Imperative, physical instruction — resolved for direction when possible. */
	action: string;
	/** A short example or minimal pair the learner can try. */
	example: string;
}

interface CardSpec {
	what: string;
	example: string;
	/** Direction-resolved actions: target HAS the feature (ref "+") vs LACKS it. */
	plus?: string;
	minus?: string;
	/** Fallback when direction is unknown or the category isn't binary. */
	action: string;
}

/** Copy per category. `plus` = the target sound HAS the feature (you must add it),
 * `minus` = the target LACKS it (you must drop it). */
const CARD_SPECS: Record<string, CardSpec> = {
	voicing: {
		what: "Whether your vocal cords vibrate while you make the sound.",
		plus: "Switch your voice ON: rest your fingers on your throat — you should feel a buzz, like in /z/ or /b/.",
		minus:
			"Switch your voice OFF: keep the same mouth shape but push only air, no buzz — like /s/ or /p/.",
		action:
			"Check the buzz: rest your fingers on your throat — voiced sounds (/z/, /b/) vibrate, voiceless ones (/s/, /p/) don't.",
		example: "sue ↔ zoo, bet ↔ bed",
	},
	nasality: {
		what: "Whether the air flows out through your nose or your mouth.",
		plus: "Let the air flow through your nose, like /m/, /n/ or the 'ng' in 'sing' — pinch your nose and the sound should change.",
		minus:
			"Keep the air out of your nose: release it through the mouth only — pinching your nose should change nothing.",
		action:
			"Pinch-test it: nasal sounds (/m/, /n/, 'ng') change when you pinch your nose; oral sounds don't.",
		example: "bat ↔ mat",
	},
	"lip rounding": {
		what: "The shape of your lips while making the sound.",
		plus: "Round your lips into a small circle, as for /w/ or the vowel in 'food'.",
		minus:
			"Relax or spread your lips — no rounding, as in 'see' or /v/-free sounds.",
		action:
			"Watch your lips in a mirror: rounded for /w/ and 'food', spread for 'see'.",
		example: "vest ↔ west",
	},
	"place of articulation": {
		what: "Where in the mouth the sound is made — lips, teeth, the ridge behind them, or further back.",
		action:
			"Move to the target spot: /θ/ ('think') needs the tongue tip at the teeth, /s/ sits just behind them, /k/ is made at the back.",
		example: "three ↔ tree, sink ↔ think",
	},
	"manner of articulation": {
		what: "What happens to the airflow — fully stopped, squeezed into friction, or left to glide.",
		action:
			"Match the airflow: stops cut the air (/t/, /d/), fricatives let it hiss through a narrow gap (/s/, /θ/), glides keep it open (/w/, /j/).",
		example: "think ↔ tink (friction became a full stop)",
	},
	"tongue position": {
		what: "How high or low, and how front or back, your tongue sits — this is what shapes each vowel.",
		action:
			"Adjust jaw and tongue: 'bat' /æ/ is low and front, 'but' /ʌ/ is mid and central. Exaggerate toward the reference, then relax.",
		example: "bat ↔ bet ↔ but",
	},
	stridency: {
		what: "How sharp and hissy the friction of the sound is.",
		action:
			"Tune the hiss: /s/ and /ʃ/ are loud and sharp; /θ/ and /f/ are soft and breathy. Match the target's noisiness.",
		example: "think ↔ sink",
	},
	tenseness: {
		what: "How much muscle effort the vowel takes — tense vowels are longer and more extreme.",
		plus: "Tense it: hold the vowel longer with firmer tongue muscles, like 'ee' in 'sheep'.",
		minus:
			"Relax it: make the vowel short and loose, like the 'i' in 'ship' — don't stretch it.",
		action:
			"Feel the effort: 'sheep' /iː/ is long and tense, 'ship' /ɪ/ is short and relaxed — keep them apart.",
		example: "ship ↔ sheep, full ↔ fool",
	},
	length: {
		what: "How long you hold the sound.",
		plus: "Hold it longer — stretch the sound noticeably.",
		minus: "Cut it shorter — a quick, light touch.",
		action:
			"Compare durations with the reference and match how long it's held.",
		example: "full ↔ fool",
	},
	"voice quality": {
		what: "Extra breath or throat tension riding on the sound.",
		action:
			"Mind the puff: English /p/, /t/, /k/ start words with a small burst of air (hold a paper strip in front of your lips — it should flick).",
		example: "pin (with a puff) ↔ bin",
	},
	rhoticity: {
		what: "The English r-colour: the tongue curls back and glides — it never taps the roof of the mouth.",
		action:
			"Curl your tongue tip up and back without touching anything, and let the sound glide — no tapping or trilling.",
		example: "red, car, bird",
	},
};

type DiffErrorLike = PhonemeError | WordError;

/** First ref-value per category, preserving worker order ("+", "-", or "0"). */
function directionByCategory(error: DiffErrorLike): Map<string, string> {
	const dirs = new Map<string, string>();
	if (!("featureDelta" in error) || error.featureDelta == null) return dirs;
	for (const d of error.featureDelta) {
		const cat = FEATURE_CATEGORY[d.feature];
		if (cat && !dirs.has(cat)) dirs.set(cat, d.ref);
	}
	return dirs;
}

/**
 * Explanation cards for the feature categories in which this substitution differs
 * from the target, ordered most-salient-first and capped at `limit`. Empty for
 * insert/delete, word diffs, and errors without a feature delta.
 */
export function featureCardsFor(
	error: DiffErrorLike,
	limit = 3,
): FeatureCard[] {
	if (error.errorType !== "substitute") return [];
	const dirs = directionByCategory(error);
	const cats = new Set<string>(dirs.keys());
	if (isRhotic(error.expected) !== isRhotic(error.actual)) {
		cats.add("rhoticity");
		// Direction: target rhotic → add the r-colour; covered by the generic action.
	}
	return [...cats]
		.sort((a, b) => {
			const ia = CATEGORY_ORDER.indexOf(a);
			const ib = CATEGORY_ORDER.indexOf(b);
			return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
		})
		.slice(0, limit)
		.flatMap((cat) => {
			const spec = CARD_SPECS[cat];
			if (!spec) return [];
			const dir = dirs.get(cat);
			const action =
				(dir === "+" ? spec.plus : dir === "-" ? spec.minus : undefined) ??
				spec.action;
			return [
				{ category: cat, what: spec.what, action, example: spec.example },
			];
		});
}
