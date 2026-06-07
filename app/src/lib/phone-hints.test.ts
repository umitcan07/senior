import { describe, expect, it } from "vitest";

import type { PhonemeError } from "@/db/types";
import {
	coachingFor,
	featureSummary,
	focusContrasts,
	hintFor,
	severityFor,
	severityRingVariants,
} from "./phone-hints";

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

describe("severityFor", () => {
	it("curated §4 pair overrides distance (θ→s is critical despite a small cost)", () => {
		expect(
			severityFor(
				sub({ expected: "θ", actual: "s", featureDistance: "0.167" }),
			),
		).toBe("critical");
	});

	it("uncurated far substitution (Δ≥7) → major", () => {
		expect(
			severityFor(
				sub({ expected: "p", actual: "i", featureDistance: "0.750" }),
			),
		).toBe("major");
	});

	it("uncurated near-miss (Δ≤3) → minor", () => {
		expect(
			severityFor(
				sub({ expected: "t", actual: "d", featureDistance: "0.083" }),
			),
		).toBe("minor");
	});

	it("insert / delete → none", () => {
		expect(severityFor(sub({ errorType: "insert", actual: "h" }))).toBe("none");
		expect(severityFor(sub({ errorType: "delete", expected: "h" }))).toBe(
			"none",
		);
	});

	it("no feature data (pre-Phase-2 row) and uncurated → none", () => {
		expect(
			severityFor(sub({ expected: "x", actual: "y", featureDistance: null })),
		).toBe("none");
	});

	it("is directional: θ→s is curated, s→θ falls back to the distance bucket", () => {
		expect(
			severityFor(
				sub({ expected: "s", actual: "θ", featureDistance: "0.167" }),
			),
		).toBe("minor");
	});
});

describe("hintFor", () => {
	it("returns the curated specific cue for a known pair", () => {
		expect(
			hintFor(sub({ expected: "w", actual: "v", featureDistance: "0.583" })),
		).toMatch(/lips/i);
	});

	it("builds a feature-category line for an uncurated pair with a delta", () => {
		const h = hintFor(
			sub({
				expected: "s",
				actual: "z",
				featureDistance: "0.083",
				featureDelta: [{ feature: "voi", ref: "-", user: "+" }],
			}),
		);
		expect(h).toMatch(/voicing/);
	});

	it("falls back to a distance line when there is no delta (uncovered phone)", () => {
		const h = hintFor(
			sub({ expected: "eɪ", actual: "x", featureDistance: "2.000" }),
		);
		expect(h).toMatch(/clearly different/i);
	});

	it("returns null for insert/delete and for no-data rows", () => {
		expect(hintFor(sub({ errorType: "insert", actual: "h" }))).toBeNull();
		expect(hintFor(sub({ expected: "x", actual: "y" }))).toBeNull();
	});
});

describe("featureSummary", () => {
	it("maps PanPhon feature names to plain categories", () => {
		expect(
			featureSummary(
				sub({
					expected: "s",
					actual: "z",
					featureDelta: [{ feature: "voi", ref: "-", user: "+" }],
				}),
			),
		).toEqual(["voicing"]);
	});

	it("dedupes the place features into one category and caps the list", () => {
		const cats = featureSummary(
			sub({
				expected: "a",
				actual: "b",
				featureDelta: [
					{ feature: "ant", ref: "-", user: "+" },
					{ feature: "cor", ref: "-", user: "+" },
					{ feature: "distr", ref: "0", user: "-" },
					{ feature: "voi", ref: "+", user: "-" },
					{ feature: "nas", ref: "-", user: "+" },
					{ feature: "round", ref: "-", user: "+" },
				],
			}),
			3,
		);
		expect(cats).toContain("place of articulation");
		expect(cats.length).toBeLessThanOrEqual(3);
		// "place of articulation" appears once despite three place features.
		expect(cats.filter((c) => c === "place of articulation")).toHaveLength(1);
	});

	it("detects rhoticity from the token (no single PanPhon feature for it)", () => {
		expect(
			featureSummary(sub({ expected: "ɹ", actual: "ə", featureDelta: [] })),
		).toContain("rhoticity");
		expect(
			featureSummary(sub({ expected: "ə˞", actual: "ə", featureDelta: [] })),
		).toContain("rhoticity");
	});
});

describe("coachingFor", () => {
	it("softens the hint when the model was uncertain, keeping severity", () => {
		const c = coachingFor(
			sub({
				expected: "θ",
				actual: "s",
				featureDistance: "0.167",
				uncertain: true,
			}),
		);
		expect(c.severity).toBe("critical");
		expect(c.softened).toBe(true);
		expect(c.hint).toMatch(/weren't fully sure/i);
	});

	it("does not soften a confident error", () => {
		const c = coachingFor(
			sub({
				expected: "θ",
				actual: "s",
				featureDistance: "0.167",
				uncertain: false,
			}),
		);
		expect(c.softened).toBe(false);
		expect(c.hint).toMatch(/tongue/i);
	});
});

describe("focusContrasts", () => {
	it("keeps critical/major, dedupes by pair, orders critical first", () => {
		const errors = [
			sub({ expected: "t", actual: "d", featureDistance: "0.083" }), // minor → excluded
			sub({ expected: "p", actual: "i", featureDistance: "0.750" }), // major (uncurated)
			sub({ expected: "θ", actual: "s", featureDistance: "0.167" }), // critical
			sub({ expected: "θ", actual: "s", featureDistance: "0.167" }), // dup → collapsed
			sub({ errorType: "insert", actual: "h" }), // none → excluded
		];
		const out = focusContrasts(errors);
		expect(out.map((f) => f.severity)).toEqual(["critical", "major"]);
		expect(out[0].contrast).toBe("θ → s");
	});
});

describe("severityRingVariants", () => {
	it("adds a ring for critical/major, nothing for minor/none", () => {
		expect(severityRingVariants({ severity: "critical" })).toContain("ring-2");
		expect(severityRingVariants({ severity: "major" })).toContain("ring-1");
		expect(severityRingVariants({ severity: "minor" })).not.toContain("ring");
		expect(severityRingVariants({ severity: "none" })).not.toContain("ring");
	});
});
