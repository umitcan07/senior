import { describe, expect, it } from "vitest";

import {
	buildPronunciationProfile,
	type ChallengeAggregate,
} from "./phone-profile";

/** Minimal aggregate factory — only the fields the builder reads. */
function agg(p: Partial<ChallengeAggregate>): ChallengeAggregate {
	return {
		errorType: "substitute",
		expected: null,
		actual: null,
		count: 1,
		recencyWeight: 1,
		avgDistance: null,
		sampleDelta: null,
		uncertainCount: 0,
		lastSeen: new Date("2026-06-01T00:00:00Z"),
		...p,
	};
}

describe("buildPronunciationProfile — axis split", () => {
	it("puts a substitution in toMaster as a directional contrast with curated severity + hint", () => {
		const { toMaster } = buildPronunciationProfile([
			agg({ expected: "θ", actual: "s", avgDistance: "0.167" }),
		]);
		expect(toMaster).toHaveLength(1);
		expect(toMaster[0].mode).toBe("substitute");
		expect(toMaster[0].label).toBe("θ → s");
		expect(toMaster[0].severity).toBe("critical"); // curated overrides small distance
		expect(toMaster[0].hint).toMatch(/tongue/i);
	});

	it("puts a deletion in toMaster keyed by the dropped phone", () => {
		const { toMaster, added } = buildPronunciationProfile([
			agg({ errorType: "delete", expected: "t", actual: null }),
		]);
		expect(added).toHaveLength(0);
		expect(toMaster).toHaveLength(1);
		expect(toMaster[0].mode).toBe("delete");
		expect(toMaster[0].label).toBe("t");
		expect(toMaster[0].hint).toMatch(/drop/i);
	});

	it("puts an inserted vowel in added with an epenthesis hint", () => {
		const { added, toMaster } = buildPronunciationProfile([
			agg({ errorType: "insert", expected: null, actual: "ɪ" }),
		]);
		expect(toMaster).toHaveLength(0);
		expect(added).toHaveLength(1);
		expect(added[0].mode).toBe("insert");
		expect(added[0].isVowel).toBe(true);
		expect(added[0].hint).toMatch(/street|cluster|vowel/i);
	});

	it("classifies an inserted consonant as a non-vowel insertion", () => {
		const { added } = buildPronunciationProfile([
			agg({ errorType: "insert", expected: null, actual: "k" }),
		]);
		expect(added[0].isVowel).toBe(false);
	});
});

describe("buildPronunciationProfile — ranking", () => {
	it("orders critical above a minor near-miss regardless of count", () => {
		const { toMaster } = buildPronunciationProfile([
			agg({ expected: "t", actual: "d", avgDistance: "0.083", count: 9 }), // minor
			agg({ expected: "θ", actual: "s", avgDistance: "0.167", count: 1 }), // critical
		]);
		expect(toMaster.map((i) => i.label)).toEqual(["θ → s", "t → d"]);
	});

	it("breaks ties within a severity by recency weight", () => {
		const { toMaster } = buildPronunciationProfile([
			agg({ expected: "ð", actual: "d", avgDistance: "0.1", recencyWeight: 1 }),
			agg({ expected: "w", actual: "v", avgDistance: "0.1", recencyWeight: 5 }),
		]);
		// Both curated-critical → the higher recency weight sorts first.
		expect(toMaster[0].label).toBe("w → v");
	});

	it("truncates each section to maxPerSection and reports the remainder via totals", () => {
		const many = Array.from({ length: 10 }, (_, i) =>
			agg({ expected: "p", actual: `x${i}`, avgDistance: "0.75" }),
		);
		const { toMaster, totals } = buildPronunciationProfile(many, {
			maxPerSection: 8,
		});
		expect(toMaster).toHaveLength(8);
		expect(totals.toMaster).toBe(10);
	});
});

describe("buildPronunciationProfile — category rollup", () => {
	it("rolls up feature categories, epenthesis, and dropped sounds across modes", () => {
		const { categories } = buildPronunciationProfile([
			agg({
				expected: "s",
				actual: "z",
				avgDistance: "0.083",
				sampleDelta: [{ feature: "voi", ref: "-", user: "+" }],
			}),
			agg({ errorType: "insert", expected: null, actual: "ə" }),
			agg({ errorType: "delete", expected: "d", actual: null }),
		]);
		const names = categories.map((c) => c.category);
		expect(names).toContain("voicing");
		expect(names).toContain("added vowels (epenthesis)");
		expect(names).toContain("dropped sounds");
	});

	it("surfaces the differing feature categories on the substitution item", () => {
		const { toMaster } = buildPronunciationProfile([
			agg({
				expected: "s",
				actual: "z",
				avgDistance: "0.083",
				sampleDelta: [{ feature: "voi", ref: "-", user: "+" }],
			}),
		]);
		expect(toMaster[0].categories).toContain("voicing");
	});
});
