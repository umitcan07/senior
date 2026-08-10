import { useEffect, useMemo, useState } from "react";
import { loadUtterance } from "@/lib/api";
import { num } from "@/lib/labels";
import type { Manifest, UtteranceDetail } from "@/lib/types";
import { Header } from "./RhythmView";
import { PitchPlot } from "./PitchPlot";
import { Card, Spinner } from "./ui";

export function IntonationView({
	manifest,
	onOpenUtterance,
}: {
	manifest: Manifest;
	onOpenUtterance: (id: string) => void;
}) {
	const [details, setDetails] = useState<UtteranceDetail[] | null>(null);

	const sample = useMemo(
		() =>
			[...manifest.utterances]
				.filter((u) => (u.dur ?? 0) >= 1.0)
				.sort((a, b) => (b.dur ?? 0) - (a.dur ?? 0))
				.slice(0, 24),
		[manifest.utterances],
	);

	useEffect(() => {
		setDetails(null);
		Promise.all(sample.map((u) => loadUtterance(u.id))).then(setDetails);
	}, [sample]);

	const withPitch = details?.filter((d) => d.pitch) ?? [];

	return (
		<div className="rise">
			<Header
				title="Intonation"
				blurb="Pitch (F0) contours over each utterance. Shown for inspection, not graded — a rising or falling nucleus is information, not an error. Click a card to open the utterance with its audio."
			/>

			{!details ? (
				<Spinner label="Extracting contours…" />
			) : withPitch.length === 0 ? (
				<NoContours hasBackend={manifest.build.pitchBackend !== "none"} />
			) : (
				<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
					{withPitch.map((d) => (
						<Card
							key={d.id}
							className="cursor-pointer p-4 transition-colors hover:border-[var(--color-rule-strong)]"
						>
							<button
								type="button"
								onClick={() => onOpenUtterance(d.id)}
								className="w-full text-left"
							>
								<div className="mb-1 flex items-baseline justify-between">
									<span className="font-mono text-[var(--color-ink-soft)] text-xs">
										{d.spk} · {d.task}
									</span>
									<span className="tnum font-mono text-[var(--color-ink-faint)] text-xs">
										{num(d.pitch?.min ?? null)}–{num(d.pitch?.max ?? null)} Hz
									</span>
								</div>
								{d.text && (
									<p className="mb-1.5 line-clamp-1 font-body text-[var(--color-ink)] text-sm italic">
										“{d.text}”
									</p>
								)}
								{d.pitch && <PitchPlot pitch={d.pitch} height={110} />}
							</button>
						</Card>
					))}
				</div>
			)}
		</div>
	);
}

function NoContours({ hasBackend }: { hasBackend: boolean }) {
	return (
		<div className="rounded-[var(--radius-card)] border border-[var(--color-rule)] border-dashed p-8 text-center">
			<p className="text-[var(--color-ink-soft)] text-sm">
				No pitch contours in this build.
			</p>
			{!hasBackend && (
				<p className="mt-2 font-mono text-[var(--color-ink-faint)] text-xs">
					No audio was available at build time. Rebuild with recordings present
					(and, for best accuracy, pip install praat-parselmouth).
				</p>
			)}
		</div>
	);
}
