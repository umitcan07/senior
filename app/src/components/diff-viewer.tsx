import { RiInformationLine } from "@remixicon/react";
import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { DIFF_VIEW_STORAGE_KEY_PREFIX } from "@/lib/constants";
import {
	buildDiff,
	type DiffCell,
	type DiffError,
	errorBgVariants,
	errorBorderVariants,
	errorTextVariants,
} from "@/lib/diff-viewer";
import { cn } from "@/lib/utils";

// Three diff visualizations, all driven by the aligned `cells` model.
type DiffMode = "stacked" | "strike" | "blocks";

const MODES: { id: DiffMode; label: string }[] = [
	{ id: "stacked", label: "Stacked" },
	{ id: "strike", label: "Strike" },
	{ id: "blocks", label: "Blocks" },
];

const DEFAULT_MODE: DiffMode = "stacked";

interface DiffViewerProps {
	target: string;
	recognized: string;
	errors: DiffError[];
	type: "phoneme" | "word";
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
}

const INFO_CONTENT = {
	word: "Based on ASR (Automatic Speech Recognition). May not capture all nuances and might auto-correct some errors. Still valuable as it simulates how a native speaker might interpret your speech.",
	phoneme:
		"Detailed phonetic analysis comparing expected pronunciation with what was detected. Phoneme-level comparison provides granular feedback on individual sounds.",
};

/** Remember the chosen mode per comparison type, across sessions. */
function useDiffMode(type: "phoneme" | "word") {
	const key = `${DIFF_VIEW_STORAGE_KEY_PREFIX}-${type}`;
	const [mode, setMode] = useState<DiffMode>(() => {
		if (typeof window === "undefined") return DEFAULT_MODE;
		const stored = localStorage.getItem(key);
		return MODES.some((m) => m.id === stored)
			? (stored as DiffMode)
			: DEFAULT_MODE;
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem(key, mode);
	}, [key, mode]);

	return [mode, setMode] as const;
}

// "reference" = the target/expected phone; "your" = what we detected in the
// recording. Only the "your" side can play audio (we segment the user clip).
type Role = "reference" | "your";

/** Safely extract play timestamps (narrows the PhonemeError | WordError union). */
function getTimestamps(
	error?: DiffError,
): { start: number; end: number } | null {
	if (
		error &&
		"timestampStartMs" in error &&
		error.timestampStartMs != null &&
		"timestampEndMs" in error &&
		error.timestampEndMs != null
	) {
		return { start: error.timestampStartMs, end: error.timestampEndMs };
	}
	return null;
}

function sizing(type: "phoneme" | "word") {
	return type === "phoneme" ? "font-ipa text-base" : "text-sm";
}

/** Tooltip showing which side a token belongs to, the phone, and a play hint. */
function Hover({
	side,
	phone,
	playable,
	children,
}: {
	side: Role;
	phone?: string | null;
	playable?: boolean;
	children: React.ReactNode;
}) {
	return (
		<TooltipProvider>
			<Tooltip>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent side="top" className="text-xs">
					<span className="font-medium">
						{side === "reference" ? "Reference" : "Your"}
					</span>
					{phone && <span className="ml-1.5 font-ipa">/{phone}/</span>}
					{playable && <span className="ml-1.5 text-primary">▶ Play</span>}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}

interface BoxProps {
	text: string;
	tone: "equal" | DiffError["errorType"];
	side?: Role;
	error?: DiffError;
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
	className?: string;
	bordered?: boolean;
	rounded?: boolean;
}

/** A single phone tile. Colored by tone; the "your" side plays its segment. */
function Box({
	text,
	tone,
	side,
	error,
	audioSrc,
	onSegmentClick,
	className,
	bordered = true,
	rounded = true,
}: BoxProps) {
	const colorCls =
		tone === "equal"
			? "text-foreground/70"
			: cn(
					errorBgVariants({ errorType: tone }),
					errorTextVariants({ errorType: tone }),
				);
	const borderCls =
		bordered &&
		(tone === "equal"
			? "border border-border/40 bg-card/40"
			: cn("border font-medium", errorBorderVariants({ errorType: tone })));

	const ts = getTimestamps(error);
	const canPlay = side === "your" && !!ts && !!audioSrc && !!onSegmentClick;

	const base = cn(
		"inline-flex items-center justify-center px-1.5 py-0.5",
		rounded && "rounded-md",
		colorCls,
		borderCls,
		className,
	);

	const handleClick = () => {
		if (canPlay && ts) onSegmentClick?.(ts.start, ts.end);
	};

	// Equal/no-side tiles are inert and untipped.
	if (tone === "equal" || !side) {
		return <span className={base}>{text}</span>;
	}

	return (
		<Hover side={side} phone={text} playable={canPlay}>
			<button
				type="button"
				disabled={!canPlay}
				onClick={handleClick}
				className={cn(
					base,
					"outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
					canPlay ? "cursor-pointer hover:brightness-110" : "cursor-default",
				)}
			>
				{text}
			</button>
		</Hover>
	);
}

interface ViewProps {
	cells: DiffCell[];
	type: "phoneme" | "word";
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
}

const PANEL = "rounded-md bg-card/40 p-3";

/**
 * Default. Inline line of tiles; a substitution stacks your phone over the
 * reference phone, each the same tile size as a normal phone.
 *   [a] [b/d] [c] [e]   — d sits under b but is a full tile.
 */
function StackedView({ cells, type, audioSrc, onSegmentClick }: ViewProps) {
	const s = sizing(type);
	return (
		<div className={cn(PANEL, "flex flex-wrap items-start gap-1")}>
			{cells.map((cell, index) => {
				const key = `${cell.kind}-${index}`;
				if (cell.kind === "equal")
					return (
						<Box
							key={key}
							text={cell.segment}
							tone="equal"
							className={cn(s, "min-w-7")}
						/>
					);
				if (cell.kind === "substitute")
					return (
						<span key={key} className="flex flex-col gap-0.5">
							<Box
								text={cell.actual}
								tone="substitute"
								side="your"
								error={cell.error}
								audioSrc={audioSrc}
								onSegmentClick={onSegmentClick}
								className={cn(s, "min-w-7")}
							/>
							<Box
								text={cell.expected}
								tone="substitute"
								side="reference"
								className={cn(s, "min-w-7")}
							/>
						</span>
					);
				return (
					<Box
						key={key}
						text={cell.segment}
						tone={cell.kind}
						side={cell.kind === "insert" ? "your" : "reference"}
						error={cell.error}
						audioSrc={audioSrc}
						onSegmentClick={onSegmentClick}
						className={cn(s, "min-w-7")}
					/>
				);
			})}
		</div>
	);
}

/**
 * Inline line of tiles; a substitution is one tile split by a subtle vertical
 * divider — reference on the left, your phone on the right.
 */
function StrikeView({ cells, type, audioSrc, onSegmentClick }: ViewProps) {
	const s = sizing(type);
	return (
		<div className={cn(PANEL, "flex flex-wrap items-center gap-1")}>
			{cells.map((cell, index) => {
				const key = `${cell.kind}-${index}`;
				if (cell.kind === "equal")
					return (
						<Box
							key={key}
							text={cell.segment}
							tone="equal"
							className={cn(s, "min-w-7")}
						/>
					);
				if (cell.kind === "substitute") {
					const ts = getTimestamps(cell.error);
					const canPlay = !!ts && !!audioSrc && !!onSegmentClick;
					return (
						<span
							key={key}
							className={cn(
								"inline-flex items-stretch overflow-hidden rounded-md border font-medium",
								errorBorderVariants({ errorType: "substitute" }),
								errorBgVariants({ errorType: "substitute" }),
								errorTextVariants({ errorType: "substitute" }),
							)}
						>
							<Hover side="reference" phone={cell.expected}>
								<span className={cn(s, "flex items-center px-1.5 py-0.5")}>
									{cell.expected}
								</span>
							</Hover>
							<span aria-hidden className="w-px bg-destructive/40" />
							<Hover side="your" phone={cell.actual} playable={canPlay}>
								<button
									type="button"
									disabled={!canPlay}
									onClick={() =>
										canPlay && ts && onSegmentClick?.(ts.start, ts.end)
									}
									className={cn(
										s,
										"flex items-center px-1.5 py-0.5 outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
										canPlay
											? "cursor-pointer hover:brightness-110"
											: "cursor-default",
									)}
								>
									{cell.actual}
								</button>
							</Hover>
						</span>
					);
				}
				return (
					<Box
						key={key}
						text={cell.segment}
						tone={cell.kind}
						side={cell.kind === "insert" ? "your" : "reference"}
						error={cell.error}
						audioSrc={audioSrc}
						onSegmentClick={onSegmentClick}
						className={cn(s, "min-w-7")}
					/>
				);
			})}
		</div>
	);
}

/**
 * Dense aligned grid: two fixed-width rows (reference / your) that line up
 * cell-for-cell, square cells separated by a very subtle divider, only the
 * overall block is rounded.
 */
function BlocksView({ cells, type, audioSrc, onSegmentClick }: ViewProps) {
	const s = sizing(type);
	const cellCls =
		"min-w-6 border-border/20 border-r px-1 py-1 text-center last:border-r-0";

	const renderRow = (
		side: (c: DiffCell) => {
			text: string;
			tone: "equal" | DiffError["errorType"] | "gap";
			error?: DiffError;
		},
		sideRole: Role,
	) =>
		cells.map((cell, index) => {
			const { text, tone, error } = side(cell);
			const key = `${sideRole}-${cell.kind}-${index}`;
			if (tone === "gap")
				return (
					<span
						key={key}
						className={cn(s, cellCls, "text-muted-foreground/25")}
					>
						·
					</span>
				);
			return (
				<Box
					key={key}
					text={text}
					tone={tone}
					side={tone === "equal" ? undefined : sideRole}
					error={error}
					audioSrc={audioSrc}
					onSegmentClick={onSegmentClick}
					bordered={false}
					rounded={false}
					className={cn(s, cellCls)}
				/>
			);
		});

	return (
		<div className="space-y-1.5 overflow-x-auto rounded-md border border-border/40 bg-card/40 p-3">
			<div className="text-[10px] text-muted-foreground uppercase tracking-wider">
				Reference
			</div>
			<div className="flex">{renderRow(targetSide, "reference")}</div>
			<div className="pt-1 text-[10px] text-muted-foreground uppercase tracking-wider">
				Your
			</div>
			<div className="flex">{renderRow(detectedSide, "your")}</div>
		</div>
	);
}

const GAP = "·";

function targetSide(cell: DiffCell): {
	text: string;
	tone: "equal" | DiffError["errorType"] | "gap";
	error?: DiffError;
} {
	switch (cell.kind) {
		case "equal":
			return { text: cell.segment, tone: "equal" };
		case "substitute":
			return { text: cell.expected, tone: "substitute", error: cell.error };
		case "delete":
			return { text: cell.segment, tone: "delete", error: cell.error };
		case "insert":
			return { text: GAP, tone: "gap" };
	}
}

function detectedSide(cell: DiffCell): {
	text: string;
	tone: "equal" | DiffError["errorType"] | "gap";
	error?: DiffError;
} {
	switch (cell.kind) {
		case "equal":
			return { text: cell.segment, tone: "equal" };
		case "substitute":
			return { text: cell.actual, tone: "substitute", error: cell.error };
		case "delete":
			return { text: GAP, tone: "gap" };
		case "insert":
			return { text: cell.segment, tone: "insert", error: cell.error };
	}
}

export function DiffViewer({
	target,
	recognized,
	errors,
	type,
	audioSrc,
	onSegmentClick,
}: DiffViewerProps) {
	const [mode, setMode] = useDiffMode(type);

	const targetSegments = target.split(/\s+/).filter(Boolean);
	const recognizedSegments = recognized.split(/\s+/).filter(Boolean);
	const title = type === "word" ? "Word Comparison" : "Phoneme Comparison";

	const { cells } = buildDiff(targetSegments, recognizedSegments, errors);
	const hasErrors = errors.length > 0;
	const viewProps: ViewProps = { cells, type, audioSrc, onSegmentClick };

	return (
		<div className="space-y-3">
			<div className="flex flex-wrap items-center gap-2">
				<h3 className="font-medium">{title}</h3>
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								className="text-muted-foreground transition-colors hover:text-foreground"
							>
								<RiInformationLine size={14} />
							</button>
						</TooltipTrigger>
						<TooltipContent
							side="right"
							className="max-w-xs text-xs leading-relaxed"
						>
							{INFO_CONTENT[type]}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
				<div className="ml-auto flex items-center gap-3">
					{hasErrors && (
						<span className="text-muted-foreground text-xs">
							{errors.length}{" "}
							{errors.length === 1 ? "difference" : "differences"}
						</span>
					)}
					<Tabs value={mode} onValueChange={(v) => setMode(v as DiffMode)}>
						<TabsList aria-label="Diff view">
							{MODES.map((m) => (
								<TabsTrigger key={m.id} value={m.id}>
									{m.label}
								</TabsTrigger>
							))}
						</TabsList>
					</Tabs>
				</div>
			</div>

			{cells.length === 0 ? (
				<div className={cn(PANEL, "flex min-h-12 items-center justify-center")}>
					<span className="text-muted-foreground text-sm italic">
						Nothing to compare
					</span>
				</div>
			) : mode === "blocks" ? (
				<BlocksView {...viewProps} />
			) : mode === "strike" ? (
				<StrikeView {...viewProps} />
			) : (
				<StackedView {...viewProps} />
			)}
		</div>
	);
}
