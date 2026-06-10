import { describe, expect, it } from "vitest";

import type { PhonemeError } from "@/db/types";
import { featureCardsFor } from "./feature-cards";

/** Minimal PhonemeError factory — only the fields the module reads. */
function sub(p: Partial<PhonemeError>): PhonemeError {
	return {
		errorType: "substitute",
		expected: null,
		actual: null,
		featureDistance: null,
		featureDelta: null,
		uncertain: false,
		...p,
	} as PhonemeError;
}

describe("featureCardsFor", () => {
	it("is direction-aware: target voiced (ref +) → 'voice ON' instruction", () => {
		const cards = featureCardsFor(
			sub({
				expected: "z",
				actual: "s",
				featureDelta: [{ feature: "voi", ref: "+", user: "-" }],
			}),
		);
		expect(cards).toHaveLength(1);
		expect(cards[0].category).toBe("voicing");
		expect(cards[0].action).toMatch(/voice ON/);
	});

	it("is direction-aware: target voiceless (ref -) → 'voice OFF' instruction", () => {
		const cards = featureCardsFor(
			sub({
				expected: "s",
				actual: "z",
				featureDelta: [{ feature: "voi", ref: "-", user: "+" }],
			}),
		);
		expect(cards[0].action).toMatch(/voice OFF/);
	});

	it("collapses several place features into one card and orders categories", () => {
		const cards = featureCardsFor(
			sub({
				expected: "θ",
				actual: "k",
				featureDelta: [
					{ feature: "ant", ref: "+", user: "-" },
					{ feature: "cor", ref: "+", user: "-" },
					{ feature: "voi", ref: "-", user: "-" },
					{ feature: "nas", ref: "-", user: "+" },
				],
			}),
		);
		// voicing precedes place precedes nasality in CATEGORY_ORDER; place deduped.
		expect(cards.map((c) => c.category)).toEqual([
			"voicing",
			"place of articulation",
			"nasality",
		]);
	});

	it("caps the number of cards at the limit", () => {
		const cards = featureCardsFor(
			sub({
				expected: "a",
				actual: "m",
				featureDelta: [
					{ feature: "voi", ref: "+", user: "-" },
					{ feature: "nas", ref: "-", user: "+" },
					{ feature: "round", ref: "+", user: "-" },
					{ feature: "hi", ref: "-", user: "+" },
				],
			}),
			2,
		);
		expect(cards).toHaveLength(2);
	});

	it("adds a rhoticity card from the tokens even without a delta entry", () => {
		const cards = featureCardsFor(
			sub({ expected: "ɹ", actual: "ə", featureDelta: [] }),
		);
		expect(cards.map((c) => c.category)).toContain("rhoticity");
	});

	it("every card carries what/action/example copy", () => {
		const cards = featureCardsFor(
			sub({
				expected: "i",
				actual: "ɪ",
				featureDelta: [
					{ feature: "tense", ref: "+", user: "-" },
					{ feature: "hi", ref: "+", user: "0" },
				],
			}),
		);
		expect(cards.length).toBeGreaterThan(0);
		for (const c of cards) {
			expect(c.what).toBeTruthy();
			expect(c.action).toBeTruthy();
			expect(c.example).toBeTruthy();
		}
		// tense ref "+" resolves to the tense-direction instruction.
		const tense = cards.find((c) => c.category === "tenseness");
		expect(tense?.action).toMatch(/Tense it/);
	});

	it("returns nothing for insert/delete and for missing deltas", () => {
		expect(featureCardsFor(sub({ errorType: "insert", actual: "h" }))).toEqual(
			[],
		);
		expect(
			featureCardsFor(sub({ errorType: "delete", expected: "h" })),
		).toEqual([]);
		expect(
			featureCardsFor(sub({ expected: "x", actual: "y", featureDelta: null })),
		).toEqual([]);
	});
});
