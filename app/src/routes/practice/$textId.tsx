import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useNavigate,
} from "@tanstack/react-router";
import {
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

	const startRecording = useCallback(() => {
		chunksRef.current = [];
		setAudioBlob(null);
		setState("recording");
		setRecordingTime(0);

		timerRef.current = setInterval(() => {
			setRecordingTime((t) => {
				if (t >= 59) {
					return 60;
				}
				return t + 1;
			});
		}, 1000);
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

	const handleStreamReady = useCallback((stream: MediaStream) => {
		setMediaStream(stream);
		const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
		mediaRecorder.ondataavailable = (event) => {
			if (event.data.size > 0) {
				chunksRef.current.push(event.data);
			}
		};
		mediaRecorderRef.current = mediaRecorder;
		mediaRecorder.start(100);
	}, []);

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
		chunksRef.current = [];
	}, []);

	return {
		state,
		recordingTime,
		uploadProgress,
		audioPreviewUrl,
		startRecording,
		stopRecording,
		submitRecording,
		resetRecording,
		handleStreamReady,
		handleStreamEnd,
	};
}

function formatTime(seconds: number) {
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

// Reference Voice Section (collapsible, secondary)
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
		<div className="flex flex-col gap-3">
			{/* Always visible: voice selector row */}
			<div className="flex h-10 items-center justify-between">
				<Collapsible open={isOpen} onOpenChange={setIsOpen} className="flex-1">
					<CollapsibleTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="gap-2 text-muted-foreground"
						>
							<Volume2 size={16} />
							<span>
								{selectedReference
									? `${selectedReference.author.name} · ${selectedReference.author.accent}`
									: "Select reference voice"}
							</span>
							<ChevronDown
								size={14}
								className={cn("transition-transform", isOpen && "rotate-180")}
							/>
						</Button>
					</CollapsibleTrigger>
				</Collapsible>

				{/* Inline player - always rendered, visibility controlled */}
				{selectedReference && (
					<AudioPlayerProvider>
						<div
							className={cn(
								"flex items-center gap-2 transition-opacity",
								isOpen ? "pointer-events-none opacity-0" : "opacity-100",
							)}
						>
							<AudioPlayerButton
								item={{
									id: selectedReference.id,
									src: `/api/audio/${selectedReference.id}`,
								}}
								variant="ghost"
								size="sm"
								className="size-8"
							/>
							<AudioPlayerProgress className="hidden w-24 sm:flex" />
						</div>
					</AudioPlayerProvider>
				)}
			</div>

			{/* Expandable content */}
			{isOpen && (
				<div className="flex flex-col gap-3 border-t pt-3">
					{/* Voice options */}
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
										"flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
										isSelected
											? "border-primary bg-primary/10 text-primary"
											: "border-border hover:border-primary/50",
									)}
								>
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

					{/* Full player for selected voice */}
					{selectedReference && (
						<AudioPlayerProvider>
							<div className="flex items-center gap-3">
								<AudioPlayerButton
									item={{
										id: selectedReference.id,
										src: `/api/audio/${selectedReference.id}`,
									}}
									variant="outline"
									size="icon"
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
			)}
		</div>
	);
}

// Recent Attempts (minimal)
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
		<div className="flex flex-col gap-2">
			<h3 className="font-medium text-muted-foreground text-sm">
				Recent Attempts
			</h3>
			<div className="flex flex-wrap gap-2">
				{attempts.map((attempt) => (
					<Link
						key={attempt.id}
						to="/practice/$textId/analysis/$analysisId"
						params={{ textId, analysisId: attempt.analysisId }}
						className="flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors hover:border-primary/50 hover:bg-muted/50"
					>
						<span
							className={cn(
								"font-medium tabular-nums",
								scoreColorVariants({ level: getScoreLevel(attempt.score) }),
							)}
						>
							{attempt.score}%
						</span>
						<span className="text-muted-foreground">
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
				<div className="flex min-h-64 flex-col items-center justify-center">
					<ShimmeringText
						text="Loading practice text..."
						className="text-lg"
						duration={1.5}
					/>
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

					{/* Main content area */}
					<div className="flex flex-col gap-6">
						{/* Reference voice selector (secondary, collapsible) */}
						<ReferenceVoice
							references={references}
							selectedId={selectedReferenceId}
							onSelect={setSelectedReferenceId}
						/>

						{/* THE TEXT - Main focus */}
						<div
							className={cn(
								"rounded-2xl border-2 p-6 transition-colors md:p-8",
								isRecording
									? "border-destructive/50 bg-destructive/5"
									: "border-border bg-card",
							)}
						>
							<p className="font-serif text-xl leading-relaxed md:text-2xl md:leading-relaxed">
								{text.content}
							</p>
						</div>

						{/* Recording controls - fixed height container to prevent shifts */}
						<div className="flex flex-col items-center">
							{/* Waveform visualization - fixed height */}
							<div className="h-20 w-full">
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

							{/* Controls container - fixed min-height */}
							<div className="flex min-h-32 w-full flex-col items-center justify-center gap-4 pt-4">
								<SignedIn>
									{/* Idle state */}
									{isIdle && (
										<Button
											size="lg"
											onClick={recording.startRecording}
											disabled={!selectedReferenceId}
											className="gap-2"
										>
											<Mic size={18} />
											{selectedReferenceId
												? "Start Recording"
												: "Select a voice first"}
										</Button>
									)}

									{/* Recording state */}
									{isRecording && (
										<>
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
										</>
									)}

									{/* Processing state */}
									{isProcessing && (
										<p className="text-muted-foreground text-sm">
											Processing...
										</p>
									)}

									{/* Preview state */}
									{hasPreview && (
										<>
											<AudioPlayerProvider>
												<div className="flex w-full max-w-md items-center gap-3">
													<AudioPlayerButton
														item={{
															id: "preview",
															src: recording.audioPreviewUrl!,
														}}
														variant="outline"
														size="icon"
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
													className="gap-2"
												>
													<RotateCcw size={16} />
													Re-record
												</Button>
												<Button
													onClick={recording.submitRecording}
													className="gap-2"
												>
													<Check size={16} />
													Submit
												</Button>
											</div>
										</>
									)}

									{/* Uploading state */}
									{isUploading && (
										<div className="flex w-full max-w-xs flex-col gap-2">
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
											text="Analyzing pronunciation..."
											className="text-muted-foreground text-sm"
											duration={1.5}
										/>
									)}
								</SignedIn>

								<SignedOut>
									<Button disabled className="gap-2">
										<Mic size={18} />
										Sign in to record
									</Button>
									<Button variant="outline" asChild>
										<SignInButton mode="modal">
											Sign in to start practicing
										</SignInButton>
									</Button>
								</SignedOut>
							</div>
						</div>
					</div>

					{/* Recent attempts (minimal) */}
					<SignedIn>
						<RecentAttempts attempts={recentAttempts} textId={text.id} />
					</SignedIn>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
