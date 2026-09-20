import dictionary from "../data/reference-pronunciations.json";
import { Eyebrow } from "./ui";

type Variant = { ipa: string; stress: string[] };
const entries: Record<string, Variant[]> = dictionary.entries;

export function ReferencePronunciation({ word, verified }: { word?: string; verified?: string[] }) {
	const key = (word ?? "")
		.normalize("NFC")
		.toLowerCase()
		.trim()
		.replace(/^[.,!?;:"“”]+|[.,!?;:"“”]+$/g, "");
	const variants = entries[key];
	if (verified?.length) {
		return (
			<div className="mt-3">
				<Eyebrow>Reference pronunciation (IPA)</Eyebrow>
				<p className="ipa mt-1 text-lg">
					{verified.map((ipa) => `/${ipa}/`).join(" · ")}
				</p>
			</div>
		);
	}
	return (
		<div className="mt-3">
			<Eyebrow>Dictionary reference (IPA)</Eyebrow>
			{variants?.length ? (
				<>
					<p className="mt-1 text-xs text-[var(--color-ink-soft)]">
						General American English · dictionary variants
					</p>
					<ul className="mt-2 space-y-2">
						{variants.map((variant) => (
							<li key={`${variant.ipa}-${variant.stress.join("-")}`}>
								<p className="ipa text-lg">/{variant.ipa}/</p>
								{variant.stress.length > 0 && (
									<p className="text-xs text-[var(--color-ink-soft)]">
										Vowel stress, in order:{" "}
										{variant.stress.join(" · ")}
									</p>
								)}
							</li>
						))}
					</ul>
					<p className="mt-2 text-xs text-[var(--color-ink-faint)]">
						General dictionary reference; corpus judgments are unchanged.
					</p>
				</>
			) : (
				<p className="mt-1 text-xs text-[var(--color-ink-faint)]">
					This word form is not in the reference dictionary.
				</p>
			)}
			<p className="mt-2 text-xs text-[var(--color-ink-faint)]">
				<a
					className="underline"
					href={dictionary.source.url}
					target="_blank"
					rel="noreferrer"
				>
					{dictionary.source.name} v{dictionary.source.version}
				</a>
				{" · "}
				<a
					className="underline"
					href={dictionary.source.licenseUrl}
					target="_blank"
					rel="noreferrer"
				>
					{dictionary.source.license}
				</a>
				{" · IPA conversion; stress shown separately."}
			</p>
		</div>
	);
}
