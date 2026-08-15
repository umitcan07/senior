// Human-readable labels for filter-tree keys and areas, plus small formatters.

import type { AreaKey, ErrorType } from "./types";

const CLASS_LABELS: Record<string, string> = {
	// manner
	"manner:plosive": "Plosives",
	"manner:fricative": "Fricatives",
	"manner:affricate": "Affricates",
	"manner:nasal": "Nasals",
	"manner:lateral": "Laterals",
	"manner:approximant": "Approximants",
	"manner:trill": "Trills",
	"manner:tap": "Taps",
	"manner:diphthong": "Diphthongs",
	// place
	"place:bilabial": "Bilabial",
	"place:labiodental": "Labiodental",
	"place:dental": "Dental",
	"place:alveolar": "Alveolar",
	"place:postalveolar": "Post-alveolar",
	"place:palatal": "Palatal",
	"place:velar": "Velar",
	"place:labial-velar": "Labial-velar",
	"place:glottal": "Glottal",
	// voicing
	"voicing:voiced": "Voiced",
	"voicing:voiceless": "Voiceless",
	// vowel axes
	"height:close": "Close",
	"height:near-close": "Near-close",
	"height:close-mid": "Close-mid",
	"height:mid": "Mid",
	"height:open-mid": "Open-mid",
	"height:near-open": "Near-open",
	"height:open": "Open",
	"backness:front": "Front",
	"backness:central": "Central",
	"backness:back": "Back",
	"rounding:rounded": "Rounded",
	"rounding:unrounded": "Unrounded",
	"tenseness:tense": "Tense",
	"tenseness:lax": "Lax",
	"contrast:missing-in-turkish": "Absent in Turkish",
};

export const CLASS_GROUP_ORDER = [
	"manner",
	"place",
	"voicing",
	"height",
	"backness",
	"rounding",
	"tenseness",
	"contrast",
];

export const CLASS_GROUP_LABELS: Record<string, string> = {
	manner: "Manner",
	place: "Place",
	voicing: "Voicing",
	height: "Height",
	backness: "Backness",
	rounding: "Rounding",
	tenseness: "Tenseness",
	contrast: "Contrast",
};

export function classLabel(key: string): string {
	return CLASS_LABELS[key] ?? key.split(":").pop() ?? key;
}

export function classGroup(key: string): string {
	return key.split(":")[0] ?? "";
}

export const AREA_LABELS: Record<AreaKey, string> = {
	vowels: "Vowels",
	consonants: "Consonants",
	"lexical-stress": "Lexical Stress",
	linking: "Linking",
	rhythm: "Rhythm",
	intonation: "Intonation",
};

export const AREA_BLURBS: Record<AreaKey, string> = {
	vowels: "Annotated vowel productions and corpus-native correctness judgments.",
	consonants: "Manner, place and voicing — including the sounds Turkish lacks.",
	"lexical-stress":
		"Hand-annotated lexical-stress judgments from CORPTES.",
	linking: "Hand-annotated word-boundary linking judgments in connected speech.",
	rhythm:
		"Durational measures (%V, nPVI, Varco) — reported, not graded.",
	intonation: "Hand-annotated intonation judgments with pitch contours for inspection.",
};

export const ERROR_LABELS: Record<ErrorType, string> = {
	correct: "Correct",
	substitute: "Incorrect",
	delete: "Omitted",
	insert: "Inserted",
};

export function pct(x: number | null, digits = 0): string {
	if (x === null || Number.isNaN(x)) return "—";
	return `${(x * 100).toFixed(digits)}%`;
}

export function num(x: number | null, digits = 1): string {
	if (x === null || x === undefined || Number.isNaN(x)) return "—";
	return x.toFixed(digits);
}

export function slashed(phone: string | null): string {
	if (!phone) return "∅";
	return `/${phone}/`;
}
