import type { Selection } from "@/App";
import {
	AREA_LABELS,
	classGroup,
	CLASS_GROUP_LABELS,
	CLASS_GROUP_ORDER,
	classLabel,
} from "@/lib/labels";
import type { Area, AreaKey, FilterClass, Manifest } from "@/lib/types";
import { IPA } from "./ui";

const AREAS: AreaKey[] = [
	"vowels",
	"consonants",
	"lexical-stress",
	"linking",
	"rhythm",
	"intonation",
];

export function FilterSidebar({
	manifest,
	sel,
	onSelect,
}: {
	manifest: Manifest;
	sel: Selection;
	onSelect: (s: Selection) => void;
}) {
	const isSegmental = sel.area === "vowels" || sel.area === "consonants";
	const tree = isSegmental ? manifest.filterTree[sel.area as Area] : [];

	return (
		<aside className="shrink-0 border-[var(--color-rule)] px-5 py-6 lg:w-64 lg:border-r lg:px-6">
			<nav className="mb-6">
				<div className="eyebrow mb-2">Pronunciation Areas</div>
				<ul className="space-y-0.5">
					{AREAS.map((area) => {
						const active = sel.area === area;
						return (
							<li key={area}>
								<button
									type="button"
									onClick={() =>
										onSelect({
											area,
											classKey: null,
											phones: [],
										})
									}
									className={`flex w-full items-baseline justify-between rounded-[2px] px-2 py-1.5 text-left transition-colors ${
										active
											? "bg-[var(--color-ink)] text-[var(--color-paper)]"
											: "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-deep)]"
									}`}
								>
									<span className="font-body text-[0.95rem]">
										{AREA_LABELS[area]}
									</span>
									{active && (
										<span className="text-xs opacity-60">
											●
										</span>
									)}
								</button>
							</li>
						);
					})}
				</ul>
			</nav>

			{isSegmental && <FilterTree tree={tree} sel={sel} onSelect={onSelect} />}
		</aside>
	);
}

function FilterTree({
	tree,
	sel,
	onSelect,
}: {
	tree: FilterClass[];
	sel: Selection;
	onSelect: (s: Selection) => void;
}) {
	// Group classes by their axis (manner/place/…).
	const groups = new Map<string, FilterClass[]>();
	for (const cls of tree) {
		const g = classGroup(cls.key);
		if (!groups.has(g)) groups.set(g, []);
		groups.get(g)?.push(cls);
	}
	const orderedGroups = CLASS_GROUP_ORDER.filter((g) => groups.has(g));

	// All unique phones for multi-selection.
	const allPhones = [...new Set(tree.flatMap((c) => c.phones))].sort();

	return (
		<div className="space-y-5">
			<div>
				<button
					type="button"
					onClick={() =>
						onSelect({ area: sel.area, classKey: null, phones: [] })
					}
					className={`eyebrow mb-2 transition-colors hover:text-[var(--color-accent)] ${
						!sel.classKey && sel.phones.length === 0
							? "text-[var(--color-accent)]"
							: ""
					}`}
				>
					↳ All {AREA_LABELS[sel.area].toLowerCase()}
				</button>
			</div>

			<div>
				<div className="eyebrow mb-2">Select phones</div>
				<p className="mb-2 text-xs text-[var(--color-ink-faint)]">
					Choose one or more sounds.
				</p>
				<div className="flex flex-wrap gap-1">
					{allPhones.map((p) => {
						const active = sel.phones.includes(p);
						return (
							<button
								key={p}
								type="button"
								onClick={() =>
									onSelect({
										area: sel.area,
										classKey: null,
										phones: active
											? sel.phones.filter(
													(phone) =>
														phone !== p,
												)
											: [...sel.phones, p],
									})
								}
								className={`rounded-[2px] border px-1.5 py-0.5 text-center transition-colors ${
									active
										? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-paper)]"
										: "border-[var(--color-rule)] text-[var(--color-ink-soft)] hover:border-[var(--color-rule-strong)]"
								}`}
								title={`/${p}/`}
								aria-pressed={active}
							>
								<IPA phone={p} slash={false} className="text-sm" />
							</button>
						);
					})}
				</div>
			</div>

			{orderedGroups.map((g) => (
				<div key={g}>
					<div className="eyebrow mb-1.5">{CLASS_GROUP_LABELS[g] ?? g}</div>
					<ul className="space-y-0.5">
						{groups
							.get(g)
							?.sort((a, b) =>
								classLabel(a.key).localeCompare(classLabel(b.key)),
							)
							.map((cls) => {
								const active = sel.classKey === cls.key;
								return (
									<li key={cls.key}>
										<button
											type="button"
											onClick={() =>
												onSelect({
													area: sel.area,
													classKey: active
														? null
														: cls.key,
													phones: [],
												})
											}
											className={`flex w-full items-center justify-between rounded-[2px] px-2 py-1 text-left text-sm transition-colors ${
												active
													? "bg-[var(--color-accent)] text-[var(--color-paper)]"
													: "text-[var(--color-ink-soft)] hover:bg-[var(--color-paper-deep)]"
											}`}
										>
											<span>{classLabel(cls.key)}</span>
											<span
												className={`tnum text-xs ${active ? "opacity-70" : "text-[var(--color-ink-faint)]"}`}
											>
												{cls.phones.length}
											</span>
										</button>
									</li>
								);
							})}
					</ul>
				</div>
			))}
		</div>
	);
}
