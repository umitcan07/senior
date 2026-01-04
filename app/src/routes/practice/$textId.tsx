import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useNavigate,
} from "@tanstack/react-router";
import {
	AlertCircle,
	ArrowLeft,
	Check,
	ChevronDown,
	Mic,
	RotateCcw,
	Square,
	Volume2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import {
	AudioPlayerButton,
	AudioPlayerDuration,
	AudioPlayerProgress,
	AudioPlayerProvider,
	AudioPlayerSpeed,
	AudioPlayerTime,
} from "@/components/ui/audio-player";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger } from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { Progress } from "@/components/ui/progress";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import type { Author, ReferenceSpeech } from "@/db/types";
import { formatDuration, serverGetReferencesForText } from "@/lib/reference";
import { getScoreLevel, scoreColorVariants } from "@/lib/score";
import { serverGetPracticeTextById } from "@/lib/text";
import { cn, formatRelativeTime } from "@/lib/utils";

export const Route = createFileRoute("/practice/$textId")({
	component: PracticeTextLayout,
	loader: async ({ params }) => {
		const textResult = await serverGetPracticeTextById({
			data: { id: params.textId },
		});

		if (!textResult.success || !textResult.data) {
			return {
				text: null,
				references: [],
				recentAttempts: [],
			};
		}

		const referencesResult = await serverGetReferencesForText({
			data: { textId: params.textId },
		});

		const references =
			referencesResult.success && referencesResult.data
				? referencesResult.data.map((ref) => ({
						...ref,
						author: ref.author,
					}))
				: [];

		return {
			text: textResult.data,
			references,
			recentAttempts: [], // TODO: Implement when user recordings/analyses are available
		};
	},
	pendingComponent: TextDetailSkeleton,
});

// Recording state and logic
type RecordingState =
	| "idle"
	| "recording"
	| "processing"
	| "preview"
	| "uploading"
	| "analyzing";

function useRecording(textId: string) {
	const [state, setState] = useState<RecordingState>("idle");
	const [recordingTime, setRecordingTime] = useState(0);
	const [uploadProgress, setUploadProgress] = useState(0);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
	const [error, setError] = useState<string | null>(null);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const navigate = useNavigate();

	const audioPreviewUrl = useMemo(() => {
		if (!audioBlob) return null;
		return URL.createObjectURL(audioBlob);
	}, [audioBlob]);

	useEffect(() => {
		return () => {
			if (audioPreviewUrl) {
				URL.revokeObjectURL(audioPreviewUrl);
			}
		};
	}, [audioPreviewUrl]);

	const startRecording = useCallback(async () => {
		try {
			setError(null);
			chunksRef.current = [];
			setAudioBlob(null);
			setState("recording");
			setRecordingTime(0);

			timerRef.current = setInterval(() => {
				setRecordingTime((t) => {
					if (t >= 59) {
						stopRecording();
						return 60;
					}
					return t + 1;
				});
			}, 1000);
		} catch (err) {
			setError(
				err instanceof Error ? err.message : "Failed to start recording",
			);
			setState("idle");
		}
	}, []);

	const stopRecording = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}

		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state !== "inactive"
		) {
			mediaRecorderRef.current.stop();
		}

		if (mediaStream) {
			mediaStream.getTracks().forEach((track) => track.stop());
			setMediaStream(null);
		}

		setState("processing");

		setTimeout(() => {
			if (chunksRef.current.length > 0) {
				const blob = new Blob(chunksRef.current, { type: "audio/webm" });
				setAudioBlob(blob);
			}
			setState("preview");
		}, 500);
	}, [mediaStream]);

	const handleStreamError = useCallback((err: Error) => {
		setError(err.message || "Microphone access denied");
		setState("idle");
	}, []);

	const handleStreamReady = useCallback(
		(stream: MediaStream) => {
			try {
				setMediaStream(stream);
				const mediaRecorder = new MediaRecorder(stream, {
					mimeType: "audio/webm",
				});
				mediaRecorder.ondataavailable = (event) => {
					if (event.data.size > 0) {
						chunksRef.current.push(event.data);
					}
				};
				mediaRecorderRef.current = mediaRecorder;
				mediaRecorder.start(100);
			} catch (err) {
				handleStreamError(
					err instanceof Error ? err : new Error("Failed to start recording"),
				);
			}
		},
		[handleStreamError],
	);

	const handleStreamEnd = useCallback(() => {
		setMediaStream(null);
	}, []);

	const submitRecording = useCallback(() => {
		setState("uploading");
		setUploadProgress(0);
		const interval = setInterval(() => {
			setUploadProgress((p) => {
				if (p >= 100) {
					clearInterval(interval);
					setState("analyzing");
					setTimeout(() => {
						navigate({
							to: "/practice/$textId/analysis/$analysisId",
							params: { textId, analysisId: "analysis-1" },
						});
					}, 2000);
					return 100;
				}
				return p + 10;
			});
		}, 200);
	}, [textId, navigate]);

	const resetRecording = useCallback(() => {
		setState("idle");
		setRecordingTime(0);
		setUploadProgress(0);
		setAudioBlob(null);
		setError(null);
		chunksRef.current = [];
	}, []);

	return {
		state,
		recordingTime,
		uploadProgress,
		audioPreviewUrl,
		error,
		startRecording,
		stopRecording,
		submitRecording,
		resetRecording,
		handleStreamReady,
		handleStreamEnd,
		handleStreamError,
	};
}

function formatTime(seconds: number) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Reference Voice Section - Prominent and emphasized
interface ReferenceVoiceProps {
	references: (ReferenceSpeech & { author: Author })[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}

function ReferenceVoice({
	references,
	selectedId,
	onSelect,
}: ReferenceVoiceProps) {
	const [isOpen, setIsOpen] = useState(false);
	const selectedReference = references.find((ref) => ref.id === selectedId);

	if (references.length === 0) {
		return null;
	}

	return (
		<div className="flex flex-col gap-4">
			{/* Selection area - fixed height to prevent shifts */}
			<div className="flex min-h-18 flex-col gap-3">
				{/* Always visible: selected voice display */}
				{selectedReference ? (
					<div className="flex items-center gap-3 rounded-lg border-2 border-primary/20 bg-primary/5 p-4 transition-colors">
						<div className="flex min-w-0 flex-1 items-center gap-3">
							<div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
								<Volume2 size={18} className="text-primary" />
							</div>
							<div className="min-w-0 flex-1">
								<div className="font-medium text-sm">
									{selectedReference.author.name}
								</div>
								<div className="flex items-center gap-2 text-muted-foreground text-xs">
									<Badge variant="secondary" className="text-xs">
										{selectedReference.author.accent}
									</Badge>
									{selectedReference.durationMs && (
										<span>
											· {formatDuration(selectedReference.durationMs)}
										</span>
									)}
								</div>
							</div>
						</div>
						<Collapsible open={isOpen} onOpenChange={setIsOpen}>
							<CollapsibleTrigger asChild>
								<Button variant="ghost" size="icon" className="size-8">
									<ChevronDown
										size={16}
										className={cn(
											"transition-transform",
											isOpen && "rotate-180",
										)}
									/>
								</Button>
							</CollapsibleTrigger>
						</Collapsible>
					</div>
				) : (
					<Collapsible open={isOpen} onOpenChange={setIsOpen}>
						<CollapsibleTrigger asChild>
							<Button
								variant="outline"
								size="lg"
								className="h-16 w-full justify-between"
							>
								<div className="flex items-center gap-3">
									<Volume2 size={18} />
									<span>Select voice</span>
								</div>
								<ChevronDown
									size={16}
									className={cn("transition-transform", isOpen && "rotate-180")}
								/>
							</Button>
						</CollapsibleTrigger>
					</Collapsible>
				)}

				{/* Expandable options */}
				{isOpen && (
					<div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
						<div className="flex flex-wrap gap-2">
							{references.map((ref) => {
								const isSelected = selectedId === ref.id;
								return (
									<button
										key={ref.id}
										type="button"
										onClick={() => {
											onSelect(ref.id);
											setIsOpen(false);
										}}
										className={cn(
											"group flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all",
											isSelected
												? "border-primary bg-primary/10 text-primary shadow-sm"
												: "border-border hover:border-primary/50 hover:bg-muted/50",
										)}
									>
										{isSelected && <Check size={14} className="text-primary" />}
										<span className="font-medium">{ref.author.name}</span>
										<Badge variant="secondary" className="text-xs">
											{ref.author.accent}
										</Badge>
										{ref.durationMs && (
											<span className="text-muted-foreground text-xs">
												{formatDuration(ref.durationMs)}
											</span>
										)}
									</button>
								);
							})}
						</div>
					</div>
				)}
			</div>

			{/* Audio player - always rendered, fixed height */}
			{selectedReference && (
				<AudioPlayerProvider>
					<div className="flex min-h-16 items-center gap-3 rounded-lg border bg-card p-4">
						<AudioPlayerButton
							item={{
								id: selectedReference.id,
								src: `/api/audio/${selectedReference.id}`,
							}}
							variant="default"
							size="icon"
							className="size-10"
						/>
						<AudioPlayerProgress className="flex-1" />
						<div className="flex items-center gap-2 text-muted-foreground text-xs">
							<AudioPlayerTime />
							<span>/</span>
							<AudioPlayerDuration />
						</div>
						<AudioPlayerSpeed />
					</div>
				</AudioPlayerProvider>
			)}
		</div>
	);
}

// Recent Attempts
interface RecentAttemptsProps {
	attempts: Array<{
		id: string;
		textId: string;
		textPreview: string;
		score: number;
		date: Date;
		analysisId: string;
	}>;
	textId: string;
}

function RecentAttempts({ attempts, textId }: RecentAttemptsProps) {
	if (attempts.length === 0) return null;

	return (
		<div className="flex flex-col gap-3 border-t pt-6">
			<h3 className="font-medium text-muted-foreground text-sm">
				Recent Attempts
			</h3>
			<div className="flex flex-wrap gap-2">
				{attempts.map((attempt) => (
					<Link
						key={attempt.id}
						to="/practice/$textId/analysis/$analysisId"
						params={{ textId, analysisId: attempt.analysisId }}
						className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
					>
						<span
							className={cn(
								"font-medium tabular-nums",
								scoreColorVariants({ level: getScoreLevel(attempt.score) }),
							)}
						>
							{attempt.score}%
						</span>
						<span className="text-muted-foreground text-xs">
							{formatRelativeTime(attempt.date)}
						</span>
					</Link>
				))}
			</div>
		</div>
	);
}

// Loading state
function TextDetailSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="md">
				<div className="flex flex-col gap-8">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="sm" asChild>
							<Link to="/practice" className="gap-2">
								<ArrowLeft size={16} />
								Back
							</Link>
						</Button>
					</div>
					<div className="flex min-h-48 flex-col items-center justify-center rounded-2xl border-2 border-border bg-card p-6 md:p-8">
						<ShimmeringText
							text="Loading practice text..."
							className="text-lg text-muted-foreground"
							duration={1.5}
						/>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// Layout
function PracticeTextLayout() {
	const matches = useMatches();
	const hasChildRoute = matches.some(
		(m) => m.routeId !== Route.id && m.routeId.startsWith(Route.id),
	);

	if (hasChildRoute) {
		return <Outlet />;
	}

	return <PracticeTextPage />;
}

// Main Page
function PracticeTextPage() {
	const { text, references, recentAttempts } = Route.useLoaderData();
	const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
		references[0]?.id ?? null,
	);
	const navigate = useNavigate();
	const recording = useRecording(text?.id ?? "");

	if (!text) {
		return (
			<MainLayout>
				<PageContainer maxWidth="md">
					<EmptyState
						title="Text not found"
						description="This practice text may have been removed or doesn't exist."
						primaryAction={{
							label: "Back to Practice",
							onClick: () => navigate({ to: "/practice" }),
						}}
					/>
				</PageContainer>
			</MainLayout>
		);
	}

	const isRecording = recording.state === "recording";
	const isProcessing = recording.state === "processing";
	const isUploading = recording.state === "uploading";
	const isAnalyzing = recording.state === "analyzing";
	const hasPreview = recording.state === "preview" && recording.audioPreviewUrl;
	const isIdle = recording.state === "idle";

	return (
		<MainLayout>
			<PageContainer maxWidth="md">
				<div className="flex flex-col gap-8">
					{/* Back button */}
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="sm" asChild>
							<Link to="/practice" className="gap-2">
								<ArrowLeft size={16} />
								Back
							</Link>
						</Button>
					</div>

					{/* Main content */}
					<div className="flex flex-col gap-6">
						{/* Reference voice - prominent */}
						<ReferenceVoice
							references={references}
							selectedId={selectedReferenceId}
							onSelect={setSelectedReferenceId}
						/>

						{/* Practice text */}
						<div
							className={cn(
								"rounded-2xl border-2 p-6 transition-all md:p-8",
								isRecording
									? "border-destructive/50 bg-destructive/5 shadow-destructive/10 shadow-lg"
									: "border-border",
							)}
						>
							<p className="font-serif text-xl leading-relaxed md:text-2xl md:leading-relaxed">
								{text.content}
							</p>
						</div>

						{/* Recording section - fixed heights */}
						<div className="flex flex-col gap-4">
							{/* Waveform - fixed height */}
							<div className="h-20 w-full overflow-hidden rounded-lg">
								<LiveWaveform
									active={isRecording}
									processing={isProcessing}
									height={80}
									barWidth={3}
									barGap={2}
									mode="static"
									fadeEdges
									sensitivity={1.5}
									onStreamReady={recording.handleStreamReady}
									onStreamEnd={recording.handleStreamEnd}
								/>
							</div>

							{/* Controls - fixed min-height */}
							<div className="flex min-h-32 flex-col items-center justify-center gap-4">
								<SignedIn>
									{/* Error state */}
									{recording.error && (
										<div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
											<div className="flex items-center gap-2 text-destructive text-sm">
												<AlertCircle size={16} />
												<span className="font-medium">Recording Error</span>
											</div>
											<p className="text-destructive text-xs">
												{recording.error}
											</p>
											<Button
												variant="outline"
												size="sm"
												onClick={recording.resetRecording}
												className="w-full"
											>
												Try Again
											</Button>
										</div>
									)}

									{/* Idle state */}
									{isIdle && !recording.error && (
										<Button
											size="lg"
											onClick={recording.startRecording}
											disabled={!selectedReferenceId}
											className="gap-2"
										>
											<Mic size={18} />
											{selectedReferenceId ? "Record" : "Select voice first"}
										</Button>
									)}

									{/* Recording state */}
									{isRecording && (
										<div className="flex w-full max-w-md flex-col items-center gap-4">
											<div className="flex items-center gap-3">
												<span className="relative flex size-3">
													<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
													<span className="relative inline-flex size-3 rounded-full bg-destructive" />
												</span>
												<span className="font-mono text-2xl tabular-nums">
													{formatTime(recording.recordingTime)}
												</span>
												<span className="text-muted-foreground">/ 1:00</span>
											</div>
											<Button
												variant="destructive"
												size="lg"
												onClick={recording.stopRecording}
												className="gap-2"
											>
												<Square size={16} className="fill-current" />
												Stop
											</Button>
											{recording.recordingTime >= 50 && (
												<p className="text-destructive text-xs">
													Auto-stop at 60s
												</p>
											)}
										</div>
									)}

									{/* Processing state */}
									{isProcessing && (
										<ShimmeringText
											text="Processing..."
											className="text-muted-foreground text-sm"
											duration={1.5}
										/>
									)}

									{/* Preview state */}
									{hasPreview && (
										<div className="flex w-full max-w-md flex-col gap-4">
											<AudioPlayerProvider>
												<div className="flex items-center gap-3 rounded-lg border bg-card p-4">
													<AudioPlayerButton
														item={{
															id: "preview",
															src: recording.audioPreviewUrl!,
														}}
														variant="default"
														size="icon"
														className="size-10"
													/>
													<AudioPlayerProgress className="flex-1" />
													<span className="font-mono text-muted-foreground text-sm tabular-nums">
														{formatTime(recording.recordingTime)}
													</span>
												</div>
											</AudioPlayerProvider>
											<div className="flex gap-3">
												<Button
													variant="outline"
													onClick={recording.resetRecording}
													className="flex-1 gap-2"
												>
													<RotateCcw size={16} />
													Re-record
												</Button>
												<Button
													onClick={recording.submitRecording}
													className="flex-1 gap-2"
												>
													<Check size={16} />
													Submit
												</Button>
											</div>
										</div>
									)}

									{/* Uploading state */}
									{isUploading && (
										<div className="flex w-full max-w-md flex-col gap-3">
											<Progress
												value={recording.uploadProgress}
												className="h-2"
											/>
											<ShimmeringText
												text={`Uploading ${recording.uploadProgress}%`}
												className="text-center text-muted-foreground text-sm"
												duration={1.5}
											/>
										</div>
									)}

									{/* Analyzing state */}
									{isAnalyzing && (
										<ShimmeringText
											text="Analyzing..."
											className="text-muted-foreground text-sm"
											duration={1.5}
										/>
									)}
								</SignedIn>

								<SignedOut>
									<div className="flex w-full max-w-md flex-col gap-3">
										<Button disabled className="gap-2" size="lg">
											<Mic size={18} />
											Sign in to record
										</Button>
										<Button variant="outline" asChild size="lg">
											<SignInButton mode="modal">
												Sign in to start practicing
											</SignInButton>
										</Button>
									</div>
								</SignedOut>
							</div>
						</div>
					</div>

					{/* Recent attempts */}
					<SignedIn>
						<RecentAttempts attempts={recentAttempts} textId={text.id} />
					</SignedIn>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
