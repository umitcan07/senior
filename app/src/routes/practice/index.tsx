import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Flame, Layers, Leaf, Search, Zap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import {
	categoryGradientVariants,
	categoryLabels,
	PracticeTextTable,
} from "@/components/practice-text-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineLink } from "@/components/ui/inline-link";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { SectionTitle } from "@/components/ui/section-title";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TextDifficulty, TextType } from "@/db/types";
import { serverGetPracticeTextsWithAttemptStats } from "@/lib/text";
import { cn } from "@/lib/utils";
import { 
	getWordCountCategory, 
	useTextFilterStore,
	type WordCountCategory 
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
	icon: typeof Layers;
	color: string;
}> = [
	{ value: "all", label: "All", icon: Layers, color: "text-muted-foreground" },
	{ value: "beginner", label: "Beginner", icon: Leaf, color: "text-green-500" },
	{
		value: "intermediate",
		label: "Intermediate",
		icon: Zap,
		color: "text-amber-500",
	},
	{ value: "advanced", label: "Advanced", icon: Flame, color: "text-red-500" },
];

interface CategoryCardProps {
	type: TextType | "all";
	isSelected: boolean;
	onClick: () => void;
}

function CategoryCard({ type, isSelected, onClick }: CategoryCardProps) {
	// Map types to Lucide icons
	const Icon = {
		all: Layers,
		daily: Leaf,
		professional: Zap,
		academic: Flame,
		phonetic_challenge: Search, // Using Search as a placeholder for phonetic
		common_phrase: ChevronDown, // Placeholder
	}[type] || Layers;

	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={isSelected}
			className={cn(
				"group relative flex aspect-square w-full flex-col justify-end overflow-hidden rounded-xl p-3 transition-colors",
				categoryGradientVariants({ type }),
				isSelected
					? "ring-2 ring-primary ring-offset-2 ring-offset-background"
					: "opacity-80 hover:opacity-100",
			)}
		>
			<Icon 
				className="absolute -right-4 -top-4 size-24 text-white/20 rotate-12 transition-transform" 
				strokeWidth={1.5}
			/>
			
			<div className="relative z-10 flex flex-col items-start gap-1">
				<span className="font-semibold text-white tracking-tight text-sm sm:text-base leading-tight">
					{categoryLabels[type]}
				</span>
			</div>
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
					const Icon = item.icon;
					const isActive = value === item.value;
					return (
						<TabsTrigger
							key={item.value}
							value={item.value}
							className="flex-1 gap-1.5"
						>
							<Icon size={14} className={isActive ? item.color : undefined} />
							<span className="hidden sm:inline">{item.label}</span>
						</TabsTrigger>
					);
				})}
			</TabsList>
		</Tabs>
	);
}

export const Route = createFileRoute("/practice/")({
	component: PracticePage,
	loader: async () => {
		const result = await serverGetPracticeTextsWithAttemptStats();

		if (result.success) {
			return {
				texts: result.data.map((text) => ({
					...text,
					referenceCount: text.referenceCount ?? 0,
					wordCount: text.wordCount ?? text.content.split(/\s+/).length,
				})),
			};
		}

		return {
			texts: [],
		};
	},
	pendingComponent: PracticePageSkeleton,
});

function PracticePageSkeleton() {

	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-12">
					<div className="flex min-h-64 flex-col items-center justify-center">
						<ShimmeringText
							text="Loading practice texts..."
							className="text-lg"
							duration={1.5}
						/>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// MAIN PAGE

function PracticePage() {
	const { texts: allTexts } = Route.useLoaderData();
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
			if (searchQuery && !text.content.toLowerCase().includes(searchQuery.toLowerCase())) {
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

	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-10">
					{allTexts.length > 0 && (
						<>
							{/* Filters Section */}
							<section className="flex flex-col gap-8">
								<div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
									<div className="flex flex-1 items-end gap-4">
										<div className="relative flex-1 max-w-md">
											<Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
											<Input
												type="search"
												placeholder="Search texts..."
												className="pl-9 bg-muted/40 border-border/40 focus-visible:bg-background transition-colors h-10"
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
											<SelectTrigger className="w-[140px] bg-muted/40 border-border/40">
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
									<h3 className="text-sm font-medium text-muted-foreground">Category</h3>
									<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
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
									<h3 className="text-sm font-medium text-muted-foreground">Difficulty</h3>
									<DifficultySwitcher
										value={difficultyFilter}
										onChange={handleDifficultyFilterChange}
									/>
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
									<div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
										<SectionTitle 
											title="Ready to try again?" 
											variant="playful"
											description="Beat your high score on these texts."
										/>
										<PracticeTextTable texts={attemptedTexts.slice(0, visibleCount)} />
									</div>
								)}

								{/* New Texts */}
								{newTexts.length > 0 && (
									<div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
										<SectionTitle 
											title={attemptedTexts.length > 0 ? "New Challenges" : "Practice Texts"} 
											variant="default"
										/>
										<PracticeTextTable texts={newTexts.slice(0, Math.max(0, visibleCount - attemptedTexts.length))} />
									</div>
								)}

								{hasMore && (
									<div className="flex justify-center pb-4 pt-4">
										<Button variant="outline" onClick={handleLoadMore}>
											<ChevronDown size={16} />
											Load More
										</Button>
									</div>
								)}
							</>
						) : allTexts.length > 0 ? (
							<EmptyState
								title="No texts match your filters"
								description="Try adjusting your difficulty, type filters, or search query to see more texts."
								icon={<Search className="size-full" />}
								variant="minimal"
								primaryAction={{
									label: "Clear Filters",
									onClick: () => {
										setSearchQuery("");
										setTypeFilter("all");
										setDifficultyFilter("all");
									}
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
