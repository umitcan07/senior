import { Info, Play } from "lucide-react";
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
	isPhoneme: boolean;
	audioSrc?: string;
	onSegmentClick?: (startMs: number, endMs: number) => void;
}

function Segment({
	segment,
	error,
	isPhoneme,
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
		if (canPlay && error && "timestampStartMs" in error) {
			onSegmentClick(error.timestampStartMs!, error.timestampEndMs!);
		}
	};

	const content = (
		<span
			className={cn(
				"relative inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 transition-all",
				hasError &&
					cn(
						errorBgVariants({ errorType: error.errorType }),
						errorBorderVariants({ errorType: error.errorType }),
						errorTextVariants({ errorType: error.errorType }),
						"border font-medium",
					),
				canPlay &&
					"cursor-pointer hover:scale-105 hover:ring-2 hover:ring-primary/20",
				!hasError && "text-foreground/70",
			)}
			onClick={handleClick}
		>
			{isPhoneme ? `/${segment}/` : segment}
			{canPlay && <Play size={10} className="opacity-50" />}
		</span>
	);

	if (hasTimestamps && error && "timestampStartMs" in error) {
		return (
			<TooltipProvider>
				<Tooltip>
					<TooltipTrigger asChild>{content}</TooltipTrigger>
					<TooltipContent side="top" className="text-xs">
						<span className="font-medium capitalize">{error.errorType}</span>
						<span className="mx-1.5 text-muted-foreground">·</span>
						<span className="font-mono text-muted-foreground">
							{formatTimestamp(error.timestampStartMs!)}
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

	const errorMap = new Map<number, PhonemeError | WordError>();
	errors.forEach((error) => {
		errorMap.set(error.position, error);
	});

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
								<Info size={14} />
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

			{/* Legend - minimal inline */}
			{hasErrors && (
				<div className="flex gap-4 text-muted-foreground text-xs">
					<span className="flex items-center gap-1">
						<span className="size-2 rounded-full bg-destructive/60" />
						Substitution
					</span>
					<span className="flex items-center gap-1">
						<span className="size-2 rounded-full bg-amber-500/60" />
						Insertion
					</span>
					<span className="flex items-center gap-1">
						<span className="size-2 rounded-full bg-blue-500/60" />
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
						type === "phoneme" && "font-mono text-sm",
						type === "word" && "text-base",
					)}
				>
					{targetSegments.map((segment, index) => {
						const error = errorMap.get(index);
						const isSubstitute = error?.errorType === "substitute";
						const isDelete = error?.errorType === "delete";
						const relevantError = isSubstitute || isDelete ? error : undefined;

						return (
							<Segment
								key={`target-${index}-${segment}`}
								segment={segment}
								error={relevantError}
								isPhoneme={type === "phoneme"}
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
						type === "phoneme" && "font-mono text-sm",
						type === "word" && "text-base",
					)}
				>
					{recognizedSegments.map((segment, index) => {
						const error = errorMap.get(index);
						const isSubstitute = error?.errorType === "substitute";
						const isInsert = error?.errorType === "insert";
						const relevantError = isSubstitute || isInsert ? error : undefined;

						return (
							<Segment
								key={`recognized-${index}-${segment}`}
								segment={segment}
								error={relevantError}
								isPhoneme={type === "phoneme"}
								audioSrc={audioSrc}
								onSegmentClick={onSegmentClick}
							/>
						);
					})}
				</div>
			</div>
		</div>
	);
}
