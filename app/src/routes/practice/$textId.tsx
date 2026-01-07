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
	Upload,
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
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { Progress } from "@/components/ui/progress";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import type { Author, ReferenceSpeech } from "@/db/types";
import { uploadAudioRecording } from "@/lib/audio-upload";
import { formatDuration, serverGetReferencesForText } from "@/lib/reference";
import { getScoreLevel } from "@/lib/score";
import { motion } from "motion/react";
import { pageVariants } from "@/components/ui/animations";
import { serverGetPracticeTextById } from "@/lib/text";
import { serverGetPreferredAuthorId } from "@/lib/user-preferences";
import { cn, formatRelativeTime } from "@/lib/utils";

export const Route = createFileRoute("/practice/$textId")({
	component: PracticeTextLayout,
	loader: async ({ params }) => {
		const [textResult, preferredAuthorId] = await Promise.all([
			serverGetPracticeTextById({
				data: { id: params.textId },
			}),
			serverGetPreferredAuthorId(),
		]);

		if (!textResult.success || !textResult.data) {
			return {
				text: null,
				references: [],
				recentAttempts: [],
				preferredAuthorId: null,
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

		// Mock attempts for this specific text
		const now = new Date();
		const recentAttempts = [
			{
				id: "attempt-1",
				textId: params.textId,
				textPreview: textResult.data.content.slice(0, 50) + "...",
				score: 88,
				date: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
				analysisId: crypto.randomUUID(),
			},
			{
				id: "attempt-2",
				textId: params.textId,
				textPreview: textResult.data.content.slice(0, 50) + "...",
				score: 82,
				date: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
				analysisId: crypto.randomUUID(),
			},
			{
				id: "attempt-3",
				textId: params.textId,
				textPreview: textResult.data.content.slice(0, 50) + "...",
				score: 79,
				date: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
				analysisId: crypto.randomUUID(),
			},
			{
				id: "attempt-4",
				textId: params.textId,
				textPreview: textResult.data.content.slice(0, 50) + "...",
				score: 75,
				date: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
				analysisId: crypto.randomUUID(),
			},
		];

		return {
			text: textResult.data,
			references,
			recentAttempts,
			preferredAuthorId,
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
					if (t >= 19) {
						stopRecording();
						return 20;
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

	const submitRecording = useCallback(
		async (referenceId: string) => {
			if (!audioBlob) return;

			try {
				setState("uploading");
				setUploadProgress(10);

				// Convert blob to base64 using a Promise to ensure errors are caught
				const base64Data = await new Promise<string>((resolve, reject) => {
					const reader = new FileReader();
					reader.readAsDataURL(audioBlob);
					reader.onloadend = () => {
						const base64String = reader.result as string;
						const data = base64String.split(",")[1];
						if (data) {
							resolve(data);
						} else {
							reject(new Error("Failed to process audio data"));
						}
					};
					reader.onerror = () => reject(new Error("Failed to read audio file"));
				});

				setUploadProgress(40);
				const durationMs = Number.isFinite(recordingTime)
					? Math.max(1, Math.round(recordingTime * 1000))
					: 1000;
				console.log("Submitting recording:", {
					textId,
					referenceId,
					durationMs,
					recordingTime,
				});

				const response = await uploadAudioRecording({
					data: {
						textId,
						referenceId,
						audioBase64: base64Data,
						mimeType: audioBlob.type,
						duration: durationMs,
					},
				});

				if (response.success) {
					setUploadProgress(100);
					setState("analyzing");
					// Small delay to show complete state
					setTimeout(() => {
						navigate({
							to: "/practice/$textId/analysis/$analysisId",
							params: { textId, analysisId: response.data.analysisId },
						});
					}, 500);
				} else {
					setError(response.error.message || "Upload failed");
					setState("idle");
				}
			} catch (err) {
				console.error("Submission error:", err);
				setError(err instanceof Error ? err.message : "Upload failed");
				setState("idle");
			}
		},
		[textId, navigate, audioBlob, recordingTime],
	);

	const resetRecording = useCallback(() => {
		setState("idle");
		setRecordingTime(0);
		setUploadProgress(0);
		setAudioBlob(null);
		setError(null);
		chunksRef.current = [];
	}, []);

	const handleFileUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			// Validate type
			if (!file.type.startsWith("audio/")) {
				setError("Please upload an audio file");
				return;
			}

			// Validate size (10MB limit)
			if (file.size > 10 * 1024 * 1024) {
				setError("File size must be less than 10MB");
				return;
			}

			try {
				setState("processing");
				setError(null);
				const url = URL.createObjectURL(file);
				const audio = new Audio(url);

				audio.onloadedmetadata = () => {
					setRecordingTime(audio.duration);
					setAudioBlob(file);
					setState("preview");
				};

				audio.onerror = () => {
					setError("Failed to load audio file");
					setState("idle");
				};
			} catch (err) {
				setError("Failed to process file");
				setState("idle");
			}
		},
		[],
	);

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
		handleFileUpload,
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
			{/* Selection area */}
			<div className="flex flex-col gap-2">
				{selectedReference ? (
					<div className="group relative">
						<Collapsible open={isOpen} onOpenChange={setIsOpen}>
							<CollapsibleTrigger asChild>
								<button
									type="button"
									className="flex w-full items-center justify-between gap-3 rounded-xl bg-muted/30 px-4 py-3 text-left transition-colors hover:bg-muted/50"
								>
									<div className="flex items-center gap-3">
										<div className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
											<Volume2 size={16} />
										</div>
										<div className="flex flex-col">
											<div className="flex items-center gap-2">
												<span className="font-medium text-sm">
													{selectedReference.author.name}
												</span>
												<Badge
													variant="secondary"
													className="h-5 px-1.5 font-normal text-[10px]"
												>
													{selectedReference.author.accent}
												</Badge>
											</div>
											{selectedReference.durationMs && (
												<span className="text-muted-foreground text-xs">
													Reference •{" "}
													{formatDuration(selectedReference.durationMs)}
												</span>
											)}
										</div>
									</div>
									<ChevronDown
										size={16}
										className={cn(
											"text-muted-foreground transition-transform",
											isOpen && "rotate-180",
										)}
									/>
								</button>
							</CollapsibleTrigger>

							<CollapsibleContent className="fade-in zoom-in-95 data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 absolute z-10 mt-2 w-full origin-top animate-in rounded-xl border bg-popover p-1 shadow-lg data-[state=closed]:animate-out">
								<div className="flex flex-col gap-1">
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
													"flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
													isSelected
														? "bg-primary/10 text-primary"
														: "hover:bg-muted",
												)}
											>
												<div className="flex items-center gap-3">
													<div className="font-medium">{ref.author.name}</div>
													<span className="text-muted-foreground text-xs">
														{ref.author.accent}
													</span>
												</div>
												{isSelected && <Check size={14} />}
											</button>
										);
									})}
								</div>
							</CollapsibleContent>
						</Collapsible>
					</div>
				) : (
					<Collapsible open={isOpen} onOpenChange={setIsOpen}>
						<CollapsibleTrigger asChild>
							<Button
								variant="outline"
								size="lg"
								className="h-14 w-full justify-between border-border/60 border-dashed bg-transparent hover:bg-muted/20"
							>
								<div className="flex items-center gap-3 text-muted-foreground">
									<Volume2 size={18} />
									<span>Select a reference voice to start</span>
								</div>
								<ChevronDown
									size={16}
									className={cn("transition-transform", isOpen && "rotate-180")}
								/>
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2 rounded-xl border bg-popover p-1 shadow-lg">
							{/* Dropdown content same as above */}
							<div className="flex flex-col gap-1">
								{references.map((ref) => (
									<button
										key={ref.id}
										type="button"
										onClick={() => {
											onSelect(ref.id);
											setIsOpen(false);
										}}
										className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-muted"
									>
										<div className="flex items-center gap-3">
											<div className="font-medium">{ref.author.name}</div>
											<span className="text-muted-foreground text-xs">
												{ref.author.accent}
											</span>
										</div>
									</button>
								))}
							</div>
						</CollapsibleContent>
					</Collapsible>
				)}
			</div>

			{/* Audio player - minimalist inline */}
			{selectedReference && (
				<AudioPlayerProvider>
					<div className="flex items-center gap-4 px-2">
						<AudioPlayerButton
							item={{
								id: selectedReference.id,
								src: `/api/audio/${selectedReference.id}`,
							}}
							variant="outline"
							size="icon"
							className="size-8 shrink-0 rounded-full border-primary/20 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
						/>
						<div className="flex flex-1 flex-col justify-center gap-1">
							<AudioPlayerProgress className="h-1" />
							<div className="flex justify-between font-mono text-[10px] text-muted-foreground">
								<AudioPlayerTime />
								<AudioPlayerDuration />
							</div>
						</div>
						<AudioPlayerSpeed className="h-6 text-[10px]" />
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
		<div className="flex flex-col gap-4 border-border/40 border-t pt-8">
			<div className="flex items-center justify-between">
				<h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					Recent Attempts
				</h3>
				<Link
					to="/summary"
					className="text-muted-foreground text-xs hover:text-primary"
				>
					View all
				</Link>
			</div>

			<div className="flex flex-col">
				{attempts.map((attempt) => (
					<Link
						key={attempt.id}
						to="/practice/$textId/analysis/$analysisId"
						params={{ textId, analysisId: attempt.analysisId }}
						className="group -mx-4 flex items-center justify-between rounded-md border-border/40 border-b px-4 py-4 transition-colors last:border-0 hover:bg-muted/20"
					>
						<div className="flex items-center gap-4">
							<span
								className={cn(
									"flex size-8 items-center justify-center rounded-md font-medium text-xs tabular-nums",
									getScoreLevel(attempt.score) === "high" &&
										"bg-emerald-500/10 text-emerald-600",
									getScoreLevel(attempt.score) === "medium" &&
										"bg-amber-500/10 text-amber-600",
									getScoreLevel(attempt.score) === "low" &&
										"bg-red-500/10 text-red-600",
								)}
							>
								{attempt.score}
							</span>
							<span className="text-muted-foreground text-xs">
								{formatRelativeTime(attempt.date)}
							</span>
						</div>
						<span className="text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100">
							View →
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
			<PageContainer maxWidth="lg">
				<div className="flex flex-col gap-12">
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="sm" asChild>
							<Link to="/practice" className="gap-2 text-muted-foreground">
								<ArrowLeft size={16} />
								Back
							</Link>
						</Button>
					</div>
					<div className="flex min-h-48 flex-col items-center justify-center space-y-4">
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
	const { text, references, recentAttempts, preferredAuthorId } =
		Route.useLoaderData();

	// Smart reference selection:
	// 1. Find reference by preferred author (if exists for this text)
	// 2. Fall back to first available reference
	const getInitialReferenceId = () => {
		if (preferredAuthorId) {
			const preferredRef = references.find(
				(ref) => ref.author?.id === preferredAuthorId,
			);
			if (preferredRef) return preferredRef.id;
		}
		return references[0]?.id ?? null;
	};

	const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
		getInitialReferenceId,
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
			<motion.div 
				variants={pageVariants} 
				initial="initial" 
				animate="animate" 
				exit="exit"
			>
				<PageContainer maxWidth="lg">
					<div className="flex flex-col gap-8">
						{/* Header with back button */}
					<div className="flex items-center gap-3">
						<Button variant="ghost" size="sm" asChild className="-ml-3">
							<Link
								to="/practice"
								className="gap-2 text-muted-foreground hover:text-foreground"
							>
								<ArrowLeft size={16} />
								Back
							</Link>
						</Button>
					</div>

					{/* Main content */}
					<div className="flex flex-col gap-10">
						{/* Reference voice - clean selector */}
						<ReferenceVoice
							references={references}
							selectedId={selectedReferenceId}
							onSelect={setSelectedReferenceId}
						/>

						{/* Practice text - clean typography, no box */}
						<div
							className={cn(
								"relative transition-all",
								isRecording && "opacity-80",
							)}
						>
							<p className="font-serif text-2xl text-foreground/90 leading-relaxed md:text-3xl md:leading-relaxed">
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
										<div className="flex w-full items-center justify-center gap-3">
											<Button
												size="lg"
												onClick={recording.startRecording}
												disabled={!selectedReferenceId}
												className="gap-2"
											>
												<Mic size={18} />
												{selectedReferenceId ? "Record" : "Select voice first"}
											</Button>

											<div className="relative">
												<input
													type="file"
													accept="audio/*"
													className="absolute inset-0 cursor-pointer opacity-0"
													onChange={recording.handleFileUpload}
													disabled={!selectedReferenceId}
												/>
												<Button
													variant="outline"
													size="lg"
													className="gap-2"
													disabled={!selectedReferenceId}
												>
													<Upload size={18} />
													Upload
												</Button>
											</div>
										</div>
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
												<span className="text-muted-foreground">/ 0:20</span>
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
											{recording.recordingTime >= 15 && (
												<p className="text-destructive text-xs">
													Auto-stop at 20s
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
													onClick={() =>
														selectedReferenceId &&
														recording.submitRecording(selectedReferenceId)
													}
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
		</motion.div>
	</MainLayout>
	);
}
