import { useEffect, useMemo, useState } from "react";
import { loadUtterance } from "@/lib/api";
import { num } from "@/lib/labels";
import type { Manifest, RhythmMetrics, UtteranceDetail } from "@/lib/types";
import { Card, Eyebrow, Spinner } from "./ui";

const METRICS: {
	key: keyof RhythmMetrics;
	label: string;
	blurb: string;
	unit?: string;
}[] = [
	{ key: "percentV", label: "%V", blurb: "Share of time that is vocalic", unit: "%" },
	{ key: "npviV", label: "nPVI-V", blurb: "Vocalic pairwise variability" },
	{ key: "varcoV", label: "VarcoV", blurb: "Normalised vocalic SD" },
	{ key: "varcoC", label: "VarcoC", blurb: "Normalised consonantal SD" },
	{ key: "deltaC", label: "ΔC", blurb: "Consonantal SD", unit: "ms" },
	{ key: "rpviC", label: "rPVI-C", blurb: "Raw consonantal variability", unit: "ms" },
];

// Reference bands are informational anchors from the rhythm literature: English
// is more stress-timed (higher vocalic nPVI/%V variability) than syllable-timed
// Turkish. Not thresholds — orientation only.
const REFERENCE: Partial<Record<keyof RhythmMetrics, string>> = {
	percentV: "English ≈ 38–42%",
	npviV: "English ≈ 55–65 · Turkish lower",
};

/** Compact 6-tile rhythm readout, reused in the utterance panel. */
export function RhythmStrip({ r }: { r: RhythmMetrics }) {
	return (
		<div className="grid grid-cols-3 gap-x-4 gap-y-3">
			{METRICS.map((m) => (
				<div key={m.key} className="border-[var(--color-rule)] border-l pl-2.5">
					<div className="font-mono text-[0.65rem] text-[var(--color-ink-faint)] uppercase tracking-wider">
						{m.label}
					</div>
					<div className="tnum font-display text-xl leading-tight">
						{num(r[m.key] as number | null)}
						{m.unit && (
							<span className="ml-0.5 text-[var(--color-ink-faint)] text-xs">
								{m.unit}
							</span>
						)}
					</div>
				</div>
			))}
		</div>
	);
}

export function RhythmView({ manifest }: { manifest: Manifest }) {
	const [details, setDetails] = useState<UtteranceDetail[] | null>(null);
	const [task, setTask] = useState<"all" | "T1" | "T2">("all");

	// Sample utterances to keep the fetch bounded — rhythm needs enough of a span
	// to be meaningful, so we prefer longer utterances.
	const sample = useMemo(() => {
		return [...manifest.utterances]
			.filter((u) => (task === "all" ? true : u.task === task))
			.filter((u) => (u.dur ?? 0) >= 1.5)
			.sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
			.slice(0, 80);
	}, [manifest.utterances, task]);

	useEffect(() => {
		setDetails(null);
		Promise.all(sample.map((u) => loadUtterance(u.id))).then(setDetails);
	}, [sample]);

	const agg = useMemo(() => {
		if (!details) return null;
		const acc: Record<string, number[]> = {};
		for (const d of details) {
			for (const m of METRICS) {
				const v = d.rhythm[m.key] as number | null;
				if (v !== null && v !== undefined && !Number.isNaN(v)) {
					(acc[m.key] ??= []).push(v);
				}
			}
		}
		return acc;
	}, [details]);

	return (
		<div className="rise">
			<Header
				title="Rhythm"
				blurb="Durational measures of speech rhythm, computed from segment boundaries. These are measurements — there is no correct/incorrect verdict on a rhythm score, only the corpus distribution beside a reference band."
			/>

			<div className="mb-5 flex gap-1">
				{(["all", "T1", "T2"] as const).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTask(t)}
						className={`rounded-[2px] px-2.5 py-1 font-mono text-xs transition-colors ${
							task === t
								? "bg-[var(--color-ink)] text-[var(--color-paper)]"
								: "text-[var(--color-ink-faint)] hover:bg-[var(--color-paper-deep)]"
						}`}
					>
						{t === "all" ? "All" : t === "T1" ? "Read-aloud" : "Interview"}
					</button>
				))}
			</div>

			{!agg ? (
				<Spinner label="Computing rhythm distribution…" />
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{METRICS.map((m) => {
						const vals = agg[m.key] ?? [];
						const mean = vals.length
							? vals.reduce((a, b) => a + b, 0) / vals.length
							: null;
						return (
							<Card key={m.key} className="p-4">
								<div className="flex items-baseline justify-between">
									<span className="font-mono font-medium text-sm">
										{m.label}
									</span>
									<span className="tnum font-display text-2xl">
										{num(mean)}
										{m.unit && (
											<span className="ml-0.5 text-[var(--color-ink-faint)] text-sm">
												{m.unit}
											</span>
										)}
									</span>
								</div>
								<p className="mt-1 text-[var(--color-ink-soft)] text-xs">
									{m.blurb}
								</p>
								<Histogram values={vals} />
								{REFERENCE[m.key] && (
									<p className="mt-1.5 font-mono text-[0.6rem] text-[var(--color-ink-faint)]">
										{REFERENCE[m.key]}
									</p>
								)}
								<p className="mt-1 text-[var(--color-ink-faint)] text-[0.6rem]">
									n = {vals.length} utterances
								</p>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}

function Histogram({ values }: { values: number[] }) {
	if (values.length < 3) return <div className="mt-3 h-10" />;
	const min = Math.min(...values);
	const max = Math.max(...values);
	const bins = 16;
	const counts = new Array(bins).fill(0);
	for (const v of values) {
		const idx = Math.min(bins - 1, Math.floor(((v - min) / (max - min || 1)) * bins));
		counts[idx]++;
	}
	const peak = Math.max(...counts) || 1;
	return (
		<div className="mt-3 flex h-10 items-end gap-[2px]" aria-hidden>
			{counts.map((c, i) => (
				<div
					key={i}
					className="flex-1 rounded-[1px] bg-[var(--color-correct)]"
					style={{ height: `${(c / peak) * 100}%`, opacity: 0.35 + (c / peak) * 0.5 }}
				/>
			))}
		</div>
	);
}

export function Header({ title, blurb }: { title: string; blurb: string }) {
	return (
		<div className="mb-5 border-[var(--color-rule)] border-b pb-4">
			<Eyebrow>Suprasegmental</Eyebrow>
			<h2 className="mt-0.5 font-display text-3xl">{title}</h2>
			<p className="mt-1 max-w-2xl text-[var(--color-ink-soft)] text-sm">
				{blurb}
			</p>
		</div>
	);
}
