// Selection ⇄ URL hash, so any view is a shareable link.
//
// Hash, not path or query: the site is served from arbitrary subfolders (base
// is "./"), so paths would need server rewrites, and a hash survives static
// hosting everywhere. Format:
//
//   #/about
//   #/consonants
//   #/consonants/class/manner:plosive
//   #/consonants/phone/b
//   #/vowels/phone/ɪ
//
// Values are encodeURIComponent'd; IPA is legal in a fragment either way, but
// the class keys contain ":".

import type { Selection } from "@/App";
import type { View } from "@/components/Masthead";
import type { AreaKey } from "./types";

const AREAS: AreaKey[] = [
	"vowels",
	"consonants",
	"lexical-stress",
	"linking",
	"rhythm",
	"intonation",
];

export interface UrlState {
	view: View;
	sel: Selection;
}

const DEFAULT: UrlState = {
	view: "explore",
	sel: { area: "consonants", classKey: null, phone: null },
};

export function parseHash(hash: string): UrlState {
	const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
	if (parts.length === 0) return DEFAULT;

	if (parts[0] === "about") return { ...DEFAULT, view: "about" };

	const area = decodeURIComponent(parts[0] ?? "");
	if (!AREAS.includes(area as AreaKey)) return DEFAULT;

	const sel: Selection = { area: area as AreaKey, classKey: null, phone: null };
	const kind = parts[1];
	const value = parts[2] ? decodeURIComponent(parts[2]) : null;
	if (kind === "class" && value) sel.classKey = value;
	if (kind === "phone" && value) sel.phone = value;
	return { view: "explore", sel };
}

export function toHash(state: UrlState): string {
	if (state.view === "about") return "#/about";
	const { area, classKey, phone } = state.sel;
	if (phone) return `#/${area}/phone/${encodeURIComponent(phone)}`;
	if (classKey) return `#/${area}/class/${encodeURIComponent(classKey)}`;
	return `#/${area}`;
}

export function readUrl(): UrlState {
	return parseHash(window.location.hash);
}

/** replaceState, not pushState: every filter click as a history entry would
 * make Back useless. The URL is a bookmark of "where am I", not a journal. */
export function writeUrl(state: UrlState): void {
	const next = toHash(state);
	if (window.location.hash !== next) {
		history.replaceState(null, "", next);
	}
}
