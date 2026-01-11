import {
	RiArrowDownLine,
	RiBookOpenLine,
	RiBriefcaseLine,
	RiChatQuoteLine,
	RiFilter3Line,
	RiLeafLine,
	RiMicLine,
	RiSearch2Line,
	RiStackLine,
} from "@remixicon/react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useMemo, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import {
	categoryGradientVariants,
	categoryLabels,
	PracticeTextTable,
} from "@/components/practice-text-card";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@/components/ui/drawer";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TextDifficulty, TextType } from "@/db/types";
import { serverGetPracticeTextsWithAttemptStats } from "@/lib/text";
import { cn } from "@/lib/utils";
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

// Difficulty config
const difficultyConfig: Array<{
	value: TextDifficulty | "all";
	label: string;
	color: string;
}> = [
		{
			value: "all",
			label: "All",
			color: "text-muted-foreground",
		},
		{
			value: "beginner",
			label: "Beginner",
			color: "text-green-500",
		},
		{
			value: "intermediate",
			label: "Intermediate",
			color: "text-amber-500",
		},
		{
			value: "advanced",
			label: "Advanced",
			color: "text-red-500",
		},
	];

interface CategoryCardProps {
	type: TextType | "all";
	isSelected: boolean;
	onClick: () => void;
}

function CategoryCard({ type, isSelected, onClick }: CategoryCardProps) {
	// Map types to Remixicon icons
	const Icon =
		{
			all: RiStackLine,
			daily: RiLeafLine,
			professional: RiBriefcaseLine,
			academic: RiBookOpenLine,
			phonetic_challenge: RiMicLine,
			common_phrase: RiChatQuoteLine,
		}[type] || RiStackLine;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={isSelected}
			className={cn(
				"group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-lg px-3 transition-all duration-200",
				categoryGradientVariants({ type }),
				isSelected
					? "ring-2 ring-white/50 ring-offset-2 ring-offset-background"
					: "opacity-70 hover:scale-[1.02] hover:opacity-100 active:scale-[0.98]",
			)}
		>
			<Icon
				className="size-5 shrink-0 text-white/80"
				strokeWidth={1.5}
			/>
			<span className="truncate font-medium text-sm text-white leading-tight tracking-tight">
				{categoryLabels[type]}
			</span>
		</button>
	);
}

interface DifficultySwitcherProps {
	value: TextDifficulty | "all";
	onChange: (value: TextDifficulty | "all") => void;
}

function DifficultySwitcher({ value, onChange }: DifficultySwitcherProps) {
	const validValues = [
		"all",
		"beginner",
		"intermediate",
		"advanced",
	] as const satisfies ReadonlyArray<TextDifficulty | "all">;

	const isValidValue = (v: string): v is TextDifficulty | "all" => {
		return (validValues as ReadonlyArray<string>).includes(v);
	};

	return (
		<Tabs
			value={value}
			onValueChange={(v) => {
				if (isValidValue(v)) {
					onChange(v);
				}
			}}
			className="w-full"
		>
			<TabsList className="w-full">
				{difficultyConfig.map((item) => {
					const isActive = value === item.value;
					return (
						<TabsTrigger key={item.value} value={item.value} className="flex-1 text-xs sm:text-sm">
							<span className={isActive ? item.color : undefined}>
								{item.label}
							</span>
						</TabsTrigger>
					);
				})}
			</TabsList>
		</Tabs>
	);
}

export const Route = createFileRoute("/practice/")({
	component: PracticePage,
});

function PracticePageSkeleton() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-10">
					{/* Filters Skeleton */}
					<div className="flex flex-col gap-10">
						<div className="hidden md:flex md:flex-row md:items-end md:justify-between">
							<div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end md:flex-1">
								<Skeleton className="h-10 max-w-md flex-1" />
								<Skeleton className="h-10 w-[140px]" />
							</div>
						</div>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-20" />
							<div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
								{Array.from({ length: 6 }).map((_, i) => (
									<Skeleton key={i} className="h-12 w-full" />
								))}
							</div>
						</div>
						<div className="flex flex-col gap-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-10 w-full" />
						</div>
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
	const {
		difficultyFilter,
		typeFilter,
		wordCountFilter,
		setDifficultyFilter,
		setTypeFilter,
		setWordCountFilter,
	} = useTextFilterStore();

	// Memoize filtered texts to prevent unnecessary recalculations
	const filteredTexts = useMemo(() => {
		return allTexts.filter((text) => {
			if (
				searchQuery &&
				!text.content.toLowerCase().includes(searchQuery.toLowerCase())
			) {
				return false;
			}
			if (difficultyFilter !== "all" && text.difficulty !== difficultyFilter) {
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
	}, [allTexts, difficultyFilter, typeFilter, wordCountFilter, searchQuery]);

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

	const handleDifficultyFilterChange = useCallback(
		(difficulty: TextDifficulty | "all") => {
			setDifficultyFilter(difficulty);
			setVisibleCount(ITEMS_PER_PAGE);
		},
		[setDifficultyFilter],
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
						description={error?.message ?? "An error occurred while loading practice texts."}
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
			<PageContainer>
				<div className="flex flex-col gap-10">
					{allTexts.length > 0 && (
						<>
							{/* Filters Section */}
							<section className="flex flex-col gap-10">

								{/* Desktop: Inline filters */}
								<div className="hidden md:flex md:flex-row md:items-end md:justify-between">
									<div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end md:flex-1">
										<div className="relative max-w-md flex-1">
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
											value={wordCountFilter}
											onValueChange={(v) =>
												setWordCountFilter(v as WordCountCategory)
											}
										>
											<SelectTrigger className="w-[140px] border-border/40 bg-muted/40">
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
								</div>

								<div className="flex flex-col gap-2">
									<h3 className="font-medium text-muted-foreground text-sm">
										Category
									</h3>
									<div className="grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
										{categoryTypes.map((type) => (
											<CategoryCard
												key={type}
												type={type}
												isSelected={typeFilter === type}
												onClick={() => handleTypeFilterChange(type)}
											/>
										))}
									</div>
								</div>

								<div className="flex flex-col gap-2">
									<h3 className="font-medium text-muted-foreground text-sm">
										Difficulty
									</h3>
									<DifficultySwitcher
										value={difficultyFilter}
										onChange={handleDifficultyFilterChange}
									/>
								</div>

								{/* Mobile: Filter button + drawer */}
								<div className="md:hidden">
									<Drawer>
										<DrawerTrigger asChild>
											<Button variant="outline" className="w-full gap-2">
												<RiFilter3Line size={16} />
												Filters
												{(searchQuery || wordCountFilter !== "all") && (
													<span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
														{(searchQuery ? 1 : 0) + (wordCountFilter !== "all" ? 1 : 0)}
													</span>
												)}
											</Button>
										</DrawerTrigger>
										<DrawerContent aria-describedby={undefined}>
											<DrawerHeader>
												<DrawerTitle>Filters</DrawerTitle>
											</DrawerHeader>
											<div className="flex flex-col gap-4 px-4 pb-6">
												<div className="flex flex-col gap-2">
													<label className="font-medium text-muted-foreground text-sm">Search</label>
													<div className="relative">
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
												</div>
												<div className="flex flex-col gap-2">
													<label className="font-medium text-muted-foreground text-sm">Length</label>
													<Select
														value={wordCountFilter}
														onValueChange={(v) =>
															setWordCountFilter(v as WordCountCategory)
														}
													>
														<SelectTrigger className="w-full border-border/40 bg-muted/40">
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
											</div>
											<DrawerFooter>
												<DrawerClose asChild>
													<Button>Apply Filters</Button>
												</DrawerClose>
											</DrawerFooter>
										</DrawerContent>
									</Drawer>
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
								description="Try adjusting your difficulty, type filters, or search query to see more texts."
								icon={<RiSearch2Line className="size-full" />}
								variant="minimal"
								primaryAction={{
									label: "Clear Filters",
									onClick: () => {
										setSearchQuery("");
										setTypeFilter("all");
										setDifficultyFilter("all");
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
