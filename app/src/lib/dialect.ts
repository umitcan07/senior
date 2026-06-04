// Accent / dialect display metadata.
//
// We only ever support two accents. The DB (`reference_speeches.dialect`)
// stores just the codes `'us'` / `'uk'`; all human-readable naming lives here
// in the app layer. This is the single source of truth for accent labels and
// flags — don't hardcode "US"/"UK"/"AmE"/"BrE" strings elsewhere.

export type Dialect = "us" | "uk";

export interface DialectInfo {
	code: Dialect;
	/** Country flag emoji. */
	flag: string;
	/** Compact label for chips / space-constrained UI, e.g. "GenAm". */
	short: string;
	/** Full human-readable accent name, e.g. "English (GenAm)". */
	label: string;
}

export const DIALECTS: Record<Dialect, DialectInfo> = {
	us: {
		code: "us",
		flag: "🇺🇸",
		short: "GenAm",
		label: "English (GenAm)",
	},
	uk: {
		code: "uk",
		flag: "🇬🇧",
		short: "RP",
		label: "British (RP)",
	},
};

/** Stable iteration order for selectors / toggles. */
export const DIALECT_LIST: DialectInfo[] = [DIALECTS.us, DIALECTS.uk];
