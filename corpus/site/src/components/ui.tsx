// Shared visual primitives for the specimen-sheet aesthetic.

import type { ReactNode } from "react";
import type { Outcome } from "@/lib/types";

/** An IPA glyph in Doulos SIL, optionally slashed. */
export function IPA({
	phone,
	slash = true,
	className = "",
}: {
	phone: string | null;
	slash?: boolean;
	className?: string;
}) {
	const text = phone ? (slash ? `/${phone}/` : phone) : "∅";
	return <span className={`ipa ${className}`}>{text}</span>;
}

const ERROR_COLOR: Record<Outcome, string> = {
	correct: "var(--color-correct)",
	incorrect: "var(--color-incorrect)",
};

export function errorColor(e: Outcome): string {
	return ERROR_COLOR[e];
}

/** A horizontal correct/incorrect proportion bar with a hairline frame. */
export function AccuracyBar({
	correct,
	incorrect,
	height = 8,
}: {
	correct: number;
	incorrect: number;
	height?: number;
}) {
	const total = correct + incorrect || 1;
	const seg = (n: number) => `${(n / total) * 100}%`;
	return (
		<div
			className="flex w-full overflow-hidden rounded-[2px] ring-1 ring-[var(--color-rule)]"
			style={{ height }}
			role="img"
			aria-label={`${correct} correct, ${incorrect} incorrect`}
		>
			<div style={{ width: seg(correct), background: "var(--color-correct)" }} />
			<div
				style={{ width: seg(incorrect), background: "var(--color-incorrect)" }}
			/>
		</div>
	);
}

/** A small metric tile: big tabular figure over a mono label. */
export function StatTile({
	label,
	value,
	sub,
	accent,
}: {
	label: string;
	value: ReactNode;
	sub?: ReactNode;
	accent?: boolean;
}) {
	return (
		<div className="border-[var(--color-rule)] border-l pl-3">
			<div className="eyebrow">{label}</div>
			<div
				className="tnum mt-1 font-display text-2xl leading-none"
				style={{ color: accent ? "var(--color-accent)" : "var(--color-ink)" }}
			>
				{value}
			</div>
			{sub && (
				<div className="mt-1 text-[var(--color-ink-faint)] text-xs">{sub}</div>
			)}
		</div>
	);
}

export function Eyebrow({ children }: { children: ReactNode }) {
	return <div className="eyebrow">{children}</div>;
}

/** A hairline-framed card on slightly deeper paper. */
export function Card({
	children,
	className = "",
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div
			className={`rounded-[var(--radius-card)] border border-[var(--color-rule)] bg-[var(--color-paper-deep)]/40 ${className}`}
		>
			{children}
		</div>
	);
}

export function Legend() {
	const items: [string, string, number][] = [
		["Correct", "var(--color-correct)", 1],
		["Incorrect", "var(--color-incorrect)", 1],
	];
	return (
		<div className="flex flex-wrap items-center gap-x-4 gap-y-1">
			{items.map(([label, color, opacity]) => (
				<span key={label} className="flex items-center gap-1.5">
					<span
						className="inline-block h-2.5 w-2.5 rounded-[1px]"
						style={{ background: color, opacity }}
					/>
					<span className="text-[var(--color-ink-soft)] text-xs">{label}</span>
				</span>
			))}
		</div>
	);
}

export function Spinner({ label }: { label?: string }) {
	return (
		<div className="flex items-center gap-2 text-[var(--color-ink-faint)] text-sm">
			<span className="inline-block h-3 w-3 animate-spin rounded-full border-[var(--color-ink-faint)] border-t-transparent border-2" />
			{label ?? "Loading…"}
		</div>
	);
}
