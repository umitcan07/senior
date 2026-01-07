import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, Clock, Pause, Play, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { DiffViewer } from "@/components/diff-viewer";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SegmentPlayer } from "@/components/ui/segment-player";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
	Analysis,
	Author,
	PhonemeError,
	PracticeText,
	ReferenceSpeech,
	UserRecording,
	WordError,
} from "@/db/types";
import { getScoreLevel, scoreColorVariants } from "@/lib/score";
import { serverGetAnalysisDetails } from "@/lib/server-analysis";
import { cn } from "@/lib/utils";

type PreviousAttempt = {
	id: string;
	analysisId: string;
	score: number;
	date: Date;
};

type AnalysisLoaderData = {
	analysis: Analysis | null;
	userRecording: UserRecording | null;
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
			return {
				analysis: null,
				userRecording: null,
				reference: null,
				text: null,
				author: null,
				phonemeErrors: [],
				wordErrors: [],
				previousAttempts: [],
				textId: params.textId,
			};
		}

		const { analysis, userRecording, phonemeErrors, wordErrors } =
			response.data;

		const mockPreviousAttempts: PreviousAttempt[] = [];

		return {
			analysis,
			userRecording,
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

// Animated Score Ring
interface ScoreRingProps {
	score: number;
	size?: "sm" | "md" | "lg" | "xl";
	label?: string;
	animate?: boolean;
}

function ScoreRing({
	score,
	size = "lg",
	label,
	animate = true,
}: ScoreRingProps) {
	const percentage = Math.round(score * 100);
	const level = getScoreLevel(percentage);

	const sizeConfig = {
		sm: { ring: "size-12", text: "text-xs", label: "text-[8px]" },
		md: { ring: "size-16", text: "text-sm", label: "text-[10px]" },
		lg: { ring: "size-24", text: "text-lg", label: "text-[10px]" },
		xl: { ring: "size-32", text: "text-xl", label: "text-xs" },
	};

	const config = sizeConfig[size];
	const circumference = 2 * Math.PI * 40;
	const strokeDashoffset = circumference - (percentage / 100) * circumference;



	return (
		<div className="flex flex-col items-center gap-2">
			<div className={cn("relative", config.ring)}>
				<svg className="-rotate-90 size-full" viewBox="0 0 100 100">
					{/* Background ring */}
					<circle
						cx="50"
						cy="50"
						r="40"
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						className="text-muted/20"
					/>
					{/* Progress ring */}
					<motion.circle
						cx="50"
						cy="50"
						r="40"
						fill="none"
						stroke="currentColor"
						strokeWidth="8"
						strokeLinecap="round"
						className={scoreColorVariants({ level })}
						initial={animate ? { strokeDashoffset: circumference } : undefined}
						animate={{ strokeDashoffset }}
						transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
						style={{ strokeDasharray: circumference }}
					/>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<motion.span
						className={cn(
							"font-semibold tabular-nums",
							config.text,
							scoreColorVariants({ level }),
						)}
						initial={animate ? { opacity: 0, scale: 0.5 } : undefined}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.5, delay: 0.5 }}
					>
						{percentage}%
					</motion.span>
				</div>
			</div>
			{label && (
				<span
					className={cn(
						"text-muted-foreground uppercase tracking-wider",
						config.label,
					)}
				>
					{label}
				</span>
			)}
		</div>
	);
}

// User Recording Player with error markers
interface ErrorMarker {
	startMs: number;
	endMs: number;
	type: "substitute" | "insert" | "delete";
}

interface RecordingPlayerProps {
	recordingId: string;
	durationMs?: number;
	errorMarkers?: ErrorMarker[];
	onSeekToError?: (startMs: number, endMs: number) => void;
}

function RecordingPlayer({
	recordingId,
	durationMs,
	errorMarkers = [],
	onSeekToError,
}: RecordingPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [currentTime, setCurrentTime] = useState(0);
	const [playbackSpeed, setPlaybackSpeed] = useState(1);

	const audioSrc = `/api/audio/user/${recordingId}`;
	const duration = durationMs ? durationMs / 1000 : 0;

	const togglePlay = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;

		if (isPlaying) {
			audio.pause();
		} else {
			audio.play();
		}
		setIsPlaying(!isPlaying);
	}, [isPlaying]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<motion.div
			className="flex flex-col gap-4 rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-primary/10 p-6"
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4 }}
		>
			<div className="flex items-center gap-3">
				<Volume2 size={18} className="text-primary" />
				<span className="font-medium">Your Recording</span>
			</div>

			<div className="flex items-center gap-4">
				<Button
					variant="default"
					size="icon"
					className="size-12 rounded-full"
					onClick={togglePlay}
				>
					{isPlaying ? (
						<Pause size={20} />
					) : (
						<Play size={20} className="ml-0.5" />
					)}
				</Button>

				{/* Progress bar with error markers */}
				<div className="flex flex-1 flex-col gap-1">
					<div className="relative h-2 overflow-hidden rounded-full bg-muted">
						{/* Error markers */}
						{duration > 0 &&
							errorMarkers.map((marker, idx) => {
								const startPercent = (marker.startMs / 1000 / duration) * 100;
								const widthPercent =
									((marker.endMs - marker.startMs) / 1000 / duration) * 100;
								return (
									<button
										key={`error-${idx}`}
										type="button"
										className={cn(
											"absolute top-0 h-full cursor-pointer opacity-60 transition-opacity hover:opacity-100",
											marker.type === "substitute" && "bg-destructive",
											marker.type === "insert" && "bg-amber-500",
											marker.type === "delete" && "bg-blue-500",
										)}
										style={{
											left: `${startPercent}%`,
											width: `${Math.max(widthPercent, 1)}%`,
										}}
										onClick={() =>
											onSeekToError?.(marker.startMs, marker.endMs)
										}
										title={`${marker.type} error`}
									/>
								);
							})}
						{/* Progress indicator */}
						<div
							className="pointer-events-none absolute top-0 left-0 h-full bg-primary/80 transition-all"
							style={{
								width: duration ? `${(currentTime / duration) * 100}%` : "0%",
							}}
						/>
					</div>
					<div className="flex justify-between text-muted-foreground text-xs">
						<span className="font-mono">{formatTime(currentTime)}</span>
						<span className="font-mono">{formatTime(duration)}</span>
					</div>
				</div>

				{/* Speed controls */}
				<div className="flex gap-1">
					{[0.5, 1].map((speed) => (
						<button
							key={speed}
							type="button"
							onClick={() => {
								setPlaybackSpeed(speed);
								if (audioRef.current) {
									audioRef.current.playbackRate = speed;
								}
							}}
							className={cn(
								"rounded-lg px-2.5 py-1 font-mono text-xs transition-colors",
								playbackSpeed === speed
									? "bg-primary text-primary-foreground"
									: "bg-muted text-muted-foreground hover:text-foreground",
							)}
						>
							{speed}x
						</button>
					))}
				</div>
			</div>

			<audio
				ref={audioRef}
				src={audioSrc}
				preload="metadata"
				className="hidden"
				onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
				onEnded={() => setIsPlaying(false)}
				onPlay={() => setIsPlaying(true)}
				onPause={() => setIsPlaying(false)}
			/>
		</motion.div>
	);
}

// Score Overview with animation
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
	const percentage = Math.round(overallScore * 100);
	const level = getScoreLevel(percentage);
	
	const getScoreLabel = (pct: number) => {
		if (pct >= 90) return "Excellent!";
		if (pct >= 75) return "Good";
		if (pct >= 60) return "Fair";
		return "Needs Work";
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, delay: 0.1 }}
		>
			<Card className="overflow-hidden">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-base">Score Overview</CardTitle>
					<Badge 
						variant="secondary"
						className={cn(
							"font-medium",
							scoreColorVariants({ level }).replace("text-", "bg-").replace("dark:text-", "dark:bg-").replace("600", "500/15").replace("500", "500/15").replace("400", "500/25") + " text-foreground", // Hacky color mapping, ideally use separate variants
							level === "high" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
							level === "medium" && "bg-amber-500/15 text-amber-700 dark:text-amber-400",
							level === "low" && "bg-red-500/15 text-red-700 dark:text-red-400"
						)}
					>
						{getScoreLabel(percentage)}
					</Badge>
				</CardHeader>
				<CardContent>
					<div className="flex flex-col items-center gap-8 py-6">
						<ScoreRing score={overallScore} size="xl" label="Overall" />
						<div className="flex w-full justify-center gap-16 border-t border-border/40 pt-8">
							{phonemeScore !== null && (
								<ScoreRing score={phonemeScore} size="md" label="Phonemes" />
							)}
							{wordScore !== null && (
								<ScoreRing score={wordScore} size="md" label="Words" />
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Enhanced Error Item
interface ErrorItemProps {
	error: PhonemeError | WordError;
	type: "phoneme" | "word";
	audioSrc?: string;
	onPlaySegment?: (startMs: number, endMs: number) => void;
}

function ErrorItem({ error, type, audioSrc, onPlaySegment }: ErrorItemProps) {
	const hasTimestamps =
		"timestampStartMs" in error &&
		error.timestampStartMs != null &&
		error.timestampEndMs != null;

	const formatTimestamp = (ms: number) => {
		const seconds = Math.floor(ms / 1000);
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<motion.div
			className={cn(
				"flex items-center gap-3 rounded-xl p-4 transition-colors",
				error.errorType === "substitute" &&
					"bg-destructive/5 hover:bg-destructive/10",
				error.errorType === "insert" && "bg-amber-500/5 hover:bg-amber-500/10",
				error.errorType === "delete" && "bg-blue-500/5 hover:bg-blue-500/10",
			)}
			initial={{ opacity: 0, x: -10 }}
			animate={{ opacity: 1, x: 0 }}
			transition={{ duration: 0.2 }}
		>
			{/* Error type badge */}
			<Badge
				variant="outline"
				className={cn(
					"shrink-0 capitalize",
					error.errorType === "substitute" &&
						"border-destructive/50 text-destructive",
					error.errorType === "insert" &&
						"border-amber-500/50 text-amber-600 dark:text-amber-400",
					error.errorType === "delete" &&
						"border-blue-500/50 text-blue-600 dark:text-blue-400",
				)}
			>
				{error.errorType}
			</Badge>

			{/* Expected vs Actual */}
			<div className="flex flex-1 items-center gap-2">
				{type === "phoneme" ? (
					<>
						<span className="font-medium font-mono">
							/{error.expected ?? "∅"}/
						</span>
						<span className="text-muted-foreground">→</span>
						<span
							className={cn(
								"font-mono",
								error.errorType === "substitute" && "text-destructive",
								error.errorType === "insert" &&
									"text-amber-600 dark:text-amber-400",
							)}
						>
							/{error.actual ?? "∅"}/
						</span>
					</>
				) : (
					<>
						<span className="font-medium">"{error.expected ?? "—"}"</span>
						<span className="text-muted-foreground">→</span>
						<span
							className={cn(
								error.errorType === "substitute" && "text-destructive",
								error.errorType === "insert" &&
									"text-amber-600 dark:text-amber-400",
							)}
						>
							"{error.actual ?? "—"}"
						</span>
					</>
				)}
			</div>

			{/* Timestamp badge */}
			{hasTimestamps && (
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Badge
								variant="secondary"
								className="shrink-0 gap-1 font-mono text-xs"
							>
								<Clock size={10} />
								{formatTimestamp(error.timestampStartMs!)}
							</Badge>
						</TooltipTrigger>
						<TooltipContent>
							{formatTimestamp(error.timestampStartMs!)} -{" "}
							{formatTimestamp(error.timestampEndMs!)}
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>
			)}

			{/* Play button */}
			{audioSrc && hasTimestamps && onPlaySegment && (
				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0"
					onClick={() =>
						onPlaySegment(error.timestampStartMs!, error.timestampEndMs!)
					}
				>
					<Play size={14} />
				</Button>
			)}
		</motion.div>
	);
}

// Error List with Tabs
interface ErrorListProps {
	phonemeErrors: PhonemeError[];
	wordErrors: WordError[];
	audioSrc?: string;
	onPlaySegment?: (startMs: number, endMs: number) => void;
}

function ErrorList({
	phonemeErrors,
	wordErrors,
	audioSrc,
	onPlaySegment,
}: ErrorListProps) {
	const totalErrors = phonemeErrors.length + wordErrors.length;

	if (totalErrors === 0) {
		return (
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.3, delay: 0.3 }}
			>
				<Card className="overflow-hidden bg-gradient-to-br from-emerald-500/5 via-background to-emerald-500/10">
					<CardContent className="py-12">
						<div className="flex flex-col items-center gap-3 text-center">
							<motion.div
								className="text-5xl"
								initial={{ scale: 0 }}
								animate={{ scale: 1 }}
								transition={{ type: "spring", delay: 0.5 }}
							>
								🎉
							</motion.div>
							<h3 className="font-semibold text-emerald-600 text-lg dark:text-emerald-400">
								Perfect Pronunciation!
							</h3>
							<p className="text-muted-foreground text-sm">
								No errors detected in this recording. Great job!
							</p>
						</div>
					</CardContent>
				</Card>
			</motion.div>
		);
	}

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.4, delay: 0.2 }}
		>
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center justify-between text-base">
						<span>Error Details</span>
						<Badge variant="secondary">{totalErrors} total</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent>
					<Tabs defaultValue={wordErrors.length > 0 ? "words" : "phonemes"}>
						<TabsList className="mb-4 grid w-full grid-cols-2">
							<TabsTrigger value="words" disabled={wordErrors.length === 0}>
								Words ({wordErrors.length})
							</TabsTrigger>
							<TabsTrigger
								value="phonemes"
								disabled={phonemeErrors.length === 0}
							>
								Phonemes ({phonemeErrors.length})
							</TabsTrigger>
						</TabsList>
						<TabsContent value="words" className="space-y-2">
							{wordErrors.map((error) => (
								<ErrorItem
									key={error.id}
									error={error}
									type="word"
									audioSrc={audioSrc}
									onPlaySegment={onPlaySegment}
								/>
							))}
						</TabsContent>
						<TabsContent value="phonemes" className="space-y-2">
							{phonemeErrors.map((error) => (
								<ErrorItem
									key={error.id}
									error={error}
									type="phoneme"
									audioSrc={audioSrc}
									onPlaySegment={onPlaySegment}
								/>
							))}
						</TabsContent>
					</Tabs>
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Loading state
function AnalysisSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="xl">
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

// Main Page
function AnalysisPage() {
	const { analysis, userRecording, phonemeErrors, wordErrors, textId } =
		Route.useLoaderData();
	const navigate = useNavigate();
	const [activeSegment, setActiveSegment] = useState<{
		start: number;
		end: number;
	} | null>(null);

	const audioSrc = userRecording
		? `/api/audio/user/${userRecording.id}`
		: undefined;

	const handlePlaySegment = useCallback((startMs: number, endMs: number) => {
		setActiveSegment({ start: startMs, end: endMs });
	}, []);

	// Compute error markers for the audio player timeline
	// Only phoneme errors have timestamp fields in the schema
	const errorMarkers: ErrorMarker[] = useMemo(() => {
		const markers: ErrorMarker[] = [];

		phonemeErrors?.forEach((error) => {
			if (error.timestampStartMs != null && error.timestampEndMs != null) {
				markers.push({
					startMs: error.timestampStartMs,
					endMs: error.timestampEndMs,
					type: error.errorType,
				});
			}
		});

		// Sort by start time
		return markers.sort((a, b) => a.startMs - b.startMs);
	}, [phonemeErrors]);

	if (!analysis) {
		return (
			<MainLayout>
				<PageContainer maxWidth="xl">
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
			<PageContainer maxWidth="xl">
				<div className="space-y-8">
					{/* Header */}
					<motion.div
						className="flex items-center gap-4"
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.3 }}
					>
						<Button variant="ghost" size="icon" asChild>
							<Link to="/practice/$textId" params={{ textId }}>
								<ArrowLeft size={18} />
							</Link>
						</Button>
						<div className="space-y-1">
							<h1 className="bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-transparent text-xl tracking-tight md:text-2xl">
								Analysis Results
							</h1>
							<p className="text-muted-foreground text-sm">
								Review your pronunciation analysis
							</p>
						</div>
					</motion.div>

					{/* User Recording Player */}
					{userRecording && (
						<RecordingPlayer
							recordingId={userRecording.id}
							durationMs={userRecording.durationMs ?? undefined}
							errorMarkers={errorMarkers}
							onSeekToError={handlePlaySegment}
						/>
					)}

					{/* Active Segment Player */}
					{activeSegment && audioSrc && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
						>
							<SegmentPlayer
								src={audioSrc}
								startMs={activeSegment.start}
								endMs={activeSegment.end}
								label="Playing selected segment"
								defaultSpeed={0.75}
							/>
						</motion.div>
					)}

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

					{/* Comparisons - stacked vertically for better readability */}
					<motion.div
						className="flex flex-col gap-8"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.15 }}
					>
						{analysis.targetWords && analysis.recognizedWords && (
							<DiffViewer
								target={analysis.targetWords}
								recognized={analysis.recognizedWords}
								errors={wordErrors ?? []}
								type="word"
								audioSrc={audioSrc}
								onSegmentClick={handlePlaySegment}
							/>
						)}
						{analysis.targetPhonemes && analysis.recognizedPhonemes && (
							<DiffViewer
								target={analysis.targetPhonemes}
								recognized={analysis.recognizedPhonemes}
								errors={phonemeErrors ?? []}
								type="phoneme"
								audioSrc={audioSrc}
								onSegmentClick={handlePlaySegment}
							/>
						)}
					</motion.div>

					{/* Error List */}
					<ErrorList
						phonemeErrors={phonemeErrors ?? []}
						wordErrors={wordErrors ?? []}
						audioSrc={audioSrc}
						onPlaySegment={handlePlaySegment}
					/>

					{/* Actions */}
					<motion.div
						className="flex flex-col justify-center gap-3 sm:flex-row"
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4, delay: 0.3 }}
					>
						<Button size="lg" asChild>
							<Link to="/practice/$textId" params={{ textId }}>
								Practice Again
							</Link>
						</Button>
						<Button variant="outline" size="lg" asChild>
							<Link to="/summary">View All Attempts</Link>
						</Button>
					</motion.div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
