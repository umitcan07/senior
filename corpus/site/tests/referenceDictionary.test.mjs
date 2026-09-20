import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
const dictionary = JSON.parse(readFileSync(new URL("../src/data/reference-pronunciations.json", import.meta.url), "utf8"));
test("public dictionary preserves IPA alternatives, vowel stress and provenance", () => {
	assert.deepEqual(dictionary.entries.birthday, [{ ipa: "bɝθdeɪ", stress: ["primary", "secondary"] }]);
	assert.deepEqual(dictionary.entries.forest.map((v) => v.ipa), ["fɔɹəst", "fɔɹɪst"]);
	assert.ok(dictionary.entries.forest.every((v) => v.stress.join(",") === "primary,unstressed"));
	assert.equal(dictionary.source.version, "3.0.0");
	assert.equal(dictionary.source.license, "CC BY 4.0");
	assert.equal(dictionary.source.sha256, "e8c6c7b036ae2b7c78d2768b8dc6b1f9359175b842956d00b48c53c9c332e6b0");
});
test("unsupported word forms stay unmatched and no ARPABET leaks into IPA", () => {
	assert.deepEqual(dictionary.unmatched, ["2", "3rd", "large-"]);
	for (const word of dictionary.unmatched) assert.equal(dictionary.entries[word], undefined);
	for (const variants of Object.values(dictionary.entries)) {
		assert.ok(variants.length > 0);
		for (const variant of variants) {
			assert.doesNotMatch(variant.ipa, /[A-Z0-9]/);
			assert.ok(variant.stress.every((s) => ["primary", "secondary", "unstressed"].includes(s)));
		}
	}
});
