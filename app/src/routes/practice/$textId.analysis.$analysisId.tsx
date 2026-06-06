import { useUser } from "@clerk/tanstack-react-start";
import {
	RiAlertLine,
	RiArrowDownSLine,
	RiArrowLeftLine,
	RiErrorWarningLine,
	RiMicOffLine,
	RiPlayLine,
	RiQuestionLine,
	RiTimeLine,
	RiVolumeDownLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { DiffViewer } from "@/components/diff-viewer";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Spinner } from "@/components/ui/spinner";
import {
	type ErrorRegion,
	type PhoneRegion,
	WaveformPlayer,
} from "@/components/ui/waveform-player";
import type {
	Analysis,
	AudioQualityMetrics,
	Author,
	PhonemeError,
	PracticeText,
	ReferenceSpeech,
	UserRecording,
	WordError,
} from "@/db/types";
import type { ApiResponse } from "@/lib/errors";
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
	audioQualityMetrics: AudioQualityMetrics | null;
	reference: ReferenceSpeech | null;
	text: PracticeText | null;
	author: Author | null;
	phonemeErrors: PhonemeError[];
	wordErrors: WordError[];
	previousAttempts: PreviousAttempt[];
	textId: string;
	jobSubmitted: boolean;
};

export const Route = createFileRoute("/practice/$textId/analysis/$analysisId")({
	component: AnalysisPage,
	loader: async ({ params }): Promise<AnalysisLoaderData> => {
		try {
			// serverGetAnalysisDetails now handles auth and ownership verification
			const response = (await serverGetAnalysisDetails({
				data: { analysisId: params.analysisId },
			})) as ApiResponse<{
				analysis: Analysis;
				userRecording: UserRecording | null;
				audioQualityMetrics: AudioQualityMetrics | null;
				reference: ReferenceSpeech | null;
				author: Author | null;
				phonemeErrors: PhonemeError[];
				wordErrors: WordError[];
				assessmentJob: { id: string; status: string } | null;
			} | null>;

			// If auth failed or access denied, return empty data
			if (!response.success) {
				if (
					response.error.statusCode === 401 ||
					response.error.statusCode === 403
				) {
					return {
						analysis: null,
						userRecording: null,
						audioQualityMetrics: null,
						reference: null,
						text: null,
						author: null,
						phonemeErrors: [],
						wordErrors: [],
						previousAttempts: [],
						textId: params.textId,
						jobSubmitted: false,
					};
				}
			}

			if (!response.success || !response.data) {
				return {
					analysis: null,
					userRecording: null,
					audioQualityMetrics: null,
					reference: null,
					text: null,
					author: null,
					phonemeErrors: [],
					wordErrors: [],
					previousAttempts: [],
					textId: params.textId,
					jobSubmitted: false,
				};
			}

			const {
				analysis,
				userRecording,
				audioQualityMetrics,
				reference,
				author,
				phonemeErrors,
				wordErrors,
				assessmentJob,
			} = response.data;

			const mockPreviousAttempts: PreviousAttempt[] = [];

			return {
				analysis,
				userRecording,
				audioQualityMetrics,
				reference,
				text: null,
				author,
				phonemeErrors,
				wordErrors,
				previousAttempts: mockPreviousAttempts,
				textId: params.textId,
				jobSubmitted: assessmentJob !== null,
			};
		} catch (error) {
			console.error("Loader error in analysis route:", error);
			// Return safe fallback to prevent SSR stream from closing
			return {
				analysis: null,
				userRecording: null,
				audioQualityMetrics: null,
				reference: null,
				text: null,
				author: null,
				phonemeErrors: [],
				wordErrors: [],
				previousAttempts: [],
				textId: params.textId,
				jobSubmitted: false,
			};
		}
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
					<title>Score Percentage</title>
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

// Score Overview with animation
interface ScoreOverviewProps {
	overallScore: number;
	phonemeScore: number | null;
}

function ScoreOverview({ overallScore, phonemeScore }: ScoreOverviewProps) {
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
			<Card className="overflow-hidden border-0">
				<CardHeader className="flex flex-row items-center justify-between pb-2">
					<CardTitle className="text-base">Score Overview</CardTitle>
					<Badge
						variant="secondary"
						className={cn(
							"font-medium",
							`${scoreColorVariants({ level })
								.replace("text-", "bg-")
								.replace("dark:text-", "dark:bg-")
								.replace("600", "500/15")
								.replace("500", "500/15")
								.replace("400", "500/25")}text-foreground`, // Hacky color mapping, ideally use separate variants
							level === "high" &&
								"bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
							level === "medium" &&
								"bg-amber-500/15 text-amber-700 dark:text-amber-400",
							level === "low" && "bg-red-500/15 text-red-700 dark:text-red-400",
						)}
					>
						{getScoreLabel(percentage)}
					</Badge>
				</CardHeader>
				<CardContent className="px-4 py-6">
					<div className="flex flex-col items-center gap-8">
						<ScoreRing score={overallScore} size="xl" label="Overall Score" />

						{phonemeScore !== null && (
							<div className="flex w-full justify-center border-border/40 border-t pt-6">
								<ScoreRing
									score={phonemeScore}
									size="md"
									label="Phoneme Accuracy"
								/>
							</div>
						)}
					</div>
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Enhanced Error Item with Collapsible Details
interface ErrorItemProps {
	error: PhonemeError | WordError;
	type: "phoneme" | "word";
	audioSrc?: string;
	onPlaySegment?: (startMs: number, endMs: number) => void;
}

function ErrorItem({ error, type, audioSrc, onPlaySegment }: ErrorItemProps) {
	const [isOpen, setIsOpen] = useState(false);
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

	const formatTimestampFull = (ms: number) => {
		const seconds = Math.floor(ms / 1000);
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		const millis = Math.floor((ms % 1000) / 10);
		return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
	};

	return (
		<Collapsible open={isOpen} onOpenChange={setIsOpen}>
			<motion.div
				className={cn(
					"rounded-xl border transition-colors",
					error.errorType === "substitute" &&
						"border-destructive/20 bg-destructive/5 hover:bg-destructive/10",
					error.errorType === "insert" &&
						"border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10",
					error.errorType === "delete" &&
						"border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10",
				)}
				initial={{ opacity: 0, x: -10 }}
				animate={{ opacity: 1, x: 0 }}
				transition={{ duration: 0.2 }}
			>
				<CollapsibleTrigger asChild>
					<button
						type="button"
						className="flex w-full items-center gap-3 p-4 text-left"
					>
						{/* Error type badge */}
						<Badge
							variant="outline"
							className={cn(
								"shrink-0 capitalize",
								error.errorType === "substitute" &&
									"border-destructive/50 text-destructive",
								error.errorType === "insert" &&
									"border-emerald-500/50 text-emerald-600 dark:text-emerald-400",
								error.errorType === "delete" &&
									"border-amber-500/50 text-amber-600 dark:text-amber-400",
							)}
						>
							{error.errorType}
						</Badge>

						{/* Expected vs Actual */}
						<div className="flex flex-1 items-center gap-2">
							{type === "phoneme" ? (
								<>
									<span className="font-ipa font-medium text-sm">
										{error.expected ?? " "}
									</span>
									<span className="text-muted-foreground">→</span>
									<span
										className={cn(
											"font-ipa text-sm",
											error.errorType === "substitute" && "text-destructive",
											error.errorType === "insert" &&
												"text-emerald-600 dark:text-emerald-400",
											error.errorType === "delete" &&
												"text-amber-600 dark:text-amber-400",
										)}
									>
										{error.actual ?? "∅"}
									</span>
								</>
							) : (
								<>
									<span className="font-medium text-sm">
										"{error.expected ?? "—"}"
									</span>
									<span className="text-muted-foreground">→</span>
									<span
										className={cn(
											"text-sm",
											error.errorType === "substitute" && "text-destructive",
											error.errorType === "insert" &&
												"text-emerald-600 dark:text-emerald-400",
											error.errorType === "delete" &&
												"text-amber-600 dark:text-amber-400",
										)}
									>
										"{error.actual ?? "—"}"
									</span>
								</>
							)}
						</div>

						{/* Timestamp badge */}
						{hasTimestamps &&
							error.timestampStartMs != null &&
							error.timestampEndMs != null && (
								<Badge
									variant="secondary"
									className="shrink-0 gap-1 font-mono text-xs"
								>
									<RiTimeLine size={10} />
									{formatTimestamp(error.timestampStartMs)}
								</Badge>
							)}

						{/* Play button */}
						{audioSrc &&
							hasTimestamps &&
							onPlaySegment &&
							error.timestampStartMs != null &&
							error.timestampEndMs != null && (
								<Button
									variant="ghost"
									size="icon"
									className="size-8 shrink-0"
									onClick={(e) => {
										e.stopPropagation();
										onPlaySegment(
											error.timestampStartMs ?? 0,
											error.timestampEndMs ?? 0,
										);
									}}
								>
									<RiPlayLine size={14} />
								</Button>
							)}

						{/* Collapse icon */}
						<RiArrowDownSLine
							size={16}
							className={cn(
								"shrink-0 text-muted-foreground transition-transform",
								isOpen && "rotate-180",
							)}
						/>
					</button>
				</CollapsibleTrigger>

				<CollapsibleContent>
					<div className="flex flex-col gap-3 border-t px-4 pt-3 pb-4">
						{/* Detailed timestamp */}
						{hasTimestamps &&
							error.timestampStartMs != null &&
							error.timestampEndMs != null && (
								<div className="flex items-center gap-2">
									<span className="text-muted-foreground text-xs">Time:</span>
									<span className="font-mono text-xs tabular-nums">
										{formatTimestampFull(error.timestampStartMs)} -{" "}
										{formatTimestampFull(error.timestampEndMs)}
									</span>
									<span className="text-muted-foreground text-xs">
										(
										{(
											(error.timestampEndMs - error.timestampStartMs) /
											1000
										).toFixed(2)}
										s)
									</span>
								</div>
							)}

						{/* Additional details */}
						<div className="flex flex-col gap-2">
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground text-xs">Expected:</span>
								{type === "phoneme" ? (
									<span className="font-ipa text-lg">
										{error.expected ?? "∅"}
									</span>
								) : (
									<span className="text-xs">"{error.expected ?? "—"}"</span>
								)}
							</div>
							<div className="flex items-center gap-2">
								<span className="text-muted-foreground text-xs">Actual:</span>
								{type === "phoneme" ? (
									<span
										className={cn(
											"font-ipa text-lg",
											error.errorType === "substitute" && "text-destructive",
											error.errorType === "insert" &&
												"text-emerald-600 dark:text-emerald-400",
											error.errorType === "delete" &&
												"text-amber-600 dark:text-amber-400",
										)}
									>
										{error.actual ?? "∅"}
									</span>
								) : (
									<span
										className={cn(
											"text-xs",
											error.errorType === "substitute" && "text-destructive",
											error.errorType === "insert" &&
												"text-emerald-600 dark:text-emerald-400",
											error.errorType === "delete" &&
												"text-amber-600 dark:text-amber-400",
										)}
									>
										"{error.actual ?? "—"}"
									</span>
								)}
							</div>
						</div>
					</div>
				</CollapsibleContent>
			</motion.div>
		</Collapsible>
	);
}

// Phone-level error list. (V2 is aligner-only — the ASR word-error path was
// dropped, so this is phonemes-only.)
interface ErrorListProps {
	phonemeErrors: PhonemeError[];
	audioSrc?: string;
	onPlaySegment?: (startMs: number, endMs: number) => void;
	// Only celebrate "Perfect Pronunciation" when the result is genuinely a
	// high-scoring, content-matched recognition — not merely "zero error rows"
	// (which a half-written / abstained row could momentarily look like).
	perfectEligible?: boolean;
}

function ErrorList({
	phonemeErrors,
	audioSrc,
	onPlaySegment,
	perfectEligible = false,
}: ErrorListProps) {
	const totalErrors = phonemeErrors.length;

	if (totalErrors === 0) {
		if (perfectEligible) {
			return (
				<motion.div
					initial={{ opacity: 0, scale: 0.95 }}
					animate={{ opacity: 1, scale: 1 }}
					transition={{ duration: 0.3, delay: 0.3 }}
				>
					<Card className="overflow-hidden border-0 bg-linear-to-br from-emerald-500/5 via-background to-emerald-500/10">
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
		// Zero error rows but not a clean high-confidence result — show a neutral
		// completion state rather than a misleading celebration.
		return (
			<motion.div
				initial={{ opacity: 0, scale: 0.95 }}
				animate={{ opacity: 1, scale: 1 }}
				transition={{ duration: 0.3, delay: 0.3 }}
			>
				<Card className="overflow-hidden border-0">
					<CardContent className="py-10">
						<div className="flex flex-col items-center gap-2 text-center">
							<h3 className="font-medium text-base">Analysis complete</h3>
							<p className="text-muted-foreground text-sm">
								No phone-level errors were flagged for this recording.
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
			<Card className="overflow-hidden border-0">
				<CardHeader className="pb-3">
					<CardTitle className="flex items-center justify-between text-base">
						<span>Error Details</span>
						<Badge variant="secondary" className="font-mono">
							{totalErrors} {totalErrors === 1 ? "error" : "errors"}
						</Badge>
					</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-2">
					{phonemeErrors.map((error) => (
						<ErrorItem
							key={error.id}
							error={error}
							type="phoneme"
							audioSrc={audioSrc}
							onPlaySegment={onPlaySegment}
						/>
					))}
				</CardContent>
			</Card>
		</motion.div>
	);
}

// Banner shown when the worker abstained from scoring (#38). Replaces the score
// rings + diff + error list; the recording playback stays so the user can hear
// what was captured.
interface AbstentionContent {
	icon: typeof RiAlertLine;
	title: string;
	description: string;
}

function abstentionContent(
	reason: string,
	snrDb?: number | null,
): AbstentionContent {
	switch (reason) {
		case "no_speech":
			return {
				icon: RiMicOffLine,
				title: "No speech detected",
				description:
					"We couldn't hear any speech in this recording. Check your microphone and try again.",
			};
		case "low_audio_quality":
			return {
				icon: RiVolumeDownLine,
				title: "Recording too noisy",
				description: `The audio quality was too low to analyze${
					snrDb != null ? ` (${snrDb} dB signal-to-noise)` : ""
				}. Move somewhere quieter and record again.`,
			};
		case "duration_out_of_range":
			return {
				icon: RiTimeLine,
				title: "Recording length out of range",
				description:
					"Recordings need to be between about half a second and 25 seconds. Please record again.",
			};
		case "wrong_sentence":
			return {
				icon: RiErrorWarningLine,
				title: "That didn't match the sentence",
				description:
					"What we heard didn't match the sentence we asked you to read. Make sure you're reading the prompt, then record again.",
			};
		case "uncertain":
			return {
				icon: RiQuestionLine,
				title: "Couldn't analyze confidently",
				description:
					"The model wasn't confident about this recording. Try recording again, speaking clearly.",
			};
		default:
			return {
				icon: RiAlertLine,
				title: "We couldn't score this recording",
				description:
					"Something about this recording prevented analysis. Please record again.",
			};
	}
}

function AbstentionBanner({
	reason,
	snrDb,
	textId,
}: {
	reason: string;
	snrDb?: number | null;
	textId: string;
}) {
	const { icon: Icon, title, description } = abstentionContent(reason, snrDb);
	return (
		<motion.div
			initial={{ opacity: 0, scale: 0.97 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ duration: 0.3, delay: 0.1 }}
		>
			<Card className="overflow-hidden border-0 bg-linear-to-br from-amber-500/5 via-background to-amber-500/10">
				<CardContent className="py-10">
					<div className="flex flex-col items-center gap-4 text-center">
						<div className="flex size-14 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
							<Icon size={26} />
						</div>
						<div className="space-y-1.5">
							<h3 className="font-semibold text-lg">{title}</h3>
							<p className="mx-auto max-w-md text-muted-foreground text-sm">
								{description}
							</p>
						</div>
						<Button asChild className="mt-2">
							<Link to="/practice/$textId" params={{ textId }}>
								Record again
							</Link>
						</Button>
					</div>
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
	const {
		analysis: initialAnalysis,
		userRecording,
		phonemeErrors: initialLoaderPhonemeErrors,
		textId,
		reference,
		author,
		audioQualityMetrics: initialQualityMetrics,
		jobSubmitted: initialJobSubmitted,
	} = Route.useLoaderData();
	const navigate = useNavigate();
	const { user } = useUser();
	// A clicked phone/error to replay in-context on the "Your Recording"
	// waveform. `nonce` lets the same segment be replayed on repeat clicks.
	const [playRegion, setPlayRegion] = useState<{
		startMs: number;
		endMs: number;
		nonce: number;
	} | null>(null);

	// Poll for analysis status updates if analysis is pending or processing
	const analysisId = initialAnalysis?.id;
	const shouldPoll =
		initialAnalysis &&
		(initialAnalysis.status === "pending" ||
			initialAnalysis.status === "processing");

	const [isPollingTimedOut, setIsPollingTimedOut] = useState(false);

	// Timeout polling after 1 minute
	useEffect(() => {
		if (shouldPoll && !isPollingTimedOut) {
			const timer = setTimeout(() => {
				setIsPollingTimedOut(true);
			}, 60000); // 1 minute
			return () => clearTimeout(timer);
		}
	}, [shouldPoll, isPollingTimedOut]);

	const { data: polledData } = useQuery({
		queryKey: ["analysis", analysisId],
		queryFn: async () => {
			if (!analysisId) return null;
			const response = (await serverGetAnalysisDetails({
				data: { analysisId },
			})) as ApiResponse<{
				analysis: Analysis;
				userRecording: UserRecording | null;
				audioQualityMetrics: AudioQualityMetrics | null;
				phonemeErrors: PhonemeError[];
				wordErrors: WordError[];
			} | null>;
			return response.success && response.data ? response.data : null;
		},
		enabled: (shouldPoll && !isPollingTimedOut) ?? false,
		refetchInterval: shouldPoll && !isPollingTimedOut ? 5000 : false, // Poll every 5 seconds
	});

	// Use polled data if available, otherwise use initial loader data
	const analysis = polledData?.analysis ?? initialAnalysis;
	const qualityMetrics =
		polledData?.audioQualityMetrics ?? initialQualityMetrics;
	const phonemeErrors = polledData?.phonemeErrors ?? initialLoaderPhonemeErrors;

	const audioSrc = userRecording
		? `/api/audio/user/${userRecording.id}`
		: undefined;

	const handlePlaySegment = useCallback((startMs: number, endMs: number) => {
		setPlayRegion((prev) => ({
			startMs,
			endMs,
			nonce: (prev?.nonce ?? 0) + 1,
		}));
	}, []);

	// Compute error regions for the waveform player (in seconds)
	const errorRegions: ErrorRegion[] = useMemo(() => {
		const regions: ErrorRegion[] = [];

		phonemeErrors?.forEach((error) => {
			if (error.timestampStartMs != null && error.timestampEndMs != null) {
				regions.push({
					start: error.timestampStartMs / 1000,
					end: error.timestampEndMs / 1000,
					type: error.errorType,
					label: error.actual ?? undefined,
				});
			}
		});

		// Sort by start time
		return regions.sort((a, b) => a.start - b.start);
	}, [phonemeErrors]);

	// Reference audio phone timeline (precomputed CTC timings) — display-only
	// overlay on the reference waveform. Skip the "▁" word-boundary marker.
	const referencePhoneRegions: PhoneRegion[] = useMemo(() => {
		const timings = reference?.phoneTimingsJson;
		if (!timings) return [];
		return timings
			.filter((p) => p.token !== "▁")
			.map((p) => ({
				start: p.start_ms / 1000,
				end: p.end_ms / 1000,
				label: p.token,
			}));
	}, [reference]);

	// Recognized (user) phone timeline — same overlay + live readout as the
	// reference, sourced from what POWSM heard in the user's recording.
	const userPhoneRegions: PhoneRegion[] = useMemo(() => {
		const timings = analysis?.recognizedPhoneTimingsJson;
		if (!timings) return [];
		return timings
			.filter((p) => p.token !== "▁")
			.map((p) => ({
				start: p.start_ms / 1000,
				end: p.end_ms / 1000,
				label: p.token,
			}));
	}, [analysis]);

	const referenceLabel = author
		? `Reference · ${author.name}${author.accent ? ` · ${author.accent}` : ""}`
		: "Reference Audio";
	const userLabel = user?.firstName
		? `${user.firstName}'s recording`
		: "Your recording";

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

	// Show loading state if analysis is pending or processing
	if (analysis.status === "pending" || analysis.status === "processing") {
		// Check if job was actually submitted to RunPod
		const jobSubmitted = initialJobSubmitted;
		const isPending = analysis.status === "pending";

		return (
			<MainLayout>
				<PageContainer maxWidth="xl">
					<div className="flex flex-col gap-6">
						{/* Header */}
						<motion.div
							className="flex items-center gap-4"
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.3 }}
						>
							<Button variant="ghost" size="icon" asChild>
								<Link to="/practice/$textId" params={{ textId }}>
									<RiArrowLeftLine size={18} />
								</Link>
							</Button>
							<div className="space-y-1">
								<h1 className="bg-linear-to-r from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-transparent text-xl tracking-tight md:text-2xl">
									{isPending && !jobSubmitted
										? "Your recording is saved"
										: "We're analyzing your speech"}
								</h1>
							</div>
						</motion.div>

						{/* Loading Card */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4 }}
						>
							<Card
								className={
									isPollingTimedOut || (isPending && !jobSubmitted)
										? "border-amber-500/20"
										: undefined
								}
							>
								<CardContent className="flex flex-col items-center justify-center gap-4 py-12">
									{isPollingTimedOut ? (
										<div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
											<RiTimeLine size={24} />
										</div>
									) : jobSubmitted ? (
										<Spinner className="size-8" />
									) : (
										<div className="flex size-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
											<RiTimeLine size={24} />
										</div>
									)}
									<div className="flex flex-col items-center gap-2 text-center">
										<h3 className="font-semibold text-lg">
											{isPollingTimedOut
												? "This is taking longer than expected"
												: isPending && !jobSubmitted
													? "Waiting to Start"
													: isPending
														? "Queued for Processing"
														: "Processing Your Recording"}
										</h3>
										<p className="max-w-md text-muted-foreground text-sm">
											{isPollingTimedOut
												? "Your recording is still being processed. It's saved, so you can refresh to check again or come back later."
												: isPending && !jobSubmitted
													? "The AI service is not currently available. Your recording is saved and will be analyzed when the service comes online."
													: isPending
														? "Your recording is in the queue and will be processed shortly."
														: "Analyzing your pronunciation. This usually takes 5-10 seconds."}
										</p>
									</div>
									{isPollingTimedOut && (
										<div className="flex flex-col gap-3 pt-2 sm:flex-row">
											<Button
												onClick={() => {
													setIsPollingTimedOut(false);
													window.location.reload();
												}}
											>
												Refresh
											</Button>
											<Button variant="outline" asChild>
												<Link to="/practice/$textId" params={{ textId }}>
													Back to practice
												</Link>
											</Button>
										</div>
									)}
								</CardContent>
							</Card>
						</motion.div>

						{/* Show recording while processing */}
						{/* Audio Players (Reference + User) */}
						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							{reference && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4, delay: 0.1 }}
								>
									<WaveformPlayer
										src={`/api/audio/${reference.id}`}
										label="Reference Audio"
									/>
								</motion.div>
							)}
							{userRecording && (
								<motion.div
									initial={{ opacity: 0, y: 20 }}
									animate={{ opacity: 1, y: 0 }}
									transition={{ duration: 0.4, delay: 0.2 }}
								>
									<WaveformPlayer
										src={`/api/audio/user/${userRecording.id}`}
										label="Your Recording"
									/>
								</motion.div>
							)}
						</div>
					</div>
				</PageContainer>
			</MainLayout>
		);
	}

	// Show error state if analysis failed
	if (analysis.status === "failed") {
		return (
			<MainLayout>
				<PageContainer maxWidth="xl">
					<div className="flex flex-col gap-6">
						{/* Header */}
						<motion.div
							className="flex items-center gap-4"
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.3 }}
						>
							<Button variant="ghost" size="icon" asChild>
								<Link to="/practice/$textId" params={{ textId }}>
									<RiArrowLeftLine size={18} />
								</Link>
							</Button>
							<div className="space-y-1">
								<h1 className="bg-linear-to-r from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-transparent text-xl tracking-tight md:text-2xl">
									Analysis Failed
								</h1>
								<p className="text-muted-foreground text-sm">
									Unable to process your recording
								</p>
							</div>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.4 }}
						>
							<Card className="border-destructive/20 bg-destructive/5">
								<CardContent className="flex flex-col items-center justify-center gap-4 py-12">
									<div className="flex flex-col items-center gap-2 text-center">
										<h3 className="font-semibold text-destructive text-lg">
											Analysis Failed
										</h3>
										<p className="max-w-md text-muted-foreground text-sm">
											We encountered an error while processing your recording.
											Please try recording again.
										</p>
										<Button
											onClick={() =>
												navigate({
													to: "/practice/$textId",
													params: { textId },
												})
											}
											className="mt-4"
										>
											Try Again
										</Button>
									</div>
								</CardContent>
							</Card>
						</motion.div>
					</div>
				</PageContainer>
			</MainLayout>
		);
	}

	return (
		<MainLayout>
			<PageContainer maxWidth="xl">
				<div className="flex flex-col gap-6">
					{/* Header */}
					<motion.div
						className="flex items-center gap-4"
						initial={{ opacity: 0, x: -20 }}
						animate={{ opacity: 1, x: 0 }}
						transition={{ duration: 0.3 }}
					>
						<Button variant="ghost" size="icon" asChild>
							<Link to="/practice/$textId" params={{ textId }}>
								<RiArrowLeftLine size={18} />
							</Link>
						</Button>
						<div className="space-y-1">
							<h1 className="bg-linear-to-r from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-transparent text-xl tracking-tight md:text-2xl">
								Analysis Results
							</h1>
							<p className="text-muted-foreground text-sm">
								Review your pronunciation analysis
							</p>
						</div>
					</motion.div>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={{ opacity: 1, y: 0 }}
						transition={{ duration: 0.4 }}
					>
						{qualityMetrics && qualityMetrics.qualityStatus !== "accept" && (
							<Alert variant={"default"} className="mb-6">
								<RiAlertLine size={16} className="text-muted" />
								<AlertTitle>Recording quality issues detected</AlertTitle>
								<AlertDescription>
									<ul className="">
										{<li>Results might not be accurate.</li>}
										{Number(qualityMetrics.snrDb) < 15 && (
											<li>High background noise: {qualityMetrics.snrDb}dB</li>
										)}
										{Number(qualityMetrics.silenceRatio) > 0.75 && (
											<li>
												Too much silence:{" "}
												{Number(qualityMetrics.silenceRatio) * 100}% of the
												recording.
											</li>
										)}
										{Number(qualityMetrics.clippingRatio) > 0.01 && (
											<li>
												Audio distortion (clipping) detected:{" "}
												{qualityMetrics.clippingRatio} clipping ratio
											</li>
										)}
										{qualityMetrics.qualityStatus === "reject" && (
											<li className="text-sm">
												Recording quality is too low for an accurate analysis
											</li>
										)}
									</ul>
								</AlertDescription>
							</Alert>
						)}

						<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
							{reference && (
								<WaveformPlayer
									src={`/api/audio/${reference.id}`}
									label={referenceLabel}
									phoneRegions={referencePhoneRegions}
								/>
							)}
							<WaveformPlayer
								src={`/api/audio/user/${userRecording?.id ?? ""}`}
								label={userLabel}
								phoneRegions={userPhoneRegions}
								errorRegions={errorRegions}
								playRegion={playRegion ?? undefined}
							/>
						</div>
					</motion.div>

					{analysis.abstentionReason ? (
						/* Non-happy path: show a banner instead of a (misleading) score. */
						<AbstentionBanner
							reason={analysis.abstentionReason}
							snrDb={
								qualityMetrics?.snrDb != null
									? Number(qualityMetrics.snrDb)
									: null
							}
							textId={textId}
						/>
					) : (
						<>
							{/* Score Overview */}
							<ScoreOverview
								overallScore={Number(analysis.overallScore)}
								phonemeScore={
									analysis.phonemeScore !== null
										? Number(analysis.phonemeScore)
										: null
								}
							/>

							{/* Comparisons - stacked vertically for better readability */}
							<motion.div
								className="flex flex-col gap-6"
								initial={{ opacity: 0, y: 20 }}
								animate={{ opacity: 1, y: 0 }}
								transition={{ duration: 0.4, delay: 0.15 }}
							>
								{/* Shared Legend */}
								{phonemeErrors?.length > 0 && (
									<div className="flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
										<span className="text-muted-foreground/70">Legend:</span>
										<span className="flex items-center gap-1">
											<span className="size-1.5 rounded-full bg-destructive/60" />
											Substitution
										</span>
										<span className="flex items-center gap-1">
											<span className="size-1.5 rounded-full bg-emerald-500/60" />
											Insertion
										</span>
										<span className="flex items-center gap-1">
											<span className="size-1.5 rounded-full bg-amber-500/60" />
											Deletion
										</span>
									</div>
								)}

								{analysis.targetPhonemes && (
									<DiffViewer
										target={analysis.targetPhonemes}
										recognized={analysis.recognizedPhonemes || ""}
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
								audioSrc={audioSrc}
								onPlaySegment={handlePlaySegment}
								perfectEligible={
									Number(analysis.overallScore) >= 0.95 &&
									!!analysis.recognizedPhonemes
								}
							/>
						</>
					)}

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
