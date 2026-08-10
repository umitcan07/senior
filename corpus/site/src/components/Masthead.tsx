import type { Manifest } from "@/lib/types";

export type View = "explore" | "about";

const TABS: { key: View; label: string }[] = [
	{ key: "explore", label: "Explore" },
	{ key: "about", label: "About" },
];

export function Masthead({
	manifest,
	view,
	onView,
}: {
	manifest: Manifest;
	view: View;
	onView: (v: View) => void;
}) {
	const { files, utterances, synthetic } = manifest.build;
	const speakers = Object.keys(manifest.speakers).length;

	return (
		<header className="border-[var(--color-rule-strong)] border-b bg-[var(--color-paper)]/80 backdrop-blur-sm">
			{synthetic && <SyntheticBanner />}
			<div className="mx-auto flex max-w-[1400px] flex-col gap-3 px-5 py-5 lg:flex-row lg:items-end lg:justify-between lg:px-8">
				<div>
					<div className="eyebrow mb-1">
						Turkish-L1 · English-L2 · Phonetic Corpus
					</div>
					<h1 className="font-display text-[2.1rem] leading-none tracking-tight">
						CORPTES{" "}
						<span className="text-[var(--color-ink-faint)] italic">Explorer</span>
					</h1>
					<p className="mt-1.5 max-w-xl text-[var(--color-ink-soft)] text-sm">
						A phonetic-feature view of how Turkish-native speakers pronounce
						English — browse by sound, read the error statistics, inspect any
						token in context.
					</p>
					<nav className="mt-3 flex gap-1">
						{TABS.map((t) => (
							<button
								key={t.key}
								type="button"
								onClick={() => onView(t.key)}
								aria-current={view === t.key ? "page" : undefined}
								className={`rounded-[2px] px-2.5 py-1 font-mono text-xs transition-colors ${
									view === t.key
										? "bg-[var(--color-ink)] text-[var(--color-paper)]"
										: "text-[var(--color-ink-faint)] hover:bg-[var(--color-paper-deep)]"
								}`}
							>
								{t.label}
							</button>
						))}
					</nav>
				</div>
				<dl className="flex gap-6 lg:gap-8">
					<Figure n={speakers} label="Speakers" />
					<Figure n={utterances} label="Utterances" />
					<Figure n={files} label="Recordings" />
				</dl>
			</div>
		</header>
	);
}

/** Built from demo_corpus.py — say so on every page, not just in the About text. */
function SyntheticBanner() {
	return (
		<div className="border-[var(--color-insert)] border-b bg-[var(--color-insert-wash)] px-5 py-2 text-center lg:px-8">
			<span className="font-mono text-[0.7rem] text-[var(--color-insert)] uppercase tracking-wider">
				Demonstration data
			</span>
			<span className="ml-2 text-[var(--color-ink-soft)] text-xs">
				Every figure here is fabricated by the demo generator, not measured from
				the corpus. Rebuild against the real drop before citing anything.
			</span>
		</div>
	);
}

function Figure({ n, label }: { n: number; label: string }) {
	return (
		<div className="text-right">
			<dd className="tnum font-display text-2xl leading-none">
				{n.toLocaleString()}
			</dd>
			<dt className="eyebrow mt-1">{label}</dt>
		</div>
	);
}
