import { useEffect, useRef, useState } from "react";
import { clipURL, loadUtterance } from "@/lib/api";
import { num } from "@/lib/labels";
import type { SpeakerMeta, UtteranceDetail } from "@/lib/types";
import { PitchPlot } from "./PitchPlot";
import { RhythmStrip } from "./RhythmView";
import { errorColor, Eyebrow, Spinner } from "./ui";

export function UtterancePanel({
	id,
	focusToken,
	speakers,
	onClose,
}: {
	id: string;
	focusToken?: string;
	speakers: Record<string, SpeakerMeta>;
	onClose: () => void;
}) {
	const [utt, setUtt] = useState<UtteranceDetail | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const audioRef = useRef<HTMLAudioElement>(null);
	const [playhead, setPlayhead] = useState<number | null>(null);

	useEffect(() => {
		setUtt(null);
		setErr(null);
		loadUtterance(id).then(setUtt).catch((e) => setErr(String(e)));
	}, [id]);

	// Escape closes.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [onClose]);

	const seek = (t0: number) => {
		const a = audioRef.current;
		if (!a) return;
		a.currentTime = Math.max(0, t0);
		a.play().catch(() => {});
	};

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				aria-label="Close"
				onClick={onClose}
				className="absolute inset-0 bg-[var(--color-ink)]/25 backdrop-blur-[1px]"
			/>
			<div className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-[var(--color-rule-strong)] border-l bg-[var(--color-paper)] shadow-2xl">
				<div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-[var(--color-rule)] border-b bg-[var(--color-paper)]/90 px-6 py-4 backdrop-blur">
					<div>
						<Eyebrow>Utterance · {id}</Eyebrow>
						{utt && (
							<SpeakerLine id={utt.spk} meta={speakers[utt.spk]} task={utt.task} />
						)}
					</div>
					<button
						type="button"
						onClick={onClose}
						className="rounded-[2px] px-2 py-1 font-mono text-[var(--color-ink-faint)] text-sm hover:bg-[var(--color-paper-deep)]"
					>
						Esc ✕
					</button>
				</div>

				<div className="flex-1 px-6 py-5">
					{err && <ErrorNote err={err} />}
					{!utt && !err && <Spinner label="Loading utterance…" />}
					{utt && (
						<div className="rise space-y-6">
							{utt.text && (
								<p className="font-body text-[var(--color-ink)] text-lg italic leading-snug">
									“{utt.text}”
								</p>
							)}

							{utt.audioAvailable === false ? (
								<p className="rounded-[var(--radius-card)] border border-dashed border-[var(--color-rule)] p-3 text-[var(--color-ink-faint)] text-xs">
									Audio is unavailable for this utterance; its corpus annotations remain available.
								</p>
							) : (
							<audio
									ref={audioRef}
								src={clipURL(utt.clip ?? "")}
									controls
									preload="none"
									onTimeUpdate={(e) => setPlayhead(e.currentTarget.currentTime)}
									className="w-full"
								/>
							)}

							<PhoneStrip utt={utt} onSeek={seek} focusToken={focusToken} />

							{utt.pitch ? (
								<section>
									<div className="mb-1.5 flex items-baseline justify-between">
										<Eyebrow>Intonation · F0 contour</Eyebrow>
										<span className="tnum font-mono text-[var(--color-ink-faint)] text-xs">
											{num(utt.pitch.min)}–{num(utt.pitch.max)} Hz
										</span>
									</div>
									<div className="rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper-deep)]/30 p-2">
										<PitchPlot pitch={utt.pitch} playhead={playhead} />
									</div>
								</section>
							) : (
								<NoPitch />
							)}

							<section>
								<Eyebrow>Rhythm metrics</Eyebrow>
								<div className="mt-2">
									<RhythmStrip r={utt.rhythm} />
								</div>
							</section>

							{!utt.judged && (
								<p className="rounded-[var(--radius-card)] border border-[var(--color-insert)]/40 bg-[var(--color-insert-wash)]/50 p-3 text-[var(--color-ink-soft)] text-xs">
									This recording has no corpus-native correctness judgment; its
									annotated phones are shown as transcribed.
								</p>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}

function PhoneStrip({
	utt,
	onSeek,
	focusToken,
}: {
	utt: UtteranceDetail;
	onSeek: (t: number) => void;
	focusToken?: string;
}) {
	return (
		<section>
			<Eyebrow>Annotated phones — click to hear</Eyebrow>
			<div className="mt-2 flex flex-wrap gap-1">
				{utt.tokens.map((t) => {
					const focused = t.id === focusToken;
					return (
						<button
							key={t.id}
							type="button"
							onClick={() => onSeek(t.t0)}
							title={`${t.ph ?? "∅"} · ${t.t0.toFixed(2)}s`}
							className={`group relative rounded-[2px] border px-1.5 py-1 transition-colors ${
								focused
									? "border-[var(--color-accent)] bg-[var(--color-accent)]/10"
									: "border-transparent hover:bg-[var(--color-paper-deep)]"
							}`}
						>
							<span
								className="ipa block text-lg leading-none"
								style={{ color: errorColor(t.e) }}
							>
								{t.ph ?? "∅"}
							</span>
							<span
								className="mt-1 block h-0.5 w-full rounded"
								style={{ background: errorColor(t.e), opacity: 0.5 }}
							/>
						</button>
					);
				})}
			</div>
		</section>
	);
}

function SpeakerLine({
	id,
	meta,
	task,
}: {
	id: string;
	meta?: SpeakerMeta;
	task: string | null;
}) {
	const parts: string[] = [id];
	if (task) parts.push(task === "T1" ? "read-aloud" : "interview");
	if (meta?.sex && meta.sex !== "u")
		parts.push(meta.sex === "f" ? "female" : meta.sex === "m" ? "male" : meta.sex);
	const cefr = meta?.["learner_level_CEFR_conversion"];
	if (typeof cefr === "string") parts.push(cefr);
	const age = meta?.["age"];
	if (typeof age === "string" || typeof age === "number")
		parts.push(`age ${age}`);
	return (
		<h3 className="mt-0.5 font-display text-xl">
			{parts.map((p, i) => (
				<span key={p}>
					{i > 0 && (
						<span className="mx-1.5 text-[var(--color-ink-faint)]">·</span>
					)}
					<span
						className={i === 0 ? "font-mono text-lg" : "text-[var(--color-ink-soft)] text-base"}
					>
						{p}
					</span>
				</span>
			))}
		</h3>
	);
}

function NoPitch() {
	return (
		<section className="rounded-[var(--radius-card)] border border-[var(--color-rule)] border-dashed p-3 text-[var(--color-ink-faint)] text-xs">
			No pitch contour for this utterance. Contours are extracted with
			Parselmouth at build time; if it wasn’t installed, this area is empty
			while every other measure still works.
		</section>
	);
}

function ErrorNote({ err }: { err: string }) {
	return (
		<div className="rounded-[var(--radius-card)] border border-[var(--color-incorrect)]/40 bg-[var(--color-incorrect-wash)]/50 p-3 text-[var(--color-ink-soft)] text-sm">
			Could not load this utterance. {err}
		</div>
	);
}
