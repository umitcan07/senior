import { Link } from "@tanstack/react-router";
import { cva } from "class-variance-authority";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import type { TextDifficulty, TextType } from "@/db/types";
import { getScoreLevel } from "@/lib/score";
import { cn, formatRelativeTime } from "@/lib/utils";

// Types

export interface PracticeTextData {
	id: string;
	content: string;
	difficulty: TextDifficulty;
	type: TextType;
	note?: string | null;
	referenceCount: number;
	usCount?: number;
	ukCount?: number;
	wordCount: number;
	// User attempt stats
	attemptCount?: number;
	bestScore?: number | null;
	lastAttemptDate?: Date | null;
}

// Category config with gradient colors - dark mode compatible
export const categoryGradientVariants = cva("bg-linear-to-br", {
	variants: {
		type: {
			all: "from-violet-500 to-purple-600 dark:from-violet-600 dark:to-purple-700",
			daily: "from-sky-400 to-blue-500 dark:from-sky-500 dark:to-blue-600",
			professional:
				"from-emerald-400 to-teal-500 dark:from-emerald-500 dark:to-teal-600",
			academic:
				"from-amber-400 to-orange-500 dark:from-amber-500 dark:to-orange-600",
			phonetic_challenge:
				"from-rose-400 to-pink-500 dark:from-rose-500 dark:to-pink-600",
			common_phrase:
				"from-cyan-400 to-sky-500 dark:from-cyan-500 dark:to-sky-600",
		},
	},
	defaultVariants: {
		type: "all",
	},
});

export const categoryLabels: Record<TextType | "all", string> = {
	all: "All",
	daily: "Daily",
	professional: "Professional",
	academic: "Academic",
	phonetic_challenge: "Phonetic",
	common_phrase: "Phrases",
};

export function getTypeLabel(type: TextType): string {
	return categoryLabels[type] ?? type;
}

function CategoryIcon({ type }: { type: TextType }) {
	return (
		<div
			className={cn(
				"flex size-8 shrink-0 items-center justify-center rounded-full",
				categoryGradientVariants({ type }),
			)}
		>
			<svg
				className="size-4 text-white/80"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="8" />
			</svg>
		</div>
	);
}

// Components

interface PracticeTextTableProps {
	texts: PracticeTextData[];
}

export function PracticeTextTable({ texts }: PracticeTextTableProps) {
	return (
		<div className="overflow-hidden rounded-lg border">
			<div className="overflow-x-auto">
				<Table>
					<TableHeader>
						<TableRow className="hover:bg-transparent">
							<TableHead>Content</TableHead>
							<TableHead className="hidden w-24 sm:table-cell">
								Difficulty
							</TableHead>
							<TableHead className="hidden w-20 text-right md:table-cell">
								Voices
							</TableHead>
							<TableHead className="hidden w-32 text-right lg:table-cell">
								Score
							</TableHead>
							<TableHead className="w-20 sm:w-24" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{texts.map((text) => (
							<TableRow
								key={text.id}
								className={cn(
									"group",
									// Subtle left border for attempted texts
									text.bestScore != null && "border-l-2 border-l-primary/30",
								)}
							>
								<TableCell>
									<div className="flex items-start gap-3">
										<CategoryIcon type={text.type} />
										<div className="flex min-w-0 flex-col gap-1">
											<div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
												<span className="text-muted-foreground text-xs uppercase tracking-widest">
													{getTypeLabel(text.type)}
												</span>
												{/* Show difficulty inline on mobile */}
												<span className="text-muted-foreground text-xs capitalize sm:hidden">
													· {text.difficulty}
												</span>
											</div>
											<p className="line-clamp-2 break-words font-medium text-foreground/90 text-sm sm:text-base">
												{text.content}
											</p>
											{/* Show score inline on mobile */}
											<div className="flex items-center gap-3 text-muted-foreground text-xs md:hidden">
												<div className="flex items-center gap-2 tabular-nums">
													<div className="flex items-center gap-1">
														<span>🇺🇸</span> {text.usCount ?? 0}
													</div>
													<div className="flex items-center gap-1">
														<span>🇬🇧</span> {text.ukCount ?? 0}
													</div>
												</div>
												{text.bestScore != null && (
													<span
														className={cn(
															"font-medium tabular-nums",
															getScoreLevel(text.bestScore) === "high" &&
																"text-emerald-600",
															getScoreLevel(text.bestScore) === "medium" &&
																"text-amber-600",
															getScoreLevel(text.bestScore) === "low" &&
																"text-red-600",
														)}
													>
														{Math.round(text.bestScore)}%
													</span>
												)}
											</div>
										</div>
									</div>
								</TableCell>
								<TableCell className="hidden sm:table-cell">
									<span className="text-muted-foreground text-sm capitalize">
										{text.difficulty}
									</span>
								</TableCell>
								<TableCell className="hidden text-right md:table-cell">
									<div className="flex items-center justify-end gap-3 text-muted-foreground">
										<div
											className="flex items-center gap-1.5"
											title="US Voices"
										>
											<span className="text-base">🇺🇸</span>
											<span className="font-medium text-sm tabular-nums">
												{text.usCount ?? 0}
											</span>
										</div>
										<div
											className="flex items-center gap-1.5"
											title="UK Voices"
										>
											<span className="text-base">🇬🇧</span>
											<span className="font-medium text-sm tabular-nums">
												{text.ukCount ?? 0}
											</span>
										</div>
									</div>
								</TableCell>
								{/* Score column - shows best score and recent info */}
								<TableCell className="hidden text-right lg:table-cell">
									{text.bestScore != null ? (
										<div className="flex flex-col items-end gap-1">
											<Badge
												variant="secondary"
												className={cn(
													"font-mono tabular-nums",
													getScoreLevel(text.bestScore) === "high" &&
														"bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/25 dark:text-emerald-400",
													getScoreLevel(text.bestScore) === "medium" &&
														"bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400",
													getScoreLevel(text.bestScore) === "low" &&
														"bg-red-500/15 text-red-700 hover:bg-red-500/25 dark:text-red-400",
												)}
											>
												Best: {Math.round(text.bestScore)}%
											</Badge>
											{text.lastAttemptDate && (
												<span className="text-[10px] text-muted-foreground uppercase tracking-wider">
													{formatRelativeTime(text.lastAttemptDate)}
												</span>
											)}
										</div>
									) : (
										<span className="text-muted-foreground/50 text-sm">—</span>
									)}
								</TableCell>
								<TableCell className="text-right">
									<Button
										asChild
										size="sm"
										className="opacity-100 transition-opacity duration-300 sm:opacity-0 sm:group-hover:opacity-100"
									>
										<Link to="/practice/$textId" params={{ textId: text.id }}>
											<span className="hidden sm:inline">Practice</span>
											<ArrowRight size={14} />
										</Link>
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
