// Accent / dialect display metadata.
//
// We support two accents. The DB (`reference_speeches.dialect`) stores the
// codes `'genam'` / `'rp'`; all human-readable naming lives here in the app
// layer. This is the single source of truth for accent labels and flags —
// don't hardcode accent strings elsewhere.

export type Dialect = "us" | "uk";

/** Dialect codes as stored in the DB `dialectEnum` ("genam" | "rp"). */
export type DialectDbCode = "genam" | "rp";

export interface DialectInfo {
	code: Dialect;
	/** DB enum value stored in `reference_speeches.dialect`. */
	dbCode: DialectDbCode;
	/** Country flag emoji. */
	flag: string;
	/** Compact label for chips / space-constrained UI, e.g. "American English". */
	short: string;
	/** Full label including the technical term, e.g. "American English (General American)". */
	label: string;
}

export const DIALECTS: Record<Dialect, DialectInfo> = {
	us: {
		code: "us",
		dbCode: "genam",
		flag: "🇺🇸",
		short: "American English",
		label: "American English (General American)",
	},
	uk: {
		code: "uk",
		dbCode: "rp",
		flag: "🇬🇧",
		short: "British English",
		label: "British English (Received Pronunciation)",
	},
};

const DB_CODE_MAP: Record<DialectDbCode, Dialect> = {
	genam: "us",
	rp: "uk",
};

/** Map a DB dialect code to its DialectInfo. Returns null for unknown/null input. */
export function dialectFromDbCode(
	code: DialectDbCode | string | null | undefined,
): DialectInfo | null {
	if (!code) return null;
	const appCode = DB_CODE_MAP[code as DialectDbCode];
	return appCode ? DIALECTS[appCode] : null;
}

/**
 * Map a freeform `authors.accent` string (e.g. "General American") to its
 * short display label. Falls back to the raw value when unknown.
 */
export function formatAccent(accent: string | null | undefined): string {
	if (!accent) return "";
	const found = DIALECT_LIST.find(
		(d) => d.label.includes(accent) || d.short === accent,
	);
	return found ? found.short : accent;
}

/** Stable iteration order for selectors / toggles. */
export const DIALECT_LIST: DialectInfo[] = [DIALECTS.us, DIALECTS.uk];
