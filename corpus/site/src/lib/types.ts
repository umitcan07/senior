// Mirrors the JSON contract emitted by corpus/scripts/site_build/emit.py.
// Keys are terse on purpose — the shards are large and served static.

export type ErrorType = "correct" | "substitute" | "delete" | "insert";
export type Area = "vowels" | "consonants";
export type AreaKey =
	| "vowels"
	| "consonants"
	| "lexical-stress"
	| "linking"
	| "rhythm"
	| "intonation";

export interface FilterClass {
	key: string; // e.g. "manner:fricative", "place:dental"
	phones: string[];
}

export interface SpeakerMeta {
	sex?: string;
	l1?: string[];
	l2?: string[];
	[key: string]: unknown; // arbitrary ud-information keys (age, CEFR, …)
}

/** CEFR band, if the .exb speakertable carried one. */
export function cefrOf(meta: SpeakerMeta | undefined): string | null {
	const v = meta?.learner_level_CEFR_conversion;
	return typeof v === "string" && v.trim() !== "" ? v : null;
}

export interface UtteranceIndexEntry {
	id: string;
	spk: string;
	task: string | null;
	text: string | null;
	dur: number | null;
}

export interface PhoneConfusion {
	[actual: string]: number;
}

export interface PhoneStat {
	phone: string;
	total: number;
	correct: number;
	substitute: number;
	delete: number;
	accuracy: number | null;
	confusions: PhoneConfusion;
}

export interface Manifest {
	build: {
		corpusId?: string;
		raw_dir?: string;
		files: number;
		utterances: number;
		pitchBackend: "parselmouth" | "numpy-autocorr" | "none";
		clips: boolean;
		/** True when built from demo_corpus.py — every figure is fabricated. */
		synthetic?: boolean;
	};
	areas: AreaKey[];
	filterTree: Record<Area, FilterClass[]>;
	speakers: Record<string, SpeakerMeta>;
	warnings: string[];
	utterances: UtteranceIndexEntry[];
	insertions: PhoneStat[];
}

export interface AreaStats {
	area: Area;
	phones: PhoneStat[];
}

export interface StressPhoneStat {
	phone: string;
	total: number;
	correct: number;
	mismatch: number;
}

export interface StressStats {
	area: "lexical-stress";
	total: number;
	correct: number;
	mismatch: number;
	marksPresent: boolean;
	byPhone: StressPhoneStat[];
}

export interface AnnotationStats {
	area: "linking" | "intonation";
	total: number;
	correct: number;
	incorrect: number;
}

export interface TokenRow {
	id: string;
	u: string; // utterance id
	spk: string; // speaker
	tgt: string | null; // target phone
	act: string | null; // actual phone
	e: ErrorType;
	t0: number; // relative to clip start
	t1: number;
	se?: boolean; // stress error
	le?: boolean; // length error
	w?: string; // word
	lc?: string; // KWIC left context — realised phones before this one
	rc?: string; // KWIC right context
}

export interface RhythmMetrics {
	nV: number;
	nC: number;
	percentV: number | null;
	deltaV: number | null;
	deltaC: number | null;
	varcoV: number | null;
	varcoC: number | null;
	npviV: number | null;
	rpviC: number | null;
}

export interface PitchContourData {
	times: number[];
	f0: (number | null)[];
	min: number | null;
	max: number | null;
	mean: number | null;
	finalSlope: number | null;
}

export interface UtteranceDetail {
	id: string;
	spk: string;
	task: string | null;
	text: string | null;
	dur: number;
	clip: string;
	audioAvailable?: boolean;
	aligned: boolean;
	tokens: (TokenRow & { st: number; sa: number })[];
	rhythm: RhythmMetrics;
	pitch: PitchContourData | null;
}
