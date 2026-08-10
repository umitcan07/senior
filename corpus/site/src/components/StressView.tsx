import { useEffect, useState } from "react";
import { loadPhoneTokens, loadStressStats } from "@/lib/api";
import { pct } from "@/lib/labels";
import type { Manifest, StressStats, TokenRow } from "@/lib/types";
import { Header } from "./RhythmView";
import { TokenConcordance } from "./TokenConcordance";
import { AccuracyBar, Eyebrow, IPA, Spinner, StatTile } from "./ui";

export function StressView({
	manifest,
	onOpenUtterance,
}: {
	manifest: Manifest;
	onOpenUtterance: (id: string, focusToken?: string) => void;
}) {
	const [stats, setStats] = useState<StressStats | null>(null);
	const [tokens, setTokens] = useState<TokenRow[] | null>(null);

	useEffect(() => {
		loadStressStats().then(setStats).catch(() => setStats(emptyStress()));
		loadPhoneTokens("stress", "mismatch").then(setTokens);
	}, []);

	return (
		<div className="rise">
			<Header
				title="Lexical Stress"
				blurb="Where primary and secondary stress land, compared against the reference. A vowel can be segmentally correct yet stressed wrongly — those cases are counted here, not among the vowel errors."
			/>

			{!stats ? (
				<Spinner label="Loading stress data…" />
			) : stats.total === 0 ? (
				<NoStress marks={stats.marksPresent} />
			) : (
				<>
					<div className="mb-6 grid max-w-2xl grid-cols-2 gap-5 sm:grid-cols-4">
						<StatTile label="Stress-bearing" value={stats.total.toLocaleString()} />
						<StatTile label="Correct" value={stats.correct.toLocaleString()} />
						<StatTile
							label="Mismatched"
							value={stats.mismatch.toLocaleString()}
							accent
						/>
						<StatTile
							label="Match rate"
							value={pct(stats.total ? stats.correct / stats.total : null)}
						/>
					</div>

					<section className="mb-7">
						<Eyebrow>By stressed vowel</Eyebrow>
						<div className="mt-2.5 grid grid-cols-1 gap-x-6 sm:grid-cols-2 xl:grid-cols-3">
							{stats.byPhone
								.filter((p) => p.total > 0)
								.sort((a, b) => b.total - a.total)
								.map((p) => (
									<div
										key={p.phone}
										className="flex items-center gap-3 border-[var(--color-rule)] border-b py-2.5"
									>
										<IPA phone={p.phone} className="w-12 font-display text-xl" />
										<div className="flex-1">
											<AccuracyBar
												correct={p.correct}
												substitute={p.mismatch}
												del={0}
											/>
										</div>
										<span className="tnum w-10 text-right font-display text-sm">
											{pct(p.total ? p.correct / p.total : null)}
										</span>
										<span className="tnum w-10 text-right text-[var(--color-ink-faint)] text-xs">
											{p.total}
										</span>
									</div>
								))}
						</div>
					</section>

					<section>
						<Eyebrow>Stress mismatches in context</Eyebrow>
						<div className="mt-2.5">
							{tokens === null ? (
								<Spinner />
							) : (
								<TokenConcordance
									tokens={tokens}
									speakers={manifest.speakers}
									onOpen={onOpenUtterance}
									exportName="lexical-stress"
								/>
							)}
						</div>
					</section>
				</>
			)}
		</div>
	);
}

function NoStress({ marks }: { marks: boolean }) {
	return (
		<div className="rounded-[var(--radius-card)] border border-[var(--color-rule)] border-dashed p-8 text-center">
			<p className="text-[var(--color-ink-soft)] text-sm">
				No lexical-stress data in this corpus build.
			</p>
			<p className="mt-2 max-w-md mx-auto text-[var(--color-ink-faint)] text-xs">
				{marks
					? "Stress marks are present but no stress-bearing pairs were aligned."
					: "The phone tiers carry no ˈ/ˌ marks, so stress cannot be scored from the annotation. This area needs hand-labelled stress to populate."}
			</p>
		</div>
	);
}

function emptyStress(): StressStats {
	return {
		area: "lexical-stress",
		total: 0,
		correct: 0,
		mismatch: 0,
		marksPresent: false,
		byPhone: [],
	};
}
