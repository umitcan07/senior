import { RiInformationLine } from "@remixicon/react";
import { useEffect, useState } from "react";
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

type DiffView = "unified" | "split";

interface DiffViewerProps {
	target: string;
	recognized: string;
	errors: DiffError[];
	type: "phoneme" | "word";
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
}

function formatTimestamp(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Info content for each type
const INFO_CONTENT = {
	word: "Based on ASR (Automatic Speech Recognition). May not capture all nuances and might auto-correct some errors. Still valuable as it simulates how a native speaker might interpret your speech.",
	phoneme:
		"Detailed phonetic analysis comparing expected pronunciation with what was detected. Phoneme-level comparison provides granular feedback on individual sounds.",
};

/**
 * Remember the chosen view per comparison type, independently, across sessions.
 * Defaults to "unified" (the merged git-style line).
 */
function useDiffView(type: "phoneme" | "word") {
	const key = `${DIFF_VIEW_STORAGE_KEY_PREFIX}-${type}`;
	const [view, setView] = useState<DiffView>(() => {
		if (typeof window === "undefined") return "unified";
		const stored = localStorage.getItem(key);
		return stored === "split" || stored === "unified" ? stored : "unified";
	});

	useEffect(() => {
		if (typeof window === "undefined") return;
		localStorage.setItem(key, view);
	}, [key, view]);

	return [view, setView] as const;
}

interface ChipProps {
	error?: DiffError;
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
	className?: string;
	children: React.ReactNode;
}

/**
 * A clickable token. When the error carries timestamps and audio is available,
 * it plays that segment and shows a tooltip; otherwise it's inert.
 */
function Chip({
	error,
	audioSrc,
	onSegmentClick,
	className,
	children,
}: ChipProps) {
	const hasTimestamps =
		!!error &&
		"timestampStartMs" in error &&
		error.timestampStartMs != null &&
		error.timestampEndMs != null;

	const canPlay = !!(audioSrc && hasTimestamps && onSegmentClick);

	const handleClick = () => {
		if (
			canPlay &&
			error &&
			"timestampStartMs" in error &&
			error.timestampStartMs != null &&
			error.timestampEndMs != null
		) {
			onSegmentClick(error.timestampStartMs, error.timestampEndMs);
		}
	};

	const button = (
		<button
			type="button"
			disabled={!canPlay}
			onClick={handleClick}
			className={cn(
				"inline-flex items-center gap-1 rounded-sm outline-hidden transition-colors focus-visible:ring-2 focus-visible:ring-primary/40",
				canPlay ? "cursor-pointer hover:brightness-110" : "cursor-default",
				className,
			)}
		>
			{children}
		</button>
	);

	if (
		hasTimestamps &&
		error &&
		"timestampStartMs" in error &&
		error.timestampStartMs != null
	) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>{button}</TooltipTrigger>
					<TooltipContent side="top" className="text-xs">
						<span className="font-medium capitalize">{error.errorType}</span>
						<span className="mx-1.5 text-muted-foreground">·</span>
						<span className="font-mono text-muted-foreground">
							{formatTimestamp(error.timestampStartMs)}
						</span>
						{canPlay && <span className="ml-1.5 text-primary">▶ Play</span>}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return button;
}

/** Shared padding/size for every token, scaled to phoneme vs. word. */
function tokenSizing(type: "phoneme" | "word") {
	return type === "phoneme"
		? "px-1.5 py-0.5 font-ipa text-base"
		: "px-1.5 py-0.5 text-sm";
}

function errorClasses(error: DiffError) {
	return cn(
		errorBgVariants({ errorType: error.errorType }),
		errorBorderVariants({ errorType: error.errorType }),
		errorTextVariants({ errorType: error.errorType }),
		"border font-medium",
	);
}

const PANEL_CLASS =
	"flex flex-wrap items-center gap-1 rounded-md border border-border/60 bg-card/40 p-3 leading-relaxed";

interface UnifiedViewProps {
	cells: DiffCell[];
	type: "phoneme" | "word";
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
}

/** Merged, git-unified line: grey unchanged, green added, amber removed, red changed. */
function UnifiedView({
	cells,
	type,
	audioSrc,
	onSegmentClick,
}: UnifiedViewProps) {
	const sizing = tokenSizing(type);

	if (cells.length === 0) {
		return (
			<div className={cn(PANEL_CLASS, "min-h-12 justify-center")}>
				<span className="text-muted-foreground text-sm italic">
					Nothing to compare
				</span>
			</div>
		);
	}

	return (
		<div className={cn(PANEL_CLASS, type === "phoneme" && "font-ipa")}>
			{cells.map((cell, index) => {
				const cellKey = `${cell.kind}-${index}`;

				if (cell.kind === "equal") {
					return (
						<span
							key={cellKey}
							className={cn(sizing, "text-muted-foreground/80")}
						>
							{cell.segment}
						</span>
					);
				}

				if (cell.kind === "substitute") {
					return (
						<Chip
							key={cellKey}
							error={cell.error}
							audioSrc={audioSrc}
							onSegmentClick={onSegmentClick}
							className={cn(sizing, errorClasses(cell.error))}
						>
							<span className="line-through opacity-60">{cell.expected}</span>
							<span aria-hidden>→</span>
							<span className="font-semibold">{cell.actual}</span>
						</Chip>
					);
				}

				// insert (added) or delete (removed)
				return (
					<Chip
						key={cellKey}
						error={cell.error}
						audioSrc={audioSrc}
						onSegmentClick={onSegmentClick}
						className={cn(sizing, errorClasses(cell.error))}
					>
						<span className={cn(cell.kind === "delete" && "line-through")}>
							{cell.segment}
						</span>
					</Chip>
				);
			})}
		</div>
	);
}

interface SplitLineProps {
	label: string;
	segments: string[];
	errorMap: Map<number, DiffError>;
	/** Which error types to highlight on this line. */
	highlight: DiffError["errorType"][];
	emptyLabel: string;
	type: "phoneme" | "word";
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
}

function SplitLine({
	label,
	segments,
	errorMap,
	highlight,
	emptyLabel,
	type,
	audioSrc,
	onSegmentClick,
}: SplitLineProps) {
	const sizing = tokenSizing(type);

	return (
		<div className="space-y-1.5">
			<span className="text-muted-foreground text-xs uppercase tracking-wider">
				{label}
			</span>
			<div
				className={cn(
					PANEL_CLASS,
					type === "phoneme" && "font-ipa",
					segments.length === 0 && "min-h-12 justify-center",
				)}
			>
				{segments.length === 0 ? (
					<span className="text-muted-foreground text-sm italic">
						{emptyLabel}
					</span>
				) : (
					segments.map((segment, index) => {
						const error = errorMap.get(index);
						const isHighlighted = error && highlight.includes(error.errorType);

						if (!error || !isHighlighted) {
							return (
								<span
									key={`${label}-${index}-${segment}`}
									className={cn(sizing, "text-foreground/80")}
								>
									{segment}
								</span>
							);
						}

						return (
							<Chip
								key={`${label}-${index}-${segment}`}
								error={error}
								audioSrc={audioSrc}
								onSegmentClick={onSegmentClick}
								className={cn(sizing, errorClasses(error))}
							>
								{segment}
							</Chip>
						);
					})
				)}
			</div>
		</div>
	);
}

interface ViewToggleProps {
	view: DiffView;
	onChange: (view: DiffView) => void;
}

function ViewToggle({ view, onChange }: ViewToggleProps) {
	return (
		<div className="inline-flex rounded-md border border-border/60 p-0.5">
			{(["unified", "split"] as const).map((option) => (
				<button
					key={option}
					type="button"
					onClick={() => onChange(option)}
					aria-pressed={view === option}
					className={cn(
						"rounded-[5px] px-2 py-0.5 text-xs capitalize transition-colors",
						view === option
							? "bg-muted font-medium text-foreground"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					{option}
				</button>
			))}
		</div>
	);
}

export function DiffViewer({
	target,
	recognized,
	errors,
	type,
	audioSrc,
	onSegmentClick,
}: DiffViewerProps) {
	const [view, setView] = useDiffView(type);

	const targetSegments = target.split(/\s+/).filter(Boolean);
	const recognizedSegments = recognized.split(/\s+/).filter(Boolean);

	const title = type === "word" ? "Word Comparison" : "Phoneme Comparison";
	const targetLabel = type === "word" ? "Expected" : "Target";
	const recognizedLabel = type === "word" ? "Recognized" : "Detected";

	const { targetErrorMap, recognizedErrorMap, cells } = buildDiff(
		targetSegments,
		recognizedSegments,
		errors,
	);

	const hasErrors = errors.length > 0;

	return (
		<div className="space-y-3">
			{/* Header: title, info, count, view toggle */}
			<div className="flex items-center gap-2">
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
					<ViewToggle view={view} onChange={setView} />
				</div>
			</div>

			{view === "unified" ? (
				<UnifiedView
					cells={cells}
					type={type}
					audioSrc={audioSrc}
					onSegmentClick={onSegmentClick}
				/>
			) : (
				<div className="space-y-3">
					<SplitLine
						label={targetLabel}
						segments={targetSegments}
						errorMap={targetErrorMap}
						highlight={["substitute", "delete"]}
						emptyLabel={`No ${type === "word" ? "words" : "phonemes"}`}
						type={type}
						audioSrc={audioSrc}
						onSegmentClick={onSegmentClick}
					/>
					<SplitLine
						label={recognizedLabel}
						segments={recognizedSegments}
						errorMap={recognizedErrorMap}
						highlight={["substitute", "insert"]}
						emptyLabel={`No ${type === "word" ? "words" : "phonemes"} detected`}
						type={type}
						audioSrc={audioSrc}
						onSegmentClick={onSegmentClick}
					/>
				</div>
			)}
		</div>
	);
}
