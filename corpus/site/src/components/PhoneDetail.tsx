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
}) {
	const [tokens, setTokens] = useState<TokenRow[] | null>(null);

	useEffect(() => {
		setTokens(null);
		loadPhoneTokens(area, stat.phone).then(setTokens);
	}, [area, stat.phone]);

	const incorrect = stat.incorrect;

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
					<Eyebrow>Annotated phone</Eyebrow>
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
							label="Correct"
							value={stat.correct.toLocaleString()}
						/>
						<StatTile label="Incorrect" value={incorrect.toLocaleString()} />
					</div>
					<div className="mt-4 max-w-xl">
						<div className="mb-1.5 flex items-center justify-between">
							<Legend />
						</div>
						<AccuracyBar
							correct={stat.correct}
							incorrect={incorrect}
							height={12}
						/>
					</div>
				</div>
			</div>


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
				Correctness is the corpus annotators’ judgment for each production.
			</p>
		</div>
	);
}
