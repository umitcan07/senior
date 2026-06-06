import { RiArrowDownLine, RiSearch2Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import {
	categoryLabels,
	PracticeTextTable,
} from "@/components/practice-text-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineLink } from "@/components/ui/inline-link";
import { Input } from "@/components/ui/input";
import { SectionTitle } from "@/components/ui/section-title";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { TextType } from "@/db/types";
import { serverGetPracticeTextsWithAttemptStats } from "@/lib/text";
import {
	getWordCountCategory,
	useTextFilterStore,
	type WordCountCategory,
} from "@/stores/text-store";

const ITEMS_PER_PAGE = 10;

// Category types for iteration
const categoryTypes: Array<TextType | "all"> = [
	"all",
	"daily",
	"professional",
	"academic",
	"phonetic_challenge",
	"common_phrase",
];

export const Route = createFileRoute("/practice/")({
	component: PracticePage,
});

function PracticePageSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="lg">
				<div className="flex flex-col gap-10">
					{/* Filters Skeleton — single row */}
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<Skeleton className="h-10 flex-1" />
						<Skeleton className="h-10 w-full sm:w-[150px]" />
						<Skeleton className="h-10 w-full sm:w-[150px]" />
					</div>

					{/* Content Skeleton */}
					<div className="flex flex-col gap-10">
						<div className="flex flex-col gap-4">
							<Skeleton className="h-6 w-48" />
							<div className="flex flex-col gap-2">
								{Array.from({ length: 5 }).map((_, i) => (
									<Skeleton key={i} className="h-16 w-full" />
								))}
							</div>
						</div>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// MAIN PAGE

function PracticePage() {
	const getTextsFn = useServerFn(serverGetPracticeTextsWithAttemptStats);
	const {
		data: textsData,
		isLoading,
		isError,
		error,
	} = useQuery({
		queryKey: ["practice-texts"],
		queryFn: async () => {
			const result = await getTextsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data.map((text) => ({
				...text,
				referenceCount: text.referenceCount ?? 0,
				wordCount: text.wordCount ?? text.content.split(/\s+/).length,
			}));
		},
	});

	const allTexts = textsData ?? [];
	const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
	const [searchQuery, setSearchQuery] = useState("");
	const { typeFilter, wordCountFilter, setTypeFilter, setWordCountFilter } =
		useTextFilterStore();

	// Memoize filtered texts to prevent unnecessary recalculations
	const filteredTexts = useMemo(() => {
		return allTexts.filter((text) => {
			if (
				searchQuery &&
				!text.content.toLowerCase().includes(searchQuery.toLowerCase())
			) {
				return false;
			}
			if (typeFilter !== "all" && text.type !== typeFilter) {
				return false;
			}
			if (
				wordCountFilter !== "all" &&
				getWordCountCategory(text.wordCount) !== wordCountFilter
			) {
				return false;
			}
			return true;
		});
	}, [allTexts, typeFilter, wordCountFilter, searchQuery]);

	// Split into groups
	const { attemptedTexts, newTexts } = useMemo(() => {
		const attempted = filteredTexts.filter((t) => t.bestScore != null);
		const newItems = filteredTexts.filter((t) => t.bestScore == null);
		return { attemptedTexts: attempted, newTexts: newItems };
	}, [filteredTexts]);

	// Combined list for "searchedTexts" check, but we render groups separately
	const searchedTexts = filteredTexts;
	const hasMore = visibleCount < filteredTexts.length;

	// Reset pagination when filters change
	const handleTypeFilterChange = useCallback(
		(type: TextType | "all") => {
			setTypeFilter(type);
			setVisibleCount(ITEMS_PER_PAGE);
		},
		[setTypeFilter],
	);

	const handleLoadMore = useCallback(() => {
		setVisibleCount((prev) => prev + ITEMS_PER_PAGE);
	}, []);

	// Show skeleton while loading
	if (isLoading) {
		return <PracticePageSkeleton />;
	}

	// Show error state
	if (isError) {
		return (
			<MainLayout>
				<PageContainer>
					<EmptyState
						title="Failed to load practice texts"
						description={
							error?.message ??
							"An error occurred while loading practice texts."
						}
						primaryAction={{
							label: "Try Again",
							onClick: () => window.location.reload(),
						}}
					/>
				</PageContainer>
			</MainLayout>
		);
	}

	return (
		<MainLayout>
			<PageContainer maxWidth="lg">
				<div className="flex flex-col gap-10">
					{allTexts.length > 0 && (
						<>
							{/* Filters Section */}
							<section className="flex flex-col gap-10">
								{/* Filters — single row: search + category + length */}
								<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
									<div className="relative flex-1">
										<RiSearch2Line className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
										<Input
											type="search"
											placeholder="Search texts..."
											className="h-10 border-border/40 bg-muted/40 pl-9 transition-colors focus-visible:bg-background"
											value={searchQuery}
											onChange={(e) => {
												setSearchQuery(e.target.value);
												setVisibleCount(ITEMS_PER_PAGE);
											}}
										/>
									</div>
									<Select
										value={typeFilter}
										onValueChange={(v) =>
											handleTypeFilterChange(v as TextType | "all")
										}
									>
										<SelectTrigger className="h-10 w-full border-border/40 bg-muted/40 *:data-[slot=select-value]:ml-auto sm:w-[150px]">
											<SelectValue placeholder="Category" />
										</SelectTrigger>
										<SelectContent>
											{categoryTypes.map((type) => (
												<SelectItem key={type} value={type}>
													{categoryLabels[type]}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
									<Select
										value={wordCountFilter}
										onValueChange={(v) => {
											setWordCountFilter(v as WordCountCategory);
											setVisibleCount(ITEMS_PER_PAGE);
										}}
									>
										<SelectTrigger className="h-10 w-full border-border/40 bg-muted/40 *:data-[slot=select-value]:ml-auto sm:w-[150px]">
											<SelectValue placeholder="Length" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="all">Any Length</SelectItem>
											<SelectItem value="short">Short (&lt;15)</SelectItem>
											<SelectItem value="medium">Medium (15-30)</SelectItem>
											<SelectItem value="long">Long (30+)</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</section>
						</>
					)}

					{/* Results Section */}
					<section className="flex flex-col gap-10">
						{searchedTexts.length > 0 ? (
							<>
								{/* Previously Attempted Texts */}
								{attemptedTexts.length > 0 && (
									<div className="fade-in slide-in-from-bottom-4 flex flex-col gap-4 duration-500">
										<SectionTitle
											title="Ready to try again?"
											variant="playful"
											description="Beat your high score on these texts."
										/>
										<PracticeTextTable
											texts={attemptedTexts.slice(0, visibleCount)}
										/>
									</div>
								)}

								{/* New Texts */}
								{newTexts.length > 0 && (
									<div className="fade-in slide-in-from-bottom-4 flex flex-col gap-4 delay-100 duration-500">
										<SectionTitle
											title={
												attemptedTexts.length > 0
													? "New Challenges"
													: "Practice Texts"
											}
											variant="default"
										/>
										<PracticeTextTable
											texts={newTexts.slice(
												0,
												Math.max(0, visibleCount - attemptedTexts.length),
											)}
										/>
									</div>
								)}

								{hasMore && (
									<div className="flex justify-center py-2">
										<Button variant="outline" onClick={handleLoadMore}>
											<RiArrowDownLine size={16} />
											Load More
										</Button>
									</div>
								)}
							</>
						) : allTexts.length > 0 ? (
							<EmptyState
								title="No texts match your filters"
								description="Try adjusting your type filters, length filter, or search query to see more texts."
								icon={<RiSearch2Line className="size-full" />}
								variant="minimal"
								primaryAction={{
									label: "Clear Filters",
									onClick: () => {
										setSearchQuery("");
										setTypeFilter("all");
										setWordCountFilter("all");
										setVisibleCount(ITEMS_PER_PAGE);
									},
								}}
							/>
						) : (
							<EmptyState
								title="No practice texts available"
								description={
									<>
										The application is still in early development.
										<br />
										Feel free to contact us at{" "}
										<InlineLink href="mailto:umit.evleksiz@std.bogazici.edu.tr">
											umit.evleksiz@std.bogazici.edu.tr
										</InlineLink>
									</>
								}
							/>
						)}
					</section>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
