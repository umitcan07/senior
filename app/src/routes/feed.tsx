import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type Attempt,
	type CommonError,
	formatRelativeTime,
	getScoreColor,
	MOCK_ATTEMPTS,
	MOCK_COMMON_ERRORS,
	MOCK_TEXTS,
	MOCK_USER_STATS,
	type UserStats,
} from "@/data/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/feed")({
	component: FeedPage,
	loader: async () => {
		// In production, fetch from database
		return {
			attempts: MOCK_ATTEMPTS,
			stats: MOCK_USER_STATS,
			commonErrors: MOCK_COMMON_ERRORS,
			texts: MOCK_TEXTS,
		};
	},
	pendingComponent: FeedSkeleton,
});

// ============================================================================
// STATS SUMMARY
// ============================================================================

interface StatsSummaryProps {
	stats: UserStats;
}

function StatCard({
	label,
	value,
	suffix,
	trend,
}: {
	label: string;
	value: number;
	suffix?: string;
	trend?: number;
}) {
	return (
		<Card>
			<CardContent className="p-4 sm:p-6">
				<div className="space-y-1">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						{label}
					</p>
					<div className="flex items-baseline gap-2">
						<span className="font-semibold text-2xl tabular-nums sm:text-3xl">
							{value}
							{suffix}
						</span>
						{trend !== undefined && trend !== 0 && (
							<span
								className={cn(
									"text-xs",
									trend > 0 ? "text-green-600" : "text-red-600",
								)}
							>
								{trend > 0 ? "+" : ""}
								{trend}%
							</span>
						)}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function StatsSummary({ stats }: StatsSummaryProps) {
	return (
		<div className="grid gap-4 sm:grid-cols-3">
			<StatCard label="Total Attempts" value={stats.totalAttempts} />
			<StatCard
				label="This Week"
				value={stats.weeklyAttempts}
				trend={stats.weeklyProgress}
			/>
			<StatCard label="Average Score" value={stats.averageScore} suffix="%" />
		</div>
	);
}

// ============================================================================
// COMMON ERRORS
// ============================================================================

interface CommonErrorsProps {
	errors: CommonError[];
}

function CommonErrors({ errors }: CommonErrorsProps) {
	if (errors.length === 0) return null;

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Most Challenging Sounds</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-2">
					{errors.map((error) => (
						<div
							key={error.phoneme}
							className="flex items-center gap-2 rounded-md bg-muted px-3 py-2"
						>
							<span className="font-mono text-base">{error.phoneme}</span>
							<Badge variant="secondary" className="text-xs">
								{error.count}
							</Badge>
						</div>
					))}
				</div>
				<p className="mt-3 text-muted-foreground text-xs">
					Focus on these sounds to improve your pronunciation accuracy.
				</p>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// FILTER BAR
// ============================================================================

interface FilterBarProps {
	texts: { id: string; content: string }[];
	selectedTextId: string | null;
	sortBy: "date" | "score";
	onTextChange: (textId: string | null) => void;
	onSortChange: (sort: "date" | "score") => void;
}

function FilterBar({
	texts,
	selectedTextId,
	sortBy,
	onTextChange,
	onSortChange,
}: FilterBarProps) {
	return (
		<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex gap-2">
				<Select
					value={selectedTextId ?? "all"}
					onValueChange={(v) => onTextChange(v === "all" ? null : v)}
				>
					<SelectTrigger className="w-48">
						<SelectValue placeholder="All texts" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All texts</SelectItem>
						{texts.map((text) => (
							<SelectItem key={text.id} value={text.id}>
								{text.content.slice(0, 30)}...
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					value={sortBy}
					onValueChange={(v) => onSortChange(v as "date" | "score")}
				>
					<SelectTrigger className="w-32">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="date">Newest</SelectItem>
						<SelectItem value="score">Highest</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{selectedTextId && (
				<Button
					variant="ghost"
					size="sm"
					onClick={() => onTextChange(null)}
					className="text-muted-foreground"
				>
					Clear filter
				</Button>
			)}
		</div>
	);
}

// ============================================================================
// ATTEMPT CARD
// ============================================================================

interface AttemptCardProps {
	attempt: Attempt;
}

function AttemptCard({ attempt }: AttemptCardProps) {
	return (
		<Link
			to="/practice/$textId/analysis/$analysisId"
			params={{ textId: attempt.textId, analysisId: attempt.analysisId }}
			className="block"
		>
			<Card className="transition-all duration-150 hover:border-primary/30 hover:shadow-sm">
				<CardContent className="flex items-center gap-4 p-4">
					<div
						className={`flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-lg tabular-nums ${getScoreColor(attempt.score)}`}
					>
						{attempt.score}%
					</div>
					<div className="min-w-0 flex-1">
						<p className="truncate text-sm">{attempt.textPreview}</p>
						<p className="text-muted-foreground text-xs">
							{formatRelativeTime(attempt.date)}
						</p>
					</div>
					<span className="text-muted-foreground text-xs">View →</span>
				</CardContent>
			</Card>
		</Link>
	);
}

// ============================================================================
// ATTEMPT LIST
// ============================================================================

interface AttemptListProps {
	attempts: Attempt[];
	onLoadMore?: () => void;
	hasMore?: boolean;
	isLoading?: boolean;
}

function AttemptList({
	attempts,
	onLoadMore,
	hasMore,
	isLoading,
}: AttemptListProps) {
	if (attempts.length === 0) {
		return (
			<EmptyState
				title="No attempts found"
				description="Start practicing to see your history here."
				primaryAction={{
					label: "Start Practicing",
					onClick: () => {
						window.location.href = "/practice";
					},
				}}
			/>
		);
	}

	return (
		<div className="space-y-4">
			<div className="space-y-3">
				{attempts.map((attempt) => (
					<AttemptCard key={attempt.id} attempt={attempt} />
				))}
			</div>

			{hasMore && (
				<div className="flex justify-center pt-4">
					<Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
						{isLoading ? "Loading..." : "Load More"}
					</Button>
				</div>
			)}
		</div>
	);
}

// ============================================================================
// SKELETON
// ============================================================================

function FeedSkeleton() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="space-y-8">
					<div className="space-y-2">
						<Skeleton className="h-8 w-32" />
						<Skeleton className="h-4 w-64" />
					</div>
					<div className="grid gap-4 sm:grid-cols-3">
						{[1, 2, 3].map((i) => (
							<Skeleton key={i} className="h-24" />
						))}
					</div>
					<Skeleton className="h-32" />
					<div className="space-y-3">
						{[1, 2, 3, 4, 5].map((i) => (
							<Skeleton key={i} className="h-20" />
						))}
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// ============================================================================
// GUEST VIEW
// ============================================================================

function GuestFeed() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="space-y-8">
					<PageHeader
						title="Your History"
						description="Track your pronunciation progress over time"
					/>

					<Card className="border-dashed">
						<CardContent className="flex flex-col items-center gap-4 py-12 text-center">
							<div className="space-y-2">
								<h2 className="font-semibold text-lg">
									Sign in to see your progress
								</h2>
								<p className="max-w-md text-muted-foreground text-sm">
									Track your pronunciation improvements, identify challenging
									sounds, and review your practice history.
								</p>
							</div>
							<Button asChild>
								<SignInButton mode="modal">Sign in</SignInButton>
							</Button>
						</CardContent>
					</Card>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// ============================================================================
// MAIN PAGE
// ============================================================================

function FeedPage() {
	const { attempts, stats, commonErrors, texts } = Route.useLoaderData();
	const [selectedTextId, setSelectedTextId] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<"date" | "score">("date");

	// Filter and sort attempts
	const filteredAttempts = attempts
		.filter((a) => !selectedTextId || a.textId === selectedTextId)
		.sort((a, b) => {
			if (sortBy === "date") {
				return b.date.getTime() - a.date.getTime();
			}
			return b.score - a.score;
		});

	return (
		<>
			<SignedOut>
				<GuestFeed />
			</SignedOut>
			<SignedIn>
				<MainLayout>
					<PageContainer>
						<div className="space-y-8">
							<PageHeader
								title="Your History"
								description="Track your pronunciation progress over time"
							/>

							{/* Stats Summary */}
							<StatsSummary stats={stats} />

							{/* Common Errors */}
							<CommonErrors errors={commonErrors} />

							{/* Filter Bar */}
							<FilterBar
								texts={texts}
								selectedTextId={selectedTextId}
								sortBy={sortBy}
								onTextChange={setSelectedTextId}
								onSortChange={setSortBy}
							/>

							{/* Attempt List */}
							<AttemptList
								attempts={filteredAttempts}
								hasMore={filteredAttempts.length >= 10}
							/>
						</div>
					</PageContainer>
				</MainLayout>
			</SignedIn>
		</>
	);
}
