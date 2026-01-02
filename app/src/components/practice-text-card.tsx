import { Link } from "@tanstack/react-router";
import { ArrowRight, User2 } from "lucide-react";
import { cva } from "class-variance-authority";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { TextDifficulty, TextType } from "@/db/types";

// Types

export interface PracticeTextData {
	id: string;
	content: string;
	difficulty: TextDifficulty;
	type: TextType;
	note?: string | null;
	referenceCount: number;
	wordCount: number;
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
							<TableHead className="hidden w-16 text-right md:table-cell">
								Words
							</TableHead>
							<TableHead className="hidden w-16 text-right md:table-cell">
								Voices
							</TableHead>
							<TableHead className="w-20 sm:w-24" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{texts.map((text) => (
							<TableRow key={text.id} className="group">
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
											<p className="line-clamp-2 text-sm sm:text-base">
												{text.content}
											</p>
											{/* Show word count inline on mobile */}
											<div className="flex items-center gap-3 text-muted-foreground text-xs md:hidden">
												<span className="tabular-nums">
													{text.wordCount} words
												</span>
												<span className="flex items-center gap-1 tabular-nums">
													<User2 size={12} />
													{text.referenceCount}
												</span>
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
									<span className="text-muted-foreground text-sm tabular-nums">
										{text.wordCount}
									</span>
								</TableCell>
								<TableCell className="hidden text-right md:table-cell">
									<div className="flex items-center justify-end gap-1 text-muted-foreground">
										<User2 size={14} />
										<span className="text-sm tabular-nums">
											{text.referenceCount}
										</span>
									</div>
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

// Skeleton

const skeletonRowKeys = [
	"skeleton-row-1",
	"skeleton-row-2",
	"skeleton-row-3",
	"skeleton-row-4",
	"skeleton-row-5",
	"skeleton-row-6",
	"skeleton-row-7",
	"skeleton-row-8",
];

export function PracticeTextTableSkeleton() {
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
							<TableHead className="hidden w-16 text-right md:table-cell">
								Words
							</TableHead>
							<TableHead className="hidden w-16 text-right md:table-cell">
								Voices
							</TableHead>
							<TableHead className="w-20 sm:w-24" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{skeletonRowKeys.map((key) => (
							<TableRow key={key}>
								<TableCell>
									<div className="flex items-start gap-3">
										<Skeleton className="size-8 shrink-0 rounded-full" />
										<div className="flex flex-1 flex-col gap-1">
											<Skeleton className="h-3 w-20" />
											<Skeleton className="h-5 w-full" />
											<Skeleton className="h-3 w-24 md:hidden" />
										</div>
									</div>
								</TableCell>
								<TableCell className="hidden sm:table-cell">
									<Skeleton className="h-4 w-16" />
								</TableCell>
								<TableCell className="hidden text-right md:table-cell">
									<Skeleton className="ml-auto h-4 w-8" />
								</TableCell>
								<TableCell className="hidden text-right md:table-cell">
									<Skeleton className="ml-auto h-4 w-8" />
								</TableCell>
								<TableCell className="text-right">
									<Skeleton className="ml-auto size-8 rounded-md sm:h-8 sm:w-20" />
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
