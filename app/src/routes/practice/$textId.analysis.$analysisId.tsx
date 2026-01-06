import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DiffViewer } from "@/components/diff-viewer";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import type {
	Analysis,
	Author,
	PhonemeError,
	PracticeText,
	ReferenceSpeech,
	WordError,
} from "@/db/types";
import {
	getScoreLevel,
	scoreBgColorVariants,
	scoreColorVariants,
} from "@/lib/score";
import { cn, formatRelativeTime } from "@/lib/utils";
import { serverGetAnalysisDetails } from "@/lib/server-analysis";

type PreviousAttempt = {
	id: string;
	analysisId: string;
	score: number;
	date: Date;
};

type AnalysisLoaderData = {
	analysis: Analysis | null;
	reference: ReferenceSpeech | null;
	text: PracticeText | null;
	author: Author | null;
	phonemeErrors: PhonemeError[];
	wordErrors: WordError[];
	previousAttempts: PreviousAttempt[];
	textId: string;
};

export const Route = createFileRoute("/practice/$textId/analysis/$analysisId")({
	component: AnalysisPage,
	loader: async ({ params }): Promise<AnalysisLoaderData> => {
		const response = await serverGetAnalysisDetails({
			data: { analysisId: params.analysisId },
		});

		if (!response.success || !response.data) {
			// Return nulls to trigger empty/error state
			return {
				analysis: null,
				reference: null,
				text: null,
				author: null,
				phonemeErrors: [],
				wordErrors: [],
				previousAttempts: [],
				textId: params.textId,
			};
		}

		const { analysis, phonemeErrors, wordErrors } = response.data;

		// TODO: Fetch previous attempts
		const mockPreviousAttempts: PreviousAttempt[] = [];

		return {
			analysis,
			reference: null,
			text: null,
			author: null,
			phonemeErrors,
			wordErrors,
			previousAttempts: mockPreviousAttempts,
			textId: params.textId,
		};
	},
	pendingComponent: AnalysisSkeleton,
});

// SCORE CARD

interface ScoreCardProps {
	label: string;
	score: number;
	size?: "sm" | "md" | "lg";
}

function ScoreCard({ label, score, size = "md" }: ScoreCardProps) {
	const percentage = Math.round(score * 100);
	const sizeClasses = {
		sm: "size-8",
		md: "size-12",
		lg: "size-16",
	};

	const level = getScoreLevel(percentage);

	return (
		<div className="flex flex-col items-center gap-2">
			<div
				className={cn(
					"relative rounded-full",
					sizeClasses[size],
					scoreBgColorVariants({ level }),
				)}
			>
				<svg
					className="-rotate-90 size-full"
					viewBox="0 0 100 100"
					aria-hidden="true"
				>
					<circle
						cx="50"
						cy="50"
						r="40"
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						className="text-muted/30"
					/>
					<circle
						cx="50"
						cy="50"
						r="40"
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						strokeLinecap="round"
						strokeDasharray={`${percentage * 2.51} 251`}
						className={scoreColorVariants({ level })}
					/>
				</svg>
				<div className="absolute inset-0 flex items-center justify-center">
					<span
						className={cn(
							"font-semibold tabular-nums",
							scoreColorVariants({ level }),
						)}
					>
						{percentage}%
					</span>
				</div>
			</div>
			<span className="text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</span>
		</div>
	);
}

// SCORE OVERVIEW

interface ScoreOverviewProps {
	overallScore: number;
	phonemeScore: number | null;
	wordScore: number | null;
}

function ScoreOverview({
	overallScore,
	phonemeScore,
	wordScore,
}: ScoreOverviewProps) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Score Overview</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex items-center justify-around py-4">
					<ScoreCard label="Overall" score={overallScore} size="lg" />
					{phonemeScore !== null && (
						<ScoreCard label="Phonemes" score={phonemeScore} />
					)}
					{wordScore !== null && <ScoreCard label="Words" score={wordScore} />}
				</div>
			</CardContent>
		</Card>
	);
}

// PREVIOUS ATTEMPTS

interface PreviousAttemptsProps {
	attempts: Array<{
		id: string;
		analysisId: string;
		score: number;
		date: Date;
	}>;
	currentAnalysisId: string;
	textId: string;
}

function PreviousAttempts({
	attempts,
	currentAnalysisId,
	textId,
}: PreviousAttemptsProps) {
	if (attempts.length === 0) return null;

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Previous Attempts</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-wrap gap-2">
					{attempts.map((attempt) => {
						const isCurrent = attempt.analysisId === currentAnalysisId;
						return (
							<Link
								key={attempt.id}
								to="/practice/$textId/analysis/$analysisId"
								params={{
									textId,
									analysisId: attempt.analysisId,
								}}
								className={cn(
									"flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors",
									isCurrent
										? "border-primary bg-primary/5"
										: "hover:border-primary/50 hover:bg-muted/50",
								)}
							>
								<span
									className={cn(
										"font-medium tabular-nums",
										scoreColorVariants({
											level: getScoreLevel(attempt.score),
										}),
									)}
								>
									{attempt.score}%
								</span>
								<span className="text-muted-foreground text-xs">
									{formatRelativeTime(attempt.date)}
								</span>
								{isCurrent && (
									<Badge variant="secondary" className="text-xs">
										Current
									</Badge>
								)}
							</Link>
						);
					})}
				</div>
			</CardContent>
		</Card>
	);
}

// ERROR LIST

interface ErrorListProps {
	phonemeErrors: PhonemeError[];
	wordErrors: WordError[];
}

type ErrorWithType =
	| (WordError & { type: "word" })
	| (PhonemeError & { type: "phoneme" });

function ErrorList({ phonemeErrors, wordErrors }: ErrorListProps) {
	const allErrors: ErrorWithType[] = [
		...wordErrors.map((e): ErrorWithType => ({ ...e, type: "word" })),
		...phonemeErrors.map((e): ErrorWithType => ({ ...e, type: "phoneme" })),
	];

	if (allErrors.length === 0) {
		return (
			<Card>
				<CardContent className="py-8">
					<div className="text-center">
						<div className="mb-2 text-2xl">🎉</div>
						<p className="font-medium">Perfect pronunciation!</p>
						<p className="text-muted-foreground text-sm">
							No errors detected in this recording.
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<Collapsible defaultOpen>
				<CollapsibleTrigger className="flex w-full items-center justify-between p-6">
					<h3 className="font-semibold text-base">
						Error Details ({allErrors.length})
					</h3>
					<span className="text-muted-foreground text-sm">Click to expand</span>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<CardContent className="pt-0">
						<div className="space-y-2">
							{allErrors.map((error) => (
								<div
									key={error.id}
									className="flex items-center gap-3 rounded-lg bg-muted/50 p-3"
								>
									<Badge
										variant={
											error.errorType === "substitute"
												? "destructive"
												: "secondary"
										}
									>
										{error.errorType}
									</Badge>
									<div className="flex-1">
										{error.type === "word" ? (
											<span className="text-sm">
												<span className="font-medium">"{error.expected}"</span>
												{" → "}
												<span className="text-destructive">
													"{error.actual}"
												</span>
											</span>
										) : (
											<span className="font-mono text-sm">
												<span className="font-medium">/{error.expected}/</span>
												{" → "}
												<span className="text-destructive">
													/{error.actual}/
												</span>
											</span>
										)}
									</div>
									<Badge variant="outline" className="text-xs">
										{error.type}
									</Badge>
								</div>
							))}
						</div>
					</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}

// Loading state

function AnalysisSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="lg">
				<div className="flex min-h-64 flex-col items-center justify-center">
					<ShimmeringText
						text="Loading analysis..."
						className="text-lg"
						duration={1.5}
					/>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// MAIN PAGE

function AnalysisPage() {
	const { analysis, phonemeErrors, wordErrors, textId } = Route.useLoaderData();
	const navigate = useNavigate();

	if (!analysis) {
		return (
			<MainLayout>
				<PageContainer maxWidth="lg">
					<EmptyState
						title="Analysis not found"
						description="This analysis may have been removed or doesn't exist."
						primaryAction={{
							label: "Back to Practice",
							onClick: () =>
								navigate({ to: "/practice/$textId", params: { textId } }),
						}}
					/>
				</PageContainer>
			</MainLayout>
		);
	}

	return (
		<MainLayout>
			<PageContainer maxWidth="lg">
				<div className="space-y-6">
					{/* Header */}
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" asChild>
							<Link to="/practice/$textId" params={{ textId }}>
								<ArrowLeft size={18} />
							</Link>
						</Button>
						<div className="space-y-1">
							<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-transparent text-xl tracking-tight md:text-2xl">
								Analysis Results
							</h1>
							<p className="text-muted-foreground text-sm">
								Review your pronunciation analysis
							</p>
						</div>
					</div>

					{/* Score Overview */}
					<ScoreOverview
						overallScore={Number(analysis.overallScore)}
						phonemeScore={
							analysis.phonemeScore !== null
								? Number(analysis.phonemeScore)
								: null
						}
						wordScore={
							analysis.wordScore !== null ? Number(analysis.wordScore) : null
						}
					/>

					{/* Comparisons */}
					<div className="grid gap-6 lg:grid-cols-2">
						{analysis.targetWords && analysis.recognizedWords && (
							<DiffViewer
								target={analysis.targetWords}
								recognized={analysis.recognizedWords}
								errors={wordErrors ?? []}
								type="word"
							/>
						)}
						{analysis.targetPhonemes && analysis.recognizedPhonemes && (
							<DiffViewer
								target={analysis.targetPhonemes}
								recognized={analysis.recognizedPhonemes}
								errors={phonemeErrors ?? []}
								type="phoneme"
							/>
						)}
					</div>

					{/* Error List */}
					<ErrorList
						phonemeErrors={phonemeErrors ?? []}
						wordErrors={wordErrors ?? []}
					/>

					{/* Previous Attempts */}
					<PreviousAttempts
						attempts={Route.useLoaderData().previousAttempts}
						currentAnalysisId={analysis.id}
						textId={textId}
					/>

					{/* Actions */}
					<div className="flex flex-col justify-center gap-3 sm:flex-row">
						<Button asChild>
							<Link to="/practice/$textId" params={{ textId }}>
								Practice Again
							</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/summary">View All Attempts</Link>
						</Button>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
