import { useEffect, useState } from "react";
import { loadPhoneTokens } from "@/lib/api";
import { pct } from "@/lib/labels";
import type { Manifest, TokenRow } from "@/lib/types";
import { Header } from "./RhythmView";
import { TokenConcordance } from "./TokenConcordance";
import { Spinner, StatTile } from "./ui";

export function LinkingView({
	manifest,
	onOpenUtterance,
}: {
	manifest: Manifest;
	onOpenUtterance: (id: string, token?: string) => void;
}) {
	const [rows, setRows] = useState<TokenRow[] | null>(null);
	useEffect(() => {
		loadPhoneTokens("linking", "all").then(setRows);
	}, []);
	const correct = rows?.filter((row) => row.e === "correct").length ?? 0;
	const total = rows?.length ?? 0;
	return (
		<div className="rise">
			<Header
				title="Linking"
				blurb="Word-boundary liaison in connected speech. Correctness is the corpus annotators’ judgment, not automatic detection."
			/>
			{rows === null ? (
				<Spinner label="Loading linking annotations…" />
			) : (
				<>
					<div className="mb-6 grid max-w-xl grid-cols-3 gap-5">
						<StatTile label="Sites" value={total.toLocaleString()} />
						<StatTile label="Correct" value={correct.toLocaleString()} />
						<StatTile label="Match rate" value={pct(total ? correct / total : null)} />
					</div>
					<TokenConcordance
						tokens={rows}
						speakers={manifest.speakers}
						onOpen={onOpenUtterance}
						exportName="linking"
					/>
				</>
			)}
		</div>
	);
}
