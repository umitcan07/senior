import { useEffect, useState } from "react";
import { AboutView } from "./components/AboutView";
import { FilterSidebar } from "./components/FilterSidebar";
import { IntonationView } from "./components/IntonationView";
import { Masthead, type View } from "./components/Masthead";
import { RhythmView } from "./components/RhythmView";
import { SegmentalView } from "./components/SegmentalView";
import { StressView } from "./components/StressView";
import { Spinner } from "./components/ui";
import { UtterancePanel } from "./components/UtterancePanel";
import { loadManifest } from "./lib/api";
import type { AreaKey, Manifest } from "./lib/types";

export interface Selection {
	area: AreaKey;
	classKey: string | null; // articulatory class filter (segmental areas)
	phone: string | null; // single-phone filter (segmental areas)
}

export function App() {
	const [manifest, setManifest] = useState<Manifest | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [view, setView] = useState<View>("explore");
	const [sel, setSel] = useState<Selection>({
		area: "consonants",
		classKey: null,
		phone: null,
	});
	const [openUtterance, setOpenUtterance] = useState<{
		id: string;
		focusToken?: string;
	} | null>(null);

	useEffect(() => {
		loadManifest().then(setManifest).catch((e) => setError(String(e)));
	}, []);

	if (error) {
		return (
			<div className="mx-auto max-w-xl p-10 font-body">
				<h1 className="mb-3 font-display text-2xl">Corpus data not found</h1>
				<p className="text-[var(--color-ink-soft)]">
					Could not load{" "}
					<code className="font-mono text-sm">data/manifest.json</code>. Build it
					first:
				</p>
				<pre className="mt-3 overflow-x-auto rounded border border-[var(--color-rule)] bg-[var(--color-paper-deep)] p-3 font-mono text-xs">
					python -m corpus.scripts.site_build.build --out corpus/site/public
				</pre>
				<p className="mt-3 text-[var(--color-ink-faint)] text-xs">{error}</p>
			</div>
		);
	}

	if (!manifest) {
		return (
			<div className="flex h-screen items-center justify-center">
				<Spinner label="Loading corpus…" />
			</div>
		);
	}

	const isSegmental = sel.area === "vowels" || sel.area === "consonants";

	return (
		<div className="min-h-screen">
			<Masthead manifest={manifest} view={view} onView={setView} />
			{view === "about" ? (
				<main className="mx-auto max-w-[1400px] px-5 py-8 lg:px-8">
					<AboutView manifest={manifest} />
				</main>
			) : (
				<div className="mx-auto flex max-w-[1400px] flex-col gap-0 lg:flex-row">
					<FilterSidebar manifest={manifest} sel={sel} onSelect={setSel} />
					<main className="min-w-0 flex-1 px-5 py-6 lg:px-8">
						{isSegmental && (
							<SegmentalView
								key={sel.area}
								manifest={manifest}
								sel={sel}
								onSelect={setSel}
								onOpenUtterance={(id, focusToken) =>
									setOpenUtterance({ id, focusToken })
								}
							/>
						)}
						{sel.area === "lexical-stress" && (
							<StressView
								manifest={manifest}
								onOpenUtterance={(id, t) =>
									setOpenUtterance({ id, focusToken: t })
								}
							/>
						)}
						{sel.area === "rhythm" && <RhythmView manifest={manifest} />}
						{sel.area === "intonation" && (
							<IntonationView
								manifest={manifest}
								onOpenUtterance={(id) => setOpenUtterance({ id })}
							/>
						)}
					</main>
				</div>
			)}

			{openUtterance && (
				<UtterancePanel
					id={openUtterance.id}
					focusToken={openUtterance.focusToken}
					speakers={manifest.speakers}
					onClose={() => setOpenUtterance(null)}
				/>
			)}
		</div>
	);
}
