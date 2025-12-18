import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
	getAnalysisById,
	getScoreLevel,
	type PhonemeError,
	scoreBgColorVariants,
	scoreColorVariants,
	type WordError,
} from "@/data/mock";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/practice/$textId/analysis/$analysisId")({
	component: AnalysisPage,
	loader: async ({ params }) => {
		const data = getAnalysisById(params.analysisId);
		return {
			...data,
			textId: params.textId,
		};
	},
	pendingComponent: AnalysisSkeleton,
});

// ============================================================================
// SCORE CARD
// ============================================================================

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

// ============================================================================
// SCORE OVERVIEW
// ============================================================================

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

// ============================================================================
// TEXT COMPARISON
// ============================================================================

interface TextComparisonProps {
	target: string;
	recognized: string;
	errors: WordError[];
}

function TextComparison({ target, recognized, errors }: TextComparisonProps) {
	const recognizedWords = recognized.split(" ");

	const getErrorForPosition = (position: number) =>
		errors.find((e) => e.position === position);

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Sentence Comparison</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs uppercase tracking-wide">
						Target
					</div>
					<p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
						{target}
					</p>
				</div>
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs uppercase tracking-wide">
						Your Speech
					</div>
					<p className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
						{recognizedWords.map((word, i) => {
							const error = getErrorForPosition(i);
							if (error) {
								return (
									<span
										key={i}
										className="mx-0.5 rounded bg-destructive/20 px-1 text-destructive"
										title={`Expected: ${error.expected}`}
									>
										{word}
									</span>
								);
							}
							return <span key={i}>{word} </span>;
						})}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// PHONEME COMPARISON
// ============================================================================

interface PhonemeComparisonProps {
	target: string;
	recognized: string;
}

function PhonemeComparison({ target, recognized }: PhonemeComparisonProps) {
	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Phoneme Comparison</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs uppercase tracking-wide">
						Target Phonemes
					</div>
					<p className="rounded-lg bg-muted/50 p-3 font-mono text-sm">
						{target}
					</p>
				</div>
				<div className="space-y-2">
					<div className="text-muted-foreground text-xs uppercase tracking-wide">
						Recognized Phonemes
					</div>
					<p className="rounded-lg bg-muted/50 p-3 font-mono text-sm">
						{recognized}
					</p>
				</div>
			</CardContent>
		</Card>
	);
}

// ============================================================================
// ERROR LIST
// ============================================================================

interface ErrorListProps {
	phonemeErrors: PhonemeError[];
	wordErrors: WordError[];
}

function ErrorList({ phonemeErrors, wordErrors }: ErrorListProps) {
	const allErrors = [
		...wordErrors.map((e) => ({ ...e, type: "word" as const })),
		...phonemeErrors.map((e) => ({ ...e, type: "phoneme" as const })),
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

// ============================================================================
// SKELETON
// ============================================================================

function AnalysisSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="lg">
				<div className="space-y-6">
					<div className="flex items-center gap-4">
						<Skeleton className="size-9" />
						<div className="space-y-2">
							<Skeleton className="h-7 w-48" />
							<Skeleton className="h-4 w-72" />
						</div>
					</div>
					<Skeleton className="h-40" />
					<div className="grid gap-6 lg:grid-cols-2">
						<Skeleton className="h-48" />
						<Skeleton className="h-48" />
					</div>
					<Skeleton className="h-32" />
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// ============================================================================
// MAIN PAGE
// ============================================================================

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
							<TextComparison
								target={analysis.targetWords}
								recognized={analysis.recognizedWords}
								errors={wordErrors ?? []}
							/>
						)}
						{analysis.targetPhonemes && analysis.recognizedPhonemes && (
							<PhonemeComparison
								target={analysis.targetPhonemes}
								recognized={analysis.recognizedPhonemes}
							/>
						)}
					</div>

					{/* Error List */}
					<ErrorList
						phonemeErrors={phonemeErrors ?? []}
						wordErrors={wordErrors ?? []}
					/>

					{/* Actions */}
					<div className="flex flex-col justify-center gap-3 sm:flex-row">
						<Button asChild>
							<Link to="/practice/$textId" params={{ textId }}>
								Practice Again
							</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/summary" params={{ textId, analysisId: analysis.id }}>
								View All Attempts
							</Link>
						</Button>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
