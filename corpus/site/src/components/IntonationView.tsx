import { useEffect, useState } from "react";
import { loadPhoneTokens } from "@/lib/api";
import { pct } from "@/lib/labels";
import type { Manifest, TokenRow } from "@/lib/types";
import { Header } from "./RhythmView";
import { TokenConcordance } from "./TokenConcordance";
import { Spinner, StatTile } from "./ui";

export function IntonationView({
	manifest,
	onOpenUtterance,
}: {
	manifest: Manifest;
	onOpenUtterance: (id: string) => void;
}) {
	const [rows, setRows] = useState<TokenRow[] | null>(null);

	useEffect(() => {
		loadPhoneTokens("intonation", "all").then(setRows);
	}, []);

	const correct = rows?.filter((row) => row.e === "correct").length ?? 0;
	const total = rows?.length ?? 0;

	return (
		<div className="rise">
			<Header
				title="Intonation"
				blurb="Corpus-native intonation judgments. Pitch contours are not required for this explorer build."
			/>

			{rows === null ? (
				<Spinner label="Loading intonation annotations…" />
			) : (
				<>
					<div className="mb-6 grid max-w-xl grid-cols-3 gap-5">
						<StatTile label="Sites" value={total.toLocaleString()} />
						<StatTile label="Correct" value={correct.toLocaleString()} />
						<StatTile label="Match rate" value={pct(total ? correct / total : null)} />
					</div>
					<TokenConcordance tokens={rows} speakers={manifest.speakers} onOpen={onOpenUtterance} exportName="intonation" />
				</>
			)}
		</div>
	);
}
