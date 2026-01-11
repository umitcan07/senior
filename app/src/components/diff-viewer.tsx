import { RiInformationLine, RiPlayLine } from "@remixicon/react";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type { PhonemeError, WordError } from "@/db/types";
import {
	errorBgVariants,
	errorBorderVariants,
	errorTextVariants,
} from "@/lib/diff-viewer";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
	target: string;
	recognized: string;
	errors: PhonemeError[] | WordError[];
	type: "phoneme" | "word";
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
	showLegend?: boolean;
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

// Individual segment component
interface SegmentProps {
	segment: string;
	error?: PhonemeError | WordError;
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
}

function Segment({
	segment,
	error,
	audioSrc,
	onSegmentClick,
}: SegmentProps) {
	const hasError = !!error;
	const hasTimestamps =
		error &&
		"timestampStartMs" in error &&
		error.timestampStartMs != null &&
		error.timestampEndMs != null;

	const canPlay = audioSrc && hasTimestamps && onSegmentClick;

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

	const content = (
		<button
			type="button"
			className={cn(
				"relative inline-flex items-center gap-1 text-lg rounded-sm px-2 py-1 font-ipa outline-hidden transition-all font-ipa! text-xl focus-visible:ring-2 focus-visible:ring-primary/8",
				hasError &&
				cn(
					errorBgVariants({ errorType: error.errorType }),
					errorBorderVariants({ errorType: error.errorType }),
					errorTextVariants({ errorType: error.errorType }),
					"font-bold",
				),
				!hasError &&
				"bg-green-950/10 dark:bg-green-900/20 text-green-800 dark:text-green-300 font-medium border border-green-800/20 dark:border-green-700/30",
				canPlay &&
				"cursor-pointer hover:scale-105 hover:ring-2 hover:ring-primary/20",
				!canPlay && "cursor-default",
			)}
			onClick={handleClick}
			disabled={!canPlay}
		>
			{segment}
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
					<TooltipTrigger asChild>{content}</TooltipTrigger>
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

	return content;
}

export function DiffViewer({
	target,
	recognized,
	errors,
	type,
	audioSrc,
	onSegmentClick,
	showLegend = false,
}: DiffViewerProps) {
	const targetSegments =
		type === "word"
			? target.split(" ").filter(Boolean)
			: target.split(/\s+/).filter(Boolean);

	const recognizedSegments =
		type === "word"
			? recognized.split(" ").filter(Boolean)
			: recognized.split(/\s+/).filter(Boolean);

	const title = type === "word" ? "Word Comparison" : "Phoneme Comparison";
	const targetLabel = type === "word" ? "Expected" : "Target";
	const recognizedLabel = type === "word" ? "Recognized" : "Detected";

	// Build error maps for target and recognized segments separately
	// Edit distance positions are:
	// - delete: position in target sequence (marks missing target element)
	// - insert: position in actual/recognized sequence (marks extra recognized element)
	// - substitute: position in actual/recognized sequence (marks changed element)

	const targetErrorMap = new Map<number, PhonemeError | WordError>();
	const recognizedErrorMap = new Map<number, PhonemeError | WordError>();

	// Reconstruct alignment by simulating edit operations
	// We need to map substitute positions (which are in recognized sequence) to target positions

	// Separate errors by type
	const deletes = errors.filter(e => e.errorType === "delete").sort((a, b) => a.position - b.position);
	const inserts = errors.filter(e => e.errorType === "insert").sort((a, b) => a.position - b.position);
	const substitutes = errors.filter(e => e.errorType === "substitute").sort((a, b) => a.position - b.position);

	// Map delete errors directly to target positions
	for (const error of deletes) {
		if (error.position < targetSegments.length) {
			targetErrorMap.set(error.position, error);
		}
	}

	// Map insert errors directly to recognized positions
	for (const error of inserts) {
		if (error.position < recognizedSegments.length) {
			recognizedErrorMap.set(error.position, error);
		}
	}

	// For substitutes, we need to reconstruct which target position each corresponds to
	// We do this by simulating the alignment, accounting for inserts and deletes
	// The key insight: we walk through both sequences, and when positions align,
	// a substitute at recognized position i corresponds to target position j (accounting for deletes)

	// Create sets for quick lookup
	const deletePositions = new Set(deletes.map(e => e.position));
	const insertPositions = new Set(inserts.map(e => e.position));

	// Map substitutes to recognized positions first
	for (const substitute of substitutes) {
		if (substitute.position < recognizedSegments.length) {
			recognizedErrorMap.set(substitute.position, substitute);
		}
	}

	// Now reconstruct alignment to map substitutes to target positions
	// We simulate walking through both sequences simultaneously
	let targetIdx = 0;
	let recognizedIdx = 0;

	// Process until we've covered all substitutes or exhausted sequences
	while (targetIdx < targetSegments.length || recognizedIdx < recognizedSegments.length) {
		// Skip deleted target positions
		while (targetIdx < targetSegments.length && deletePositions.has(targetIdx)) {
			targetIdx++;
		}

		// Skip inserted recognized positions
		while (recognizedIdx < recognizedSegments.length && insertPositions.has(recognizedIdx)) {
			recognizedIdx++;
		}

		// Check if current recognized position has a substitute
		const substitute = substitutes.find(s => s.position === recognizedIdx);
		if (substitute && targetIdx < targetSegments.length) {
			// This substitute corresponds to current target position
			targetErrorMap.set(targetIdx, substitute);
		}

		// Advance both indices (they align at this point)
		if (targetIdx < targetSegments.length) targetIdx++;
		if (recognizedIdx < recognizedSegments.length) recognizedIdx++;

		// Stop if we've processed all segments
		if (targetIdx >= targetSegments.length && recognizedIdx >= recognizedSegments.length) {
			break;
		}
	}

	const hasErrors = errors.length > 0;

	return (
		<div className="space-y-4">
			{/* Header with title and info */}
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
				{hasErrors && (
					<span className="ml-auto text-muted-foreground text-xs">
						{errors.length} {errors.length === 1 ? "difference" : "differences"}
					</span>
				)}
			</div>

			{/* Legend - only show if showLegend is true */}
			{showLegend && hasErrors && (
				<div className="flex flex-wrap gap-3 text-muted-foreground text-[10px]">
					<span className="flex items-center gap-1">
						<span className="size-1.5 rounded-full bg-destructive/60" />
						Substitution
					</span>
					<span className="flex items-center gap-1">
						<span className="size-1.5 rounded-full bg-amber-500/60" />
						Insertion
					</span>
					<span className="flex items-center gap-1">
						<span className="size-1.5 rounded-full bg-amber-500/60" />
						Deletion
					</span>
				</div>
			)}

			{/* Target */}
			<div className="space-y-2">
				<span className="text-muted-foreground text-xs uppercase tracking-wider">
					{targetLabel}
				</span>
				<div
					className={cn(
						"flex flex-wrap gap-1 rounded-lg border border-border/50 border-dashed bg-muted/20 p-4 leading-relaxed",
						type === "phoneme" && "font-ipa text-sm",
						type === "word" && "text-base",
					)}
				>
					{targetSegments.map((segment, index) => {
						const error = targetErrorMap.get(index);
						const isSubstitute = error?.errorType === "substitute";
						const isDelete = error?.errorType === "delete";
						const relevantError = isSubstitute || isDelete ? error : undefined;

						return (
							<Segment
								key={`target-${index}-${segment}`}
								segment={segment}
								error={relevantError}
								audioSrc={audioSrc}
								onSegmentClick={onSegmentClick}
							/>
						);
					})}
				</div>
			</div>

			{/* Recognized */}
			<div className="space-y-2">
				<span className="text-muted-foreground text-xs uppercase tracking-wider">
					{recognizedLabel}
				</span>
				<div
					className={cn(
						"flex flex-wrap gap-1 rounded-lg border border-border/50 border-dashed bg-muted/20 p-4 leading-relaxed",
						type === "phoneme" && "font-ipa text-sm",
						type === "word" && "text-base",
						recognizedSegments.length === 0 && "items-center justify-center min-h-[3rem]",
					)}
				>
					{recognizedSegments.length > 0 ? (
						recognizedSegments.map((segment, index) => {
							const error = recognizedErrorMap.get(index);
							const isSubstitute = error?.errorType === "substitute";
							const isInsert = error?.errorType === "insert";
							const relevantError = isSubstitute || isInsert ? error : undefined;

							return (
								<Segment
									key={`recognized-${index}-${segment}`}
									segment={segment}
									error={relevantError}
									audioSrc={audioSrc}
									onSegmentClick={onSegmentClick}
								/>
							);
						})
					) : (
						<span className="text-muted-foreground text-sm italic">
							No {type === "word" ? "words" : "phonemes"} detected
						</span>
					)}
				</div>
			</div>
		</div>
	);
}
