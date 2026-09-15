import { useTask } from "./TaskFilter";
import { useEffect, useMemo, useState } from "react";
import type { Selection } from "@/App";
import { loadAreaStats, loadPhoneTokens } from "@/lib/api";
import { AREA_BLURBS, AREA_LABELS, classLabel, pct } from "@/lib/labels";
import type { Area, AreaStats, Manifest, PhoneStat, TokenRow } from "@/lib/types";
import { TokenConcordance } from "./TokenConcordance";
import { PhoneDetail } from "./PhoneDetail";
import { AccuracyBar, Eyebrow, IPA, Legend, Spinner } from "./ui";

export function SegmentalView({
	manifest,
	sel,
	onSelect,
	onOpenUtterance,
}: {
	manifest: Manifest;
	sel: Selection;
	onSelect: (s: Selection) => void;
	onOpenUtterance: (id: string, focusToken?: TokenRow) => void;
}) {
	const task = useTask();
	const area = sel.area as Area;
	const [stats, setStats] = useState<AreaStats | null>(null);

	useEffect(() => {
		setStats(null);
		loadAreaStats(area, task).then(setStats);
	}, [area, task]);

	// Which phones are in scope given the filter.
	const scopePhones = useMemo(() => {
		if (sel.phones.length) return sel.phones;
		if (sel.classKey) {
			const cls = manifest.filterTree[area].find((c) => c.key === sel.classKey);
			return cls?.phones ?? [];
		}
		return null; // all
	}, [sel, manifest, area]);

	if (!stats) return <Spinner label={`Loading ${area}…`} />;

	const rows = stats.phones
		.filter((p) => (scopePhones ? scopePhones.includes(p.phone) : true))
		.filter((p) => p.total > 0)
		.sort((a, b) => b.total - a.total);

	// Single-phone view -> full detail.
	if (sel.phones.length === 1) {
		const stat = stats.phones.find((p) => p.phone === sel.phones[0]);
		return (
			<PhoneDetail
				area={area}
				stat={stat ?? emptyStat(sel.phones[0])}
				speakers={manifest.speakers}
				onOpenUtterance={onOpenUtterance}
			/>
		);
	}

	const heading =
		sel.phones.length > 1
			? sel.phones.map((p) => `/${p}/`).join(" · ")
			: sel.classKey
				? classLabel(sel.classKey)
				: `All ${AREA_LABELS[area].toLowerCase()}`;

	const totals = rows.reduce(
		(acc, r) => {
			acc.correct += r.correct;
			acc.incorrect += r.incorrect;
			return acc;
		},
		{ correct: 0, incorrect: 0 },
	);
	const totalTokens = totals.correct + totals.incorrect;
	const overallAcc = totalTokens ? totals.correct / totalTokens : null;

	return (
		<div className="rise">
			<div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-[var(--color-rule)] border-b pb-4">
				<div>
					<Eyebrow>{AREA_LABELS[area]}</Eyebrow>
					<h2 className="mt-0.5 font-display text-3xl">{heading}</h2>
					<p className="mt-1 max-w-lg text-[var(--color-ink-soft)] text-sm">
						{AREA_BLURBS[area]}
					</p>
				</div>
				<div className="text-right">
					<div className="tnum font-display text-4xl leading-none">
						{pct(overallAcc)}
					</div>
					<div className="eyebrow mt-1">
						accuracy · {totalTokens.toLocaleString()} tokens
					</div>
				</div>
			</div>

			<div className="mb-4">
				<Legend />
			</div>

			{rows.length === 0 ? (
				<EmptyState />
			) : (
				<div className="grid grid-cols-1 gap-x-6 gap-y-0 sm:grid-cols-2 xl:grid-cols-3">
					{rows.map((stat) => (
						<PhoneCard
							key={stat.phone}
							stat={stat}
							onClick={() =>
								onSelect({
									area,
									classKey: null,
									phones: [stat.phone],
								})
							}
						/>
					))}
				</div>
			)}
			{sel.phones.length > 1 && (
				<SelectedTokens
					key={sel.phones.join(",")}
					area={area}
					phones={sel.phones}
					manifest={manifest}
					onOpen={onOpenUtterance}
				/>
			)}
		</div>
	);
}

function SelectedTokens({
	area,
	phones,
	manifest,
	onOpen,
}: {
	area: Area;
	phones: string[];
	manifest: Manifest;
	onOpen: (id: string, token?: TokenRow) => void;
}) {
	const task = useTask();
	const [tokens, setTokens] = useState<TokenRow[] | null>(null);
	useEffect(() => {
		let active = true;
		Promise.all(phones.map((phone) => loadPhoneTokens(area, phone, task))).then((rows) => {
			if (active) setTokens(rows.flat());
		});
		return () => {
			active = false;
		};
	}, [area, phones, task]);
	return (
		<section className="mt-7">
			<Eyebrow>Selected phones — all matching tokens</Eyebrow>
			<div className="mt-3">
				{tokens ? (
					<TokenConcordance
						tokens={tokens}
						speakers={manifest.speakers}
						onOpen={onOpen}
						exportName={`${area}-${phones.join("-")}`}
					/>
				) : (
					<Spinner label="Loading selected phones…" />
				)}
			</div>
		</section>
	);
}

function PhoneCard({ stat, onClick }: { stat: PhoneStat; onClick: () => void }) {
	return (
		<button
			type="button"
			onClick={onClick}
			className="group border-[var(--color-rule)] border-b py-3.5 text-left transition-colors hover:bg-[var(--color-paper-deep)]/50"
		>
			<div className="flex items-center justify-between">
				<div className="flex items-baseline gap-2.5">
					<IPA
						phone={stat.phone}
						className="font-display text-2xl transition-colors group-hover:text-[var(--color-accent)]"
					/>
				</div>
				<div className="tnum text-right">
					<span className="font-display text-lg">{pct(stat.accuracy)}</span>
				</div>
			</div>
			<div className="mt-2 flex items-center gap-2">
				<AccuracyBar correct={stat.correct} incorrect={stat.incorrect} />
				<span className="tnum shrink-0 text-[var(--color-ink-faint)] text-xs">
					{stat.total.toLocaleString()}
				</span>
			</div>
		</button>
	);
}

function EmptyState() {
	return (
		<div className="rounded-[var(--radius-card)] border border-[var(--color-rule)] border-dashed p-8 text-center text-[var(--color-ink-faint)] text-sm">
			No annotated tokens in this selection.
		</div>
	);
}

function emptyStat(phone: string): PhoneStat {
	return {
		phone,
		total: 0,
		correct: 0,
		incorrect: 0,
		accuracy: null,
	};
}
