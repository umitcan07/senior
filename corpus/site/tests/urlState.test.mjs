import assert from "node:assert/strict";
import test from "node:test";
import { parseHash, toHash } from "../src/lib/urlState.ts";

test("existing single-phone and class links still work", () => {
	assert.deepEqual(parseHash("#/vowels/phone/%C9%AA").sel.phones, ["ɪ"]);
	assert.equal(parseHash("#/consonants/class/place%3Adental").sel.classKey, "place:dental");
	assert.equal(toHash(parseHash("#/vowels/phone/%C9%AA")), "#/vowels/phone/%C9%AA");
});

test("multiple IPA phones survive a shared-link round trip", () => {
	const state = {
		view: "explore",
		sel: { area: "vowels", classKey: null, phones: ["ɪ", "ɛ", "aɪ"] },
	};
	assert.deepEqual(parseHash(toHash(state)), state);
	assert.deepEqual(parseHash("#/vowels/phones/ɪ/ɛ/ɪ").sel.phones, ["ɪ", "ɛ"]);
});

test("malformed links safely fall back instead of crashing the explorer", () => {
	assert.deepEqual(parseHash("#/vowels/phone/%"), parseHash(""));
	assert.deepEqual(parseHash("#/unknown"), parseHash(""));
});
