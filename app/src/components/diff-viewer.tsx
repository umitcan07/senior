import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
}

export function DiffViewer({
	target,
	recognized,
	errors,
	type,
}: DiffViewerProps) {
	// Split into segments
	const targetSegments =
		type === "word"
			? target.split(" ").filter(Boolean)
			: target.split(/\s+/).filter(Boolean);

	const recognizedSegments =
		type === "word"
			? recognized.split(" ").filter(Boolean)
			: recognized.split(/\s+/).filter(Boolean);

	const title = type === "word" ? "Sentence Comparison" : "Phoneme Comparison";
	const targetLabel = type === "word" ? "Target" : "Target Phonemes";
	const recognizedLabel =
		type === "word" ? "Your Speech" : "Recognized Phonemes";

	// Create error map for quick lookup
	const errorMap = new Map<number, PhonemeError | WordError>();
	errors.forEach((error) => {
		errorMap.set(error.position, error);
	});

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">{title}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-6">
				{/* Target Section */}
				<div className="flex flex-col gap-2">
					<div className="text-muted-foreground text-xs uppercase tracking-wide">
						{targetLabel}
					</div>
					<div
						className={cn(
							"flex flex-wrap gap-1 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed",
							type === "phoneme" && "font-mono",
						)}
					>
						{targetSegments.map((segment, index) => {
							const error = errorMap.get(index);
							const isSubstitute = error?.errorType === "substitute";
							const isDelete = error?.errorType === "delete";
							const hasError = isSubstitute || isDelete;

							return (
								<span
									key={`target-${index}-${segment}`}
									className={cn(
										"rounded px-1.5 py-0.5",
										hasError &&
											cn(
												errorBgVariants({ errorType: error.errorType }),
												errorBorderVariants({ errorType: error.errorType }),
												errorTextVariants({ errorType: error.errorType }),
												"border",
											),
									)}
								>
									{segment}
								</span>
							);
						})}
					</div>
				</div>

				{/* Recognized Section */}
				<div className="flex flex-col gap-2">
					<div className="text-muted-foreground text-xs uppercase tracking-wide">
						{recognizedLabel}
					</div>
					<div
						className={cn(
							"flex flex-wrap gap-1 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed",
							type === "phoneme" && "font-mono",
						)}
					>
						{recognizedSegments.map((segment, index) => {
							const error = errorMap.get(index);
							const isSubstitute = error?.errorType === "substitute";
							const isInsert = error?.errorType === "insert";
							const hasError = isSubstitute || isInsert;

							return (
								<span
									key={`recognized-${index}-${segment}`}
									className={cn(
										"rounded px-1.5 py-0.5",
										hasError &&
											cn(
												errorBgVariants({ errorType: error.errorType }),
												errorBorderVariants({ errorType: error.errorType }),
												errorTextVariants({ errorType: error.errorType }),
												"border",
											),
									)}
								>
									{segment}
								</span>
							);
						})}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
