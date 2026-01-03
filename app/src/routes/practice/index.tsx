import { createFileRoute } from "@tanstack/react-router";
import { ChevronDown, Flame, Layers, Leaf, Zap } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import {
	categoryGradientVariants,
	categoryLabels,
	PracticeTextTable,
} from "@/components/practice-text-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { InlineLink } from "@/components/ui/inline-link";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { TextDifficulty, TextType } from "@/db/types";
import { serverGetPracticeTextsWithReferences } from "@/lib/text";
import { cn } from "@/lib/utils";
import { getWordCountCategory, useTextFilterStore } from "@/stores/text-store";

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
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={isSelected}
			className={cn(
				"relative flex aspect-4/3 min-h-14 flex-col justify-end overflow-hidden rounded-xl p-2 transition-all sm:min-h-16 sm:p-3",
				categoryGradientVariants({ type }),
				isSelected
					? "ring-2 ring-primary ring-offset-2 ring-offset-background"
					: "opacity-60 hover:opacity-90",
			)}
		>
			{/* Placeholder icon area */}
			<svg
				className="absolute top-1.5 right-1.5 size-5 text-white/30 sm:top-2 sm:right-2 sm:size-6"
				viewBox="0 0 24 24"
				fill="currentColor"
				aria-hidden="true"
			>
				<circle cx="12" cy="12" r="10" />
			</svg>
			<span className="relative font-medium text-[10px] text-white drop-shadow-sm sm:text-xs md:text-sm">
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
		const result = await serverGetPracticeTextsWithReferences();
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
				<div className="flex min-h-64 flex-col items-center justify-center">
					<ShimmeringText
						text="Loading practice texts..."
						className="text-lg"
						duration={1.5}
					/>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// MAIN PAGE

function PracticePage() {
	const { texts: allTexts } = Route.useLoaderData();
	const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE);
	const {
		difficultyFilter,
		typeFilter,
		wordCountFilter,
		setDifficultyFilter,
		setTypeFilter,
	} = useTextFilterStore();

	// Memoize filtered texts to prevent unnecessary recalculations
	const filteredTexts = useMemo(() => {
		return allTexts.filter((text) => {
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
	}, [allTexts, difficultyFilter, typeFilter, wordCountFilter]);

	const visibleTexts = useMemo(
		() => filteredTexts.slice(0, visibleCount),
		[filteredTexts, visibleCount],
	);
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
				<div className="flex flex-col gap-4 sm:gap-6">
					<PageHeader
						title="Practice Texts"
						description="Choose a text to practice your pronunciation."
					/>

					{allTexts.length > 0 && (
						<>
							{/* Category cards - grid with padding for ring */}
							<div className="-mx-1 px-1 py-1">
								<div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6 sm:gap-3">
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

							{/* Difficulty switcher */}
							<DifficultySwitcher
								value={difficultyFilter}
								onChange={handleDifficultyFilterChange}
							/>
						</>
					)}

					{filteredTexts.length > 0 ? (
						<>
							<PracticeTextTable texts={visibleTexts} />
							{hasMore && (
								<div className="flex justify-center pb-4">
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
							description="Try adjusting your difficulty or type filters to see more texts."
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
				</div>
			</PageContainer>
		</MainLayout>
	);
}
