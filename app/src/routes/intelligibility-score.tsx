import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { NounceLogo } from "@/components/ui/nounce";

export const Route = createFileRoute("/intelligibility-score")({
	component: IntelligibilityRatingPage,
});

const ACCESS_CODE = "nounce-fiverr";

// 0–10 intelligibility scale (0 = unintelligible, 10 = native-like)
const SCORES = Array.from({ length: 11 }, (_, i) => i);

interface Clip {
	clip_id: string;
	file: string;
	sentence: string;
	is_anchor: boolean;
}
interface Rating {
	score: number;
	notes: string;
	ts: number;
}

// deterministic per-rater order, stable across reloads (no Math.random)
function seededShuffle(ids: string[], seed: string): string[] {
	let h = 2166136261;
	for (const c of seed) {
		h ^= c.charCodeAt(0);
		h = Math.imul(h, 16777619);
	}
	const rng = () => {
		h = Math.imul(h ^ (h >>> 15), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
	};
	const a = ids.slice();
	for (let i = a.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[a[i], a[j]] = [a[j], a[i]];
	}
	return a;
}

const lsKey = (name: string) => `nounce_intel_${name.trim().toLowerCase()}`;

function IntelligibilityRatingPage() {
	const [clips, setClips] = useState<Clip[]>([]);
	const [loadError, setLoadError] = useState("");
	const [phase, setPhase] = useState<"gate" | "rate">("gate");
	const [code, setCode] = useState("");
	const [name, setName] = useState("");
	const [gateError, setGateError] = useState("");
	const [idx, setIdx] = useState(0);
	const [ratings, setRatings] = useState<Record<string, Rating>>({});

	useEffect(() => {
		fetch("/intelligibility/clips.json")
			.then((r) => {
				if (!r.ok) throw new Error("not found");
				return r.json();
			})
			.then((d: { clips: Clip[] }) => setClips(d.clips))
			.catch(() =>
				setLoadError(
					"Could not load the rating set. Please tell whoever sent you this.",
				),
			);
	}, []);

	const order = useMemo(
		() =>
			phase === "rate"
				? seededShuffle(
						clips.map((c) => c.clip_id),
						name,
					)
				: [],
		[phase, clips, name],
	);
	// clamp so a stray out-of-range idx never blanks the screen
	const safeIdx = order.length
		? Math.min(Math.max(idx, 0), order.length - 1)
		: 0;
	const current = order.length
		? clips.find((c) => c.clip_id === order[safeIdx])
		: undefined;
	const doneCount = Object.keys(ratings).length;
	const allDone = order.length > 0 && doneCount >= order.length;

	function start() {
		if (code.trim() !== ACCESS_CODE) {
			setGateError("That access code isn't right.");
			return;
		}
		if (!name.trim()) {
			setGateError("Please enter your name.");
			return;
		}
		const saved = JSON.parse(
			localStorage.getItem(lsKey(name)) || "{}",
		) as Record<string, Rating>;
		setRatings(saved);
		const ord = seededShuffle(
			clips.map((c) => c.clip_id),
			name,
		);
		const firstUnrated = ord.findIndex((id) => !(id in saved));
		setIdx(firstUnrated < 0 ? ord.length - 1 : firstUnrated);
		setPhase("rate");
	}

	function rate(score: number) {
		if (!current) return;
		const next = {
			...ratings,
			[current.clip_id]: {
				score,
				notes: ratings[current.clip_id]?.notes ?? "",
				ts: Date.now(),
			},
		};
		setRatings(next);
		localStorage.setItem(lsKey(name), JSON.stringify(next));
		if (idx < order.length - 1)
			setTimeout(() => setIdx((i) => Math.min(order.length - 1, i + 1)), 180);
	}

	function setNotes(notes: string) {
		if (!current) return;
		const existing = ratings[current.clip_id];
		if (!existing) return; // notes only attach to a scored clip
		const next = { ...ratings, [current.clip_id]: { ...existing, notes } };
		setRatings(next);
		localStorage.setItem(lsKey(name), JSON.stringify(next));
	}

	function exportCsv() {
		const rows: string[][] = [
			["rater_name", "clip_id", "score", "notes", "rated_at"],
		];
		for (const c of clips) {
			const r = ratings[c.clip_id];
			if (r)
				rows.push([
					name.trim(),
					c.clip_id,
					String(r.score),
					(r.notes || "").replace(/[\n,]/g, " "),
					new Date(r.ts).toISOString(),
				]);
		}
		const csv = rows.map((r) => r.join(",")).join("\n");
		const blob = new Blob([csv], { type: "text/csv" });
		const a = document.createElement("a");
		a.href = URL.createObjectURL(blob);
		const safe =
			name
				.trim()
				.replace(/[^\w\s-]/g, "")
				.replace(/\s+/g, " ")
				.trim() || "rater";
		const day = new Date().toISOString().slice(0, 10);
		a.download = `Nounce pronunciation ratings - ${safe} (${day}).csv`;
		a.click();
	}

	return (
		<div className="flex min-h-screen flex-col bg-linear-to-b from-background to-muted/20">
			<header className="flex items-center justify-between px-6 py-4">
				<NounceLogo height={22} />
				<span className="text-muted-foreground text-xs">
					pronunciation study
				</span>
			</header>

			<main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6">
				{loadError && (
					<div className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm">
						{loadError}
					</div>
				)}

				{phase === "gate" && !loadError && (
					<div className="space-y-6">
						<div>
							<h1 className="font-display font-semibold text-2xl tracking-tight">
								Help rate English pronunciation
							</h1>
							<p className="mt-2 text-muted-foreground text-sm leading-relaxed">
								You'll hear {clips.length || "a few"} short clips of English
								sentences read aloud, in a random order. For each one, rate how{" "}
								<b>intelligible / native-like the pronunciation</b> is on a{" "}
								<b>0–10 scale</b> (0 = unintelligible, 10 = native-like). It
								takes about 5–10 minutes, and your progress is saved on this
								device. Thank you!
							</p>
							<div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm leading-relaxed">
								<b>Please judge the English sounds, not the recording.</b> These
								are informal recordings, so ignore microphone noise, volume,
								echo, or loudness. Focus only on how accurately the English
								phones (the consonants and vowels) are pronounced.
							</div>
						</div>
						<div className="space-y-3 rounded-2xl border border-border bg-card p-6">
							<label className="block text-sm">
								<span className="text-muted-foreground">Access code</span>
								<input
									value={code}
									onChange={(e) => setCode(e.target.value)}
									className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
									placeholder="provided in your invite"
								/>
							</label>
							<label className="block text-sm">
								<span className="text-muted-foreground">
									Your name (native English speaker)
								</span>
								<input
									value={name}
									onChange={(e) => setName(e.target.value)}
									onKeyDown={(e) => e.key === "Enter" && start()}
									className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
									placeholder="e.g. Alex Johnson"
								/>
							</label>
							{gateError && (
								<p className="text-destructive text-sm">{gateError}</p>
							)}
							<button
								type="button"
								onClick={start}
								disabled={!clips.length}
								className="w-full rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm disabled:opacity-40"
							>
								Start rating
							</button>
						</div>
					</div>
				)}

				{phase === "rate" && current && (
					<div className="space-y-4">
						{/* per-clip progress dots — filled when rated, click to jump */}
						<div className="flex flex-wrap justify-center gap-1.5">
							{order.map((id, i) => {
								const rated = id in ratings;
								const isCurrent = i === safeIdx;
								return (
									<button
										type="button"
										key={id}
										onClick={() => setIdx(i)}
										title={`clip ${i + 1}${rated ? " — rated" : ""}`}
										className={`flex h-7 w-7 items-center justify-center rounded-full border font-medium text-[10px] transition-colors ${
											rated
												? "border-primary bg-primary text-primary-foreground"
												: "border-border bg-muted text-muted-foreground hover:border-primary/60"
										} ${isCurrent ? "ring-2 ring-ring ring-offset-1 ring-offset-background" : ""}`}
									>
										{i + 1}
									</button>
								);
							})}
						</div>

						<div className="space-y-4 rounded-2xl border border-border bg-card p-6">
							<div className="flex items-center justify-between">
								<span className="rounded-full bg-muted px-2.5 py-0.5 text-muted-foreground text-xs">
									clip {safeIdx + 1} of {order.length}
								</span>
								<span className="text-muted-foreground text-xs">
									{doneCount} rated
								</span>
							</div>

							<p className="font-medium text-lg leading-snug">
								{current.sentence}
							</p>

							{/* key forces the player to reload the new source */}
							<audio
								key={current.clip_id}
								controls
								preload="auto"
								className="w-full"
							>
								<source src={`/intelligibility/${current.file}`} />
								<track kind="captions" />
							</audio>

							<p className="text-muted-foreground text-xs">
								Rate the <b>pronunciation of the English sounds</b> — ignore
								audio quality (mic noise, volume, echo).
							</p>
							<div className="grid grid-cols-11 gap-1.5">
								{SCORES.map((s) => {
									const sel = ratings[current.clip_id]?.score === s;
									return (
										<button
											type="button"
											key={s}
											onClick={() => rate(s)}
											className={`rounded-lg border-2 py-2.5 font-semibold transition-colors ${
												sel
													? "border-primary bg-primary/10"
													: "border-border bg-background hover:border-primary/60"
											}`}
										>
											{s}
										</button>
									);
								})}
							</div>
							<div className="flex justify-between text-[10px] text-muted-foreground">
								<span>0 · unintelligible</span>
								<span>10 · native-like</span>
							</div>

							<textarea
								value={ratings[current.clip_id]?.notes ?? ""}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="optional note (e.g. a sound that stood out)"
								className="min-h-[52px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
							/>

							<div className="flex items-center justify-between">
								<button
									type="button"
									onClick={() => setIdx((i) => Math.max(0, i - 1))}
									disabled={idx === 0}
									className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
								>
									← back
								</button>
								<span className="text-muted-foreground text-xs">
									saved on this device
								</span>
								<button
									type="button"
									onClick={() =>
										setIdx((i) => Math.min(order.length - 1, i + 1))
									}
									disabled={idx >= order.length - 1}
									className="rounded-lg border border-border px-3 py-1.5 text-sm disabled:opacity-40"
								>
									next →
								</button>
							</div>
						</div>

						<div className="rounded-2xl border border-border bg-card p-5 text-center">
							{allDone ? (
								<p className="mb-3 font-medium text-sm">
									All {order.length} rated — thank you! Download your ratings
									and send the file back.
								</p>
							) : (
								<p className="mb-3 text-muted-foreground text-sm">
									You can download anytime and finish later (same name resumes).
								</p>
							)}
							<button
								type="button"
								onClick={exportCsv}
								className="rounded-lg bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm"
							>
								Download my ratings
							</button>
						</div>
					</div>
				)}
			</main>
		</div>
	);
}
