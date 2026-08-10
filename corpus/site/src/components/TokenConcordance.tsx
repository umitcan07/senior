import { useEffect, useMemo, useState } from "react";
import {
	clearAnnotations,
	loadAnnotations,
	setAnnotation,
} from "@/lib/annotations";
import { type Column, downloadCsv, slugForFile, toCsv } from "@/lib/csv";
import { ERROR_LABELS } from "@/lib/labels";
import {
	cefrOf,
	type ErrorType,
	type SpeakerMeta,
	type TokenRow,
} from "@/lib/types";
import { errorColor, IPA } from "./ui";

type FilterMode = "all" | "incorrect" | ErrorType;
type SortKey =
	| "left"
	| "target"
	| "realised"
	| "right"
	| "word"
	| "speaker"
	| "outcome"
	| "time";
type Sort = { key: SortKey; dir: "asc" | "desc" } | null;

const MODES: { key: FilterMode; label: string }[] = [
	{ key: "all", label: "All" },
	{ key: "incorrect", label: "Incorrect only" },
	{ key: "correct", label: "Correct" },
	{ key: "substitute", label: "Substituted" },
	{ key: "delete", label: "Omitted" },
];

const PAGE = 60;
const ANY = "__any__";

/** The fields a search query is matched against, tested one at a time.
 *
 * Deliberately a list, not a joined blob: a query is a hit when it matches any
 * single field, so an anchored regex like `^(bit|job)$` means "this word,
 * exactly" the way it would in EXAKT. Against a concatenated string those
 * anchors could never match.
 */
function searchFields(t: TokenRow): string[] {
	return [t.tgt, t.act, t.w, t.spk, t.lc, t.rc].filter(
		(v): v is string => typeof v === "string" && v !== "",
	);
}

/** Concordance convention: context sorts outward from the hit, not left-to-right.
 *
 * Sorting the left context by its raw string would group by the phone furthest
 * from the target, which tells you nothing. Reversing it first (EXAKT's
 * "word-wise reversed" sort) groups by the immediately preceding phone, which is
 * how conditioning environments become visible.
 */
function outward(context: string | undefined, reverse: boolean): string {
	if (!context) return "";
	const phones = context.split(" ");
	return (reverse ? phones.reverse() : phones).join(" ");
}

function sortValue(t: TokenRow, key: SortKey): string | number {
	switch (key) {
		case "left":
			return outward(t.lc, true);
		case "right":
			return outward(t.rc, false);
		case "target":
			return t.tgt ?? "";
		case "realised":
			return t.act ?? "";
		case "word":
			return t.w ?? "";
		case "speaker":
			return t.spk;
		case "outcome":
			return ERROR_LABELS[t.e];
		case "time":
			return t.t0;
	}
}

export function TokenConcordance({
	tokens,
	speakers,
	onOpen,
	exportName = "tokens",
}: {
	tokens: TokenRow[];
	speakers: Record<string, SpeakerMeta>;
	onOpen: (id: string, focusToken?: string) => void;
	/** Stem for the exported CSV filename, e.g. the phone being drilled. */
	exportName?: string;
}) {
	const [mode, setMode] = useState<FilterMode>("all");
	const [sex, setSex] = useState<string>(ANY);
	const [cefr, setCefr] = useState<string>(ANY);
	const [query, setQuery] = useState("");
	const [useRegex, setUseRegex] = useState(false);
	const [sort, setSort] = useState<Sort>(null);
	const [limit, setLimit] = useState(PAGE);
	const [notes, setNotes] = useState<Record<string, string>>({});

	useEffect(() => {
		setNotes(loadAnnotations());
	}, []);

	// Offer only the speaker attributes that actually occur in these tokens —
	// a CEFR band with no rows behind it is a dead end for the user.
	const { sexes, cefrs } = useMemo(() => {
		const present = new Set(tokens.map((t) => t.spk));
		const s = new Set<string>();
		const c = new Set<string>();
		for (const id of present) {
			const meta = speakers[id];
			if (meta?.sex && meta.sex !== "u") s.add(meta.sex);
			const level = cefrOf(meta);
			if (level) c.add(level);
		}
		return { sexes: [...s].sort(), cefrs: [...c].sort() };
	}, [tokens, speakers]);

	// A bad regex is a half-typed one, not an error worth shouting about — keep
	// the previous result set on screen and flag the box until it parses.
	const { matcher, regexError } = useMemo(() => {
		const q = query.trim();
		if (q === "") return { matcher: null, regexError: false };
		if (!useRegex) {
			const lower = q.toLowerCase();
			return {
				matcher: (fields: string[]) =>
					fields.some((f) => f.toLowerCase().includes(lower)),
				regexError: false,
			};
		}
		try {
			const re = new RegExp(q, "iu");
			return {
				matcher: (fields: string[]) => fields.some((f) => re.test(f)),
				regexError: false,
			};
		} catch {
			return { matcher: null, regexError: true };
		}
	}, [query, useRegex]);

	const filtered = useMemo(() => {
		const rows = tokens.filter((t) => {
			if (mode === "incorrect" && t.e === "correct") return false;
			if (mode !== "all" && mode !== "incorrect" && t.e !== mode) return false;
			if (sex !== ANY && speakers[t.spk]?.sex !== sex) return false;
			if (cefr !== ANY && cefrOf(speakers[t.spk]) !== cefr) return false;
			if (matcher && !matcher(searchFields(t))) return false;
			return true;
		});

		if (!sort) return rows;
		const sign = sort.dir === "asc" ? 1 : -1;
		return [...rows].sort((a, b) => {
			const va = sortValue(a, sort.key);
			const vb = sortValue(b, sort.key);
			if (typeof va === "number" && typeof vb === "number") {
				return (va - vb) * sign;
			}
			return String(va).localeCompare(String(vb)) * sign;
		});
	}, [tokens, speakers, mode, sex, cefr, matcher, sort]);

	const shown = filtered.slice(0, limit);
	const narrowed = filtered.length !== tokens.length;
	const noteCount = Object.keys(notes).length;

	function reset<T>(setter: (v: T) => void) {
		return (v: T) => {
			setter(v);
			setLimit(PAGE);
		};
	}

	function toggleSort(key: SortKey) {
		setSort((s) =>
			s?.key === key
				? { key, dir: s.dir === "asc" ? "desc" : "asc" }
				: { key, dir: "asc" },
		);
	}

	function onNote(tokenId: string, value: string) {
		setNotes(setAnnotation(tokenId, value));
	}

	function exportCsv() {
		const columns: Column<TokenRow>[] = [
			{ header: "left_context", value: (t) => t.lc ?? "" },
			{ header: "target", value: (t) => t.tgt ?? "" },
			{ header: "realised", value: (t) => t.act ?? "" },
			{ header: "right_context", value: (t) => t.rc ?? "" },
			{ header: "outcome", value: (t) => ERROR_LABELS[t.e] },
			{ header: "word", value: (t) => t.w ?? "" },
			{ header: "speaker", value: (t) => t.spk },
			{ header: "sex", value: (t) => speakers[t.spk]?.sex ?? "" },
			{ header: "cefr", value: (t) => cefrOf(speakers[t.spk]) ?? "" },
			{ header: "stress_mismatch", value: (t) => (t.se ? "yes" : "no") },
			{ header: "length_mismatch", value: (t) => (t.le ? "yes" : "no") },
			{ header: "note", value: (t) => notes[t.id] ?? "" },
			{ header: "utterance", value: (t) => t.u },
			{ header: "start_s", value: (t) => t.t0.toFixed(3) },
			{ header: "end_s", value: (t) => t.t1.toFixed(3) },
		];
		downloadCsv(
			`corptes-${slugForFile(exportName)}.csv`,
			toCsv(filtered, columns),
		);
	}

	if (tokens.length === 0) {
		return (
			<div className="rounded-[var(--radius-card)] border border-[var(--color-rule)] border-dashed p-6 text-center text-[var(--color-ink-faint)] text-sm">
				No aligned tokens for this phone.
			</div>
		);
	}

	return (
		<div>
			<div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
				<div className="flex flex-wrap gap-1">
					{MODES.map((m) => (
						<button
							key={m.key}
							type="button"
							onClick={() => reset(setMode)(m.key)}
							className={`rounded-[2px] px-2 py-0.5 font-mono text-xs transition-colors ${
								mode === m.key
									? "bg-[var(--color-ink)] text-[var(--color-paper)]"
									: "text-[var(--color-ink-faint)] hover:bg-[var(--color-paper-deep)]"
							}`}
						>
							{m.label}
						</button>
					))}
				</div>

				{sexes.length > 1 && (
					<Select
						label="Sex"
						value={sex}
						options={sexes}
						onChange={reset(setSex)}
					/>
				)}
				{cefrs.length > 1 && (
					<Select
						label="Level"
						value={cefr}
						options={cefrs}
						onChange={reset(setCefr)}
					/>
				)}

				<button
					type="button"
					onClick={exportCsv}
					disabled={filtered.length === 0}
					title={`Download ${filtered.length.toLocaleString()} rows as CSV`}
					className="ml-auto rounded-[2px] border border-[var(--color-rule-strong)] px-2 py-0.5 font-mono text-xs transition-colors hover:bg-[var(--color-paper-deep)] disabled:opacity-40"
				>
					↓ CSV
				</button>
			</div>

			<div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1.5">
				<input
					type="search"
					value={query}
					onChange={(e) => reset(setQuery)(e.target.value)}
					placeholder="Search word, phone, context or speaker…"
					aria-label="Search the concordance"
					aria-invalid={regexError}
					className={`min-w-56 flex-1 rounded-[2px] border bg-[var(--color-paper)] px-2 py-1 font-body text-sm transition-colors placeholder:text-[var(--color-ink-faint)] ${
						regexError
							? "border-[var(--color-incorrect)]"
							: "border-[var(--color-rule)] focus:border-[var(--color-rule-strong)]"
					}`}
				/>
				<button
					type="button"
					onClick={() => reset(setUseRegex)(!useRegex)}
					title="Treat the query as a regular expression"
					aria-pressed={useRegex}
					className={`rounded-[2px] border px-2 py-1 font-mono text-xs transition-colors ${
						useRegex
							? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-paper)]"
							: "border-[var(--color-rule)] text-[var(--color-ink-faint)] hover:border-[var(--color-rule-strong)]"
					}`}
				>
					.*
				</button>
				{regexError && (
					<span className="font-mono text-[var(--color-incorrect)] text-xs">
						incomplete regex
					</span>
				)}
			</div>

			<div className="overflow-x-auto rounded-[var(--radius-card)] border border-[var(--color-rule)]">
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-[var(--color-rule)] border-b bg-[var(--color-paper-deep)]/60 text-left">
							<Th
								sortKey="left"
								sort={sort}
								onSort={toggleSort}
								className="text-right"
							>
								Left
							</Th>
							<Th sortKey="target" sort={sort} onSort={toggleSort}>
								Target
							</Th>
							<Th sortKey="realised" sort={sort} onSort={toggleSort}>
								Realised
							</Th>
							<Th sortKey="right" sort={sort} onSort={toggleSort}>
								Right
							</Th>
							<Th sortKey="word" sort={sort} onSort={toggleSort}>
								Word
							</Th>
							<Th sortKey="speaker" sort={sort} onSort={toggleSort}>
								Speaker
							</Th>
							<Th sortKey="outcome" sort={sort} onSort={toggleSort}>
								Outcome
							</Th>
							<Th sortKey="time" sort={sort} onSort={toggleSort} className="text-right">
								Time
							</Th>
							<Th>Note</Th>
						</tr>
					</thead>
					<tbody>
						{shown.map((t) => (
							<tr
								key={t.id}
								onClick={() => onOpen(t.u, t.id)}
								className="cursor-pointer border-[var(--color-rule)] border-b last:border-0 hover:bg-[var(--color-paper-deep)]/50"
							>
								<Td className="text-right">
									<span className="ipa whitespace-nowrap text-[var(--color-ink-faint)] text-xs">
										{t.lc ?? ""}
									</span>
								</Td>
								<Td>
									<IPA phone={t.tgt} className="text-base" />
								</Td>
								<Td>
									<span className="flex items-center gap-1">
										<IPA
											phone={t.act}
											className="text-base"
											slash={t.act !== null}
										/>
										{t.se && <Badge title="Stress mismatch">ˢ</Badge>}
										{t.le && <Badge title="Length mismatch">ˡ</Badge>}
									</span>
								</Td>
								<Td>
									<span className="ipa whitespace-nowrap text-[var(--color-ink-faint)] text-xs">
										{t.rc ?? ""}
									</span>
								</Td>
								<Td>
									<span className="font-body text-[var(--color-ink-soft)]">
										{t.w ?? "—"}
									</span>
								</Td>
								<Td>
									<SpeakerCell id={t.spk} meta={speakers[t.spk]} />
								</Td>
								<Td>
									<Outcome e={t.e} />
								</Td>
								<Td className="text-right">
									<span className="tnum font-mono text-[var(--color-ink-faint)] text-xs">
										{t.t0.toFixed(2)}s
									</span>
								</Td>
								<Td>
									<input
										type="text"
										value={notes[t.id] ?? ""}
										onChange={(e) => onNote(t.id, e.target.value)}
										onClick={(e) => e.stopPropagation()}
										onKeyDown={(e) => e.stopPropagation()}
										placeholder="…"
										aria-label={`Note for token ${t.id}`}
										className="w-24 rounded-[2px] border border-transparent bg-transparent px-1 py-0.5 font-body text-xs transition-colors placeholder:text-[var(--color-rule-strong)] hover:border-[var(--color-rule)] focus:border-[var(--color-accent)] focus:bg-[var(--color-paper)]"
									/>
								</Td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="mt-2 flex items-center justify-between gap-3">
				<span className="text-[var(--color-ink-faint)] text-xs">
					Showing {shown.length.toLocaleString()} of{" "}
					{filtered.length.toLocaleString()}
					{narrowed && ` (${tokens.length.toLocaleString()} unfiltered)`}
				</span>
				{limit < filtered.length && (
					<button
						type="button"
						onClick={() => setLimit((l) => l + PAGE * 3)}
						className="rounded-[2px] border border-[var(--color-rule-strong)] px-3 py-1 font-mono text-xs transition-colors hover:bg-[var(--color-paper-deep)]"
					>
						Load more
					</button>
				)}
			</div>

			{filtered.length === 0 && (
				<p className="mt-3 rounded-[var(--radius-card)] border border-[var(--color-rule)] border-dashed p-4 text-center text-[var(--color-ink-faint)] text-sm">
					No tokens match this combination of filters.
				</p>
			)}

			{noteCount > 0 && (
				<p className="mt-3 flex flex-wrap items-center gap-x-2 text-[var(--color-ink-faint)] text-xs">
					<span>
						{noteCount.toLocaleString()} note{noteCount === 1 ? "" : "s"} saved
						in this browser only — export the CSV to keep them.
					</span>
					<button
						type="button"
						onClick={() => setNotes(clearAnnotations())}
						className="underline underline-offset-2 hover:text-[var(--color-incorrect)]"
					>
						Clear all
					</button>
				</p>
			)}
		</div>
	);
}

function Select({
	label,
	value,
	options,
	onChange,
}: {
	label: string;
	value: string;
	options: string[];
	onChange: (v: string) => void;
}) {
	return (
		<label className="flex items-center gap-1.5">
			<span className="eyebrow">{label}</span>
			<select
				value={value}
				onChange={(e) => onChange(e.target.value)}
				className="rounded-[2px] border border-[var(--color-rule)] bg-[var(--color-paper)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-ink-soft)] transition-colors hover:border-[var(--color-rule-strong)]"
			>
				<option value={ANY}>any</option>
				{options.map((o) => (
					<option key={o} value={o}>
						{o}
					</option>
				))}
			</select>
		</label>
	);
}

function Th({
	children,
	className = "",
	sortKey,
	sort,
	onSort,
}: {
	children: React.ReactNode;
	className?: string;
	sortKey?: SortKey;
	sort?: Sort;
	onSort?: (k: SortKey) => void;
}) {
	const base = `px-3 py-2 font-mono font-medium text-[0.65rem] text-[var(--color-ink-faint)] uppercase tracking-wider ${className}`;
	if (!sortKey || !onSort) {
		return <th className={base}>{children}</th>;
	}
	const active = sort?.key === sortKey;
	return (
		<th className={base} aria-sort={active ? `${sort.dir}ending` : "none"}>
			<button
				type="button"
				onClick={() => onSort(sortKey)}
				className={`flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-[var(--color-ink)] ${
					active ? "text-[var(--color-ink)]" : ""
				}`}
			>
				{children}
				<span aria-hidden="true" className={active ? "" : "opacity-30"}>
					{active && sort.dir === "desc" ? "↓" : "↑"}
				</span>
			</button>
		</th>
	);
}

function Td({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}

function Badge({
	children,
	title,
}: {
	children: React.ReactNode;
	title: string;
}) {
	return (
		<span
			title={title}
			className="inline-flex h-4 min-w-4 items-center justify-center rounded-[2px] bg-[var(--color-insert-wash)] px-1 font-mono text-[0.6rem] text-[var(--color-insert)]"
		>
			{children}
		</span>
	);
}

function Outcome({ e }: { e: ErrorType }) {
	return (
		<span className="flex items-center gap-1.5">
			<span
				className="inline-block h-2 w-2 rounded-full"
				style={{ background: errorColor(e) }}
			/>
			<span className="whitespace-nowrap text-[var(--color-ink-soft)] text-xs">
				{ERROR_LABELS[e]}
			</span>
		</span>
	);
}

function SpeakerCell({ id, meta }: { id: string; meta?: SpeakerMeta }) {
	const bits: string[] = [];
	if (meta?.sex && meta.sex !== "u") bits.push(meta.sex);
	const cefr = cefrOf(meta);
	if (cefr) bits.push(cefr);
	return (
		<span className="flex items-baseline gap-1.5">
			<span className="font-mono text-[var(--color-ink)] text-xs">{id}</span>
			{bits.length > 0 && (
				<span className="whitespace-nowrap text-[var(--color-ink-faint)] text-[0.65rem]">
					{bits.join(" · ")}
				</span>
			)}
		</span>
	);
}
