import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
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
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { getScoreLevel, scoreColorVariants } from "@/lib/score";
import { cn, formatRelativeTime } from "@/lib/utils";

type Attempt = {
	id: string;
	textId: string;
	textPreview: string;
	score: number;
	date: Date;
	analysisId: string;
};

type SummaryLoaderData = {
	attempts: Attempt[];
	stats: {
		totalAttempts: number;
		weeklyAttempts: number;
		averageScore: number;
		weeklyProgress: number;
	};
	commonErrors: Array<{ phoneme: string; count: number }>;
	texts: Array<{ id: string; content: string }>;
};

export const Route = createFileRoute("/summary")({
	component: FeedPage,
	loader: async (): Promise<SummaryLoaderData> => {
		// Mock data for demonstration
		const now = new Date();
		const mockAttempts: Attempt[] = [
			{
				id: "attempt-1",
				textId: "text-1",
				textPreview: "The quick brown fox jumps over the lazy dog",
				score: 85,
				date: new Date(now.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
				analysisId: "analysis-1",
			},
			{
				id: "attempt-2",
				textId: "text-1",
				textPreview: "The quick brown fox jumps over the lazy dog",
				score: 82,
				date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
				analysisId: "analysis-2",
			},
			{
				id: "attempt-3",
				textId: "text-2",
				textPreview: "She sells seashells by the seashore",
				score: 78,
				date: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
				analysisId: "analysis-3",
			},
			{
				id: "attempt-4",
				textId: "text-1",
				textPreview: "The quick brown fox jumps over the lazy dog",
				score: 88,
				date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
				analysisId: "analysis-4",
			},
			{
				id: "attempt-5",
				textId: "text-3",
				textPreview: "How much wood would a woodchuck chuck",
				score: 75,
				date: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
				analysisId: "analysis-5",
			},
			{
				id: "attempt-6",
				textId: "text-2",
				textPreview: "She sells seashells by the seashore",
				score: 80,
				date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
				analysisId: "analysis-6",
			},
			{
				id: "attempt-7",
				textId: "text-1",
				textPreview: "The quick brown fox jumps over the lazy dog",
				score: 79,
				date: new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000), // 6 days ago
				analysisId: "analysis-7",
			},
			{
				id: "attempt-8",
				textId: "text-4",
				textPreview: "Peter Piper picked a peck of pickled peppers",
				score: 72,
				date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
				analysisId: "analysis-8",
			},
		];

		const weeklyAttempts = mockAttempts.filter(
			(a) => now.getTime() - a.date.getTime() <= 7 * 24 * 60 * 60 * 1000,
		).length;

		const averageScore =
			mockAttempts.length > 0
				? Math.round(
						mockAttempts.reduce((sum, a) => sum + a.score, 0) /
							mockAttempts.length,
					)
				: 0;

		return {
			attempts: mockAttempts,
			stats: {
				totalAttempts: mockAttempts.length,
				weeklyAttempts,
				averageScore,
				weeklyProgress: 5, // Mock progress percentage
			},
			commonErrors: [
				{ phoneme: "/θ/", count: 12 },
				{ phoneme: "/ð/", count: 8 },
				{ phoneme: "/r/", count: 6 },
				{ phoneme: "/l/", count: 5 },
			],
			texts: [
				{
					id: "text-1",
					content: "The quick brown fox jumps over the lazy dog",
				},
				{ id: "text-2", content: "She sells seashells by the seashore" },
				{ id: "text-3", content: "How much wood would a woodchuck chuck" },
				{
					id: "text-4",
					content: "Peter Piper picked a peck of pickled peppers",
				},
			],
		};
	},
	pendingComponent: FeedSkeleton,
});

// STATS SUMMARY

interface StatsSummaryProps {
	stats: {
		totalAttempts: number;
		weeklyAttempts: number;
		averageScore: number;
		weeklyProgress: number;
	};
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
				<div className="flex flex-col gap-1">
					<p className="text-muted-foreground text-xs uppercase tracking-wide">
						{label}
					</p>
					<div className="flex items-baseline gap-2">
						<span className="font-medium text-2xl tabular-nums sm:text-3xl">
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

// COMMON ERRORS

interface CommonErrorsProps {
	errors: Array<{ phoneme: string; count: number }>;
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

// FILTER BAR

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
					onValueChange={(v) => {
						if (v === "date" || v === "score") {
							onSortChange(v);
						}
					}}
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

// ATTEMPT CARD

interface AttemptCardProps {
	attempt: {
		id: string;
		textId: string;
		textPreview: string;
		score: number;
		date: Date;
		analysisId: string;
	};
}

function AttemptCard({ attempt }: AttemptCardProps) {
	return (
		<Link
			to="/practice/$textId/analysis/$analysisId"
			params={{ textId: attempt.textId, analysisId: attempt.analysisId }}
			className="block"
		>
			<Card>
				<CardContent className="flex items-center gap-4 p-4">
					<div
						className={cn(
							"flex size-12 shrink-0 items-center justify-center rounded-lg bg-muted font-semibold text-sm",
							scoreColorVariants({ level: getScoreLevel(attempt.score) }),
						)}
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

// ATTEMPT LIST

interface AttemptListProps {
	attempts: Array<{
		id: string;
		textId: string;
		textPreview: string;
		score: number;
		date: Date;
		analysisId: string;
	}>;
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
		<div className="flex flex-col gap-4">
			<div className="flex flex-col gap-3">
				{attempts.map((attempt) => (
					<AttemptCard key={attempt.id} attempt={attempt} />
				))}
			</div>

			{hasMore && (
				<div className="flex justify-center pt-4">
					<Button variant="outline" onClick={onLoadMore} disabled={isLoading}>
						Load More
					</Button>
				</div>
			)}
		</div>
	);
}

// Loading state

function FeedSkeleton() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-12">
					<div className="flex min-h-64 flex-col items-center justify-center">
						<ShimmeringText
							text="Loading your progress..."
							className="text-lg"
							duration={1.5}
						/>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// GUEST VIEW

function GuestFeed() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-16">
					<Card className="bg-muted/30">
						<CardContent className="flex flex-col items-center gap-4 py-12 text-center">
							<div className="flex flex-col gap-2">
								<h2 className="font-medium text-lg">
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

// MAIN PAGE

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
						<div className="flex flex-col gap-16">
							{/* Stats Summary */}
							<section className="flex flex-col gap-6">
								<h2 className="font-semibold text-lg">Overview</h2>
								<StatsSummary stats={stats} />
							</section>

							{/* Common Errors */}
							{commonErrors.length > 0 && (
								<CommonErrors errors={commonErrors} />
							)}

							{/* Filter Bar & Attempt List */}
							<section className="flex flex-col gap-6">
								<h2 className="font-semibold text-lg">Practice History</h2>
								<FilterBar
									texts={texts}
									selectedTextId={selectedTextId}
									sortBy={sortBy}
									onTextChange={setSelectedTextId}
									onSortChange={setSortBy}
								/>
								<AttemptList
									attempts={filteredAttempts}
									hasMore={filteredAttempts.length >= 10}
								/>
							</section>
						</div>
					</PageContainer>
				</MainLayout>
			</SignedIn>
		</>
	);
}
