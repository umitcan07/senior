import { useMemo } from "react";
import type { PitchContourData } from "@/lib/types";

// SVG F0 contour. Unvoiced frames (null) break the line into segments, so the
// track reads as the discontinuous thing pitch actually is.

export function PitchPlot({
	pitch,
	playhead,
	width = 640,
	height = 130,
}: {
	pitch: PitchContourData;
	playhead?: number | null; // seconds
	width?: number;
	height?: number;
}) {
	const pad = { l: 34, r: 8, t: 10, b: 18 };
	const innerW = width - pad.l - pad.r;
	const innerH = height - pad.t - pad.b;

	const { tMin, tMax, fMin, fMax, segments } = useMemo(() => {
		const times = pitch.times;
		const tMin = times[0] ?? 0;
		const tMax = times[times.length - 1] ?? 1;
		// Pad the Hz range a little so the line isn't flush to the frame.
		const lo = (pitch.min ?? 80) - 10;
		const hi = (pitch.max ?? 300) + 10;

		const x = (t: number) => ((t - tMin) / (tMax - tMin || 1)) * innerW;
		const y = (f: number) => innerH - ((f - lo) / (hi - lo || 1)) * innerH;

		// Break into voiced runs.
		const segs: string[] = [];
		let cur: string[] = [];
		pitch.f0.forEach((f, i) => {
			if (f === null) {
				if (cur.length) segs.push(cur.join(" "));
				cur = [];
			} else {
				cur.push(`${cur.length ? "L" : "M"} ${x(times[i]).toFixed(1)} ${y(f).toFixed(1)}`);
			}
		});
		if (cur.length) segs.push(cur.join(" "));

		return { tMin, tMax, fMin: lo, fMax: hi, segments: segs };
	}, [pitch, innerW, innerH]);

	const yTicks = [fMin, (fMin + fMax) / 2, fMax].map(Math.round);
	const xOfTime = (t: number) =>
		pad.l + ((t - tMin) / (tMax - tMin || 1)) * innerW;
	const yOfHz = (f: number) =>
		pad.t + innerH - ((f - fMin) / (fMax - fMin || 1)) * innerH;

	return (
		<svg
			viewBox={`0 0 ${width} ${height}`}
			className="w-full"
			role="img"
			aria-label="Pitch contour"
		>
			<title>F0 contour</title>
			{/* gridlines */}
			{yTicks.map((hz) => (
				<g key={hz}>
					<line
						x1={pad.l}
						x2={width - pad.r}
						y1={yOfHz(hz)}
						y2={yOfHz(hz)}
						stroke="var(--color-rule)"
						strokeWidth={0.75}
						strokeDasharray="2 3"
					/>
					<text
						x={pad.l - 6}
						y={yOfHz(hz) + 3}
						textAnchor="end"
						className="fill-[var(--color-ink-faint)] font-mono"
						fontSize={9}
					>
						{hz}
					</text>
				</g>
			))}
			{/* contour segments */}
			{segments.map((d, i) => (
				<path
					key={i}
					d={d}
					transform={`translate(${pad.l} ${pad.t})`}
					fill="none"
					stroke="var(--color-correct)"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			))}
			{/* playhead */}
			{playhead != null && playhead >= tMin && playhead <= tMax && (
				<line
					x1={xOfTime(playhead)}
					x2={xOfTime(playhead)}
					y1={pad.t}
					y2={pad.t + innerH}
					stroke="var(--color-accent)"
					strokeWidth={1.5}
				/>
			)}
			<text
				x={pad.l}
				y={height - 5}
				className="fill-[var(--color-ink-faint)] font-mono"
				fontSize={9}
			>
				Hz · {(tMax - tMin).toFixed(1)}s
			</text>
		</svg>
	);
}
