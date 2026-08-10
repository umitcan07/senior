import { useEffect, useState } from "react";
import { loadPhoneTokens } from "@/lib/api";
import { pct } from "@/lib/labels";
import type {
	Area,
	PhoneStat,
	SpeakerMeta,
	TokenRow,
} from "@/lib/types";
import { TokenConcordance } from "./TokenConcordance";
import { AccuracyBar, Eyebrow, IPA, Legend, Spinner, StatTile } from "./ui";

export function PhoneDetail({
	area,
	stat,
	speakers,
	onOpenUtterance,
}: {
	area: Area;
	stat: PhoneStat;
	speakers: Record<string, SpeakerMeta>;
	onOpenUtterance: (id: string, focusToken?: string) => void;
	onPickConfusion: (phone: string) => void;
}) {
	const [tokens, setTokens] = useState<TokenRow[] | null>(null);

	useEffect(() => {
		setTokens(null);
		loadPhoneTokens(area, stat.phone).then(setTokens);
	}, [area, stat.phone]);

	const confusions = Object.entries(stat.confusions).sort((a, b) => b[1] - a[1]);
	const incorrect = stat.substitute + stat.delete;

	return (
		<div className="rise">
			<div className="mb-6 flex items-start gap-5 border-[var(--color-rule)] border-b pb-5">
				<div
					className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[var(--radius-card)] border border-[var(--color-rule-strong)] bg-[var(--color-paper-deep)]"
					aria-hidden
				>
					<IPA phone={stat.phone} className="font-display text-5xl" />
				</div>
				<div className="min-w-0 flex-1">
					<Eyebrow>Target phone</Eyebrow>
					<h2 className="font-display text-4xl leading-tight">
						<IPA phone={stat.phone} />
					</h2>
					<div className="mt-3 grid max-w-xl grid-cols-2 gap-4 sm:grid-cols-4">
						<StatTile
							label="Accuracy"
							value={pct(stat.accuracy)}
							accent={stat.accuracy !== null && stat.accuracy < 0.5}
						/>
						<StatTile label="Tokens" value={stat.total.toLocaleString()} />
						<StatTile
							label="Substituted"
							value={stat.substitute.toLocaleString()}
						/>
						<StatTile label="Omitted" value={stat.delete.toLocaleString()} />
					</div>
					<div className="mt-4 max-w-xl">
						<div className="mb-1.5 flex items-center justify-between">
							<Legend />
						</div>
						<AccuracyBar
							correct={stat.correct}
							substitute={stat.substitute}
							del={stat.delete}
							height={12}
						/>
					</div>
				</div>
			</div>

			{confusions.length > 0 && (
				<section className="mb-7">
					<Eyebrow>
						Realised as — {incorrect.toLocaleString()} incorrect productions
					</Eyebrow>
					<div className="mt-2.5 flex flex-wrap gap-2">
						{confusions.map(([actual, count]) => {
							const share = incorrect ? count / incorrect : 0;
							return (
								<div
									key={actual}
									className="flex items-center gap-2 rounded-[2px] border border-[var(--color-rule)] bg-[var(--color-paper-deep)]/50 py-1 pr-2.5 pl-2"
								>
									<IPA phone={stat.phone} className="text-sm opacity-50" />
									<span className="text-[var(--color-ink-faint)] text-xs">→</span>
									<IPA
										phone={actual}
										className="font-display text-lg text-[var(--color-incorrect)]"
									/>
									<span className="tnum text-[var(--color-ink-soft)] text-xs">
										{count.toLocaleString()}{" "}
										<span className="text-[var(--color-ink-faint)]">
											({pct(share)})
										</span>
									</span>
								</div>
							);
						})}
					</div>
				</section>
			)}

			<section>
				<div className="mb-2.5 flex items-baseline justify-between">
					<Eyebrow>Concordance — every production in context</Eyebrow>
					{tokens && (
						<span className="tnum text-[var(--color-ink-faint)] text-xs">
							{tokens.length.toLocaleString()} rows
						</span>
					)}
				</div>
				{tokens === null ? (
					<Spinner label="Loading tokens…" />
				) : (
					<TokenConcordance
						tokens={tokens}
						speakers={speakers}
						onOpen={onOpenUtterance}
						exportName={`${area}-${stat.phone}`}
					/>
				)}
			</section>
			<p className="mt-6 max-w-xl text-[var(--color-ink-faint)] text-xs leading-relaxed">
				Correctness is strict identity against the reference transcription: a
				production counts as correct only if it matches the target phone
				exactly. Stress and length mismatches are marked separately, with the
				<span className="mx-1 font-mono">ˢ</span> and
				<span className="mx-1 font-mono">ˡ</span> badges.
			</p>
		</div>
	);
}
