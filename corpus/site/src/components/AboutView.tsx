import aboutMd from "@/content/about.md?raw";
import { Markdown } from "@/lib/markdown";
import type { Manifest } from "@/lib/types";

const PITCH_BACKEND_LABELS: Record<Manifest["build"]["pitchBackend"], string> = {
	parselmouth: "Praat (Parselmouth)",
	"numpy-autocorr": "autocorrelation fallback",
	none: "not extracted",
};

export function AboutView({ manifest }: { manifest: Manifest }) {
	const { build, speakers, warnings } = manifest;
	const nSpeakers = Object.keys(speakers).length;

	return (
		<div className="max-w-2xl">
			<Markdown source={aboutMd} />

			<section className="mt-10">
				<h2 className="mb-3 border-[var(--color-rule)] border-b pb-1.5 font-display text-xl">
					This build
				</h2>
				<p className="mb-4 font-body text-[0.95rem] text-[var(--color-ink-soft)] leading-relaxed">
					Read from the corpus at build time, so it always describes the data
					actually on this site.
				</p>
				<dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
					<Fact label="Speakers" value={nSpeakers.toLocaleString()} />
					<Fact
						label="Recordings"
						value={build.files.toLocaleString()}
					/>
					<Fact
						label="Utterances"
						value={build.utterances.toLocaleString()}
					/>
					<Fact label="Audio clips" value={build.clips ? "published" : "none"} />
					<Fact
						label="Pitch extraction"
						value={PITCH_BACKEND_LABELS[build.pitchBackend]}
					/>
					<Fact
						label="Build warnings"
						value={warnings.length === 0 ? "none" : warnings.length.toString()}
					/>
				</dl>

				{warnings.length > 0 && (
					<details className="mt-4 rounded-[var(--radius-card)] border border-[var(--color-rule)] p-3">
						<summary className="cursor-pointer font-mono text-[var(--color-ink-soft)] text-xs">
							{warnings.length} warning{warnings.length === 1 ? "" : "s"} from
							the build
						</summary>
						<ul className="mt-2 space-y-1">
							{warnings.map((w) => (
								<li
									key={w}
									className="font-mono text-[0.7rem] text-[var(--color-ink-faint)] leading-relaxed"
								>
									{w}
								</li>
							))}
						</ul>
					</details>
				)}
			</section>
		</div>
	);
}

function Fact({ label, value }: { label: string; value: string }) {
	return (
		<div className="border-[var(--color-rule)] border-l pl-3">
			<dt className="eyebrow">{label}</dt>
			<dd className="tnum mt-0.5 font-display text-lg leading-none">{value}</dd>
		</div>
	);
}
