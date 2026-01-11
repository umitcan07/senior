import { SignedIn, SignedOut, SignInButton } from "@clerk/tanstack-react-start";
import { auth } from "@clerk/tanstack-react-start/server";
import {
	RiAlertLine,
	RiArrowDownSLine,
	RiArrowLeftLine,
	RiCheckLine,
	RiMicLine,
	RiRestartLine,
	RiStopLine,
	RiUploadLine,
	RiVolumeUpLine,
} from "@remixicon/react";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useNavigate,
} from "@tanstack/react-router";
import { motion } from "motion/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { pageVariants } from "@/components/ui/animations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { EmptyState } from "@/components/ui/empty-state";
import { LiveWaveform } from "@/components/ui/live-waveform";
import { ShimmeringText } from "@/components/ui/shimmering-text";
import {
	WaveformPlayer,
	WaveformPlayerInline,
} from "@/components/ui/waveform-player";
import type { Author, ReferenceSpeech } from "@/db/types";
import type { ApiResponse } from "@/lib/errors";
import { uploadAudioRecording } from "@/lib/audio-upload";
import { formatIpaForDisplay } from "@/lib/ipa";
import { formatDuration, serverGetReferencesForText } from "@/lib/reference";
import { getScoreLevel } from "@/lib/score";
import { serverGetRecentAttemptsForText } from "@/lib/server-summary";
import { serverGetPracticeTextById } from "@/lib/text";
import { serverGetPreferredAuthorId } from "@/lib/user-preferences";
import { cn, formatRelativeTime } from "@/lib/utils";

export const Route = createFileRoute("/practice/$textId")({
	component: PracticeTextLayout,
	loader: async ({ params }) => {
		// Check authentication before calling user-specific server functions
		let isAuthenticated = false;
		try {
			const authResult = await auth();
			isAuthenticated = authResult.isAuthenticated ?? false;
		} catch (error) {
			// Auth context not available - treat as unauthenticated
			console.warn("Auth not available in practice loader:", error);
		}

		const [textResult, preferredAuthorIdResult] = await Promise.all([
			serverGetPracticeTextById({
				data: { id: params.textId },
			}) as Promise<ApiResponse<any>>,
			// Only call if authenticated
			isAuthenticated ? serverGetPreferredAuthorId() : Promise.resolve(null),
		]);

		if (!textResult.success || !textResult.data) {
			return {
				text: null,
				references: [],
				recentAttempts: [],
				preferredAuthorId: null,
			};
		}

		const referencesResult = (await serverGetReferencesForText({
			data: { textId: params.textId },
		})) as ApiResponse<any>;

		const references =
			referencesResult.success && referencesResult.data
				? referencesResult.data.map((ref: any) => ({
					...ref,
					author: ref.author,
				}))
				: [];

		// Get recent attempts for this text - only if authenticated
		let recentAttempts: any[] = [];
		if (isAuthenticated) {
			const recentAttemptsResult = (await serverGetRecentAttemptsForText({
				data: { textId: params.textId },
			})) as ApiResponse<any>;
			recentAttempts = recentAttemptsResult.success && recentAttemptsResult.data
				? recentAttemptsResult.data
				: [];
		}

		return {
			text: textResult.data,
			references,
			recentAttempts,
			preferredAuthorId: preferredAuthorIdResult,
		};
	},
	pendingComponent: TextDetailSkeleton,
});

import { useAudioRecorder } from "@/hooks/use-audio-recorder";

// Recording state and logic
type RecordingState =
	| "idle"
	| "requesting" // Requesting microphone permission
	| "countdown" // 3-2-1 countdown before recording
	| "recording"
	| "processing"
	| "preview"
	| "uploading"
	| "analyzing";

const MAX_RECORDING_TIME = 20; // seconds

function useRecording(textId: string) {
	const [uiState, setUiState] = useState<RecordingState>("idle");
	const [countdown, setCountdown] = useState(3);
	const navigate = useNavigate();

	// Store uploaded file separately from recorded audio
	const [uploadedFileBlob, setUploadedFileBlob] = useState<Blob | null>(null);
	const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null);
	const [uploadedFileDuration, setUploadedFileDuration] = useState(0);

	// Use the audio recorder hook for all MediaRecorder logic
	const audioRecorder = useAudioRecorder({
		onStart: () => {
			setUiState("recording");
		},
		onStop: () => {
			setUiState("preview");
		},
		onError: () => {
			setUiState("idle");
		},
	});

	// Map audio recorder state to UI state
	const state: RecordingState = useMemo(() => {
		if (uiState === "recording" && audioRecorder.isRecording) {
			return "recording";
		}
		if (uiState === "preview" && (audioRecorder.audioBlob || uploadedFileBlob)) {
			return "preview";
		}
		return uiState;
	}, [uiState, audioRecorder.isRecording, audioRecorder.audioBlob, uploadedFileBlob]);

	// Cleanup uploaded file URL on unmount
	useEffect(() => {
		return () => {
			if (uploadedFileUrl) {
				URL.revokeObjectURL(uploadedFileUrl);
			}
		};
	}, [uploadedFileUrl]);

	// Auto-stop when max time reached
	useEffect(() => {
		if (
			state === "recording" &&
			audioRecorder.recordingTime >= MAX_RECORDING_TIME
		) {
			audioRecorder.stopRecording();
			setUiState("processing");
		}
	}, [state, audioRecorder.recordingTime, audioRecorder]);

	// Run the countdown sequence before starting recording
	const runCountdown = useCallback(() => {
		setCountdown(3);
		setUiState("countdown");

		let count = 3;
		const countdownInterval = setInterval(() => {
			count--;
			if (count > 0) {
				setCountdown(count);
			} else {
				clearInterval(countdownInterval);
				// Start actual recording AFTER countdown
				audioRecorder.startRecording();
			}
		}, 600);
	}, [audioRecorder]);

	// Start recording with countdown - only start countdown after mic permission is granted
	const startRecording = useCallback(async () => {
		setUiState("requesting");

		try {
			// Request microphone permission first
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			// Permission granted - stop the stream (we'll get a new one when recording starts)
			stream.getTracks().forEach((track) => track.stop());

			// Now start countdown, which will call audioRecorder.startRecording when done
			runCountdown();
		} catch (err) {
			// Permission denied or error - reset to idle state
			setUiState("idle");
		}
	}, [runCountdown]);

	// Stop recording
	const stopRecording = useCallback(() => {
		setUiState("processing");
		audioRecorder.stopRecording();
	}, [audioRecorder]);

	// Handle stream ready - called from LiveWaveform
	const handleStreamReady = useCallback(() => {
		// LiveWaveform handles its own stream, we just need to know it's ready
		// The audio recorder will request its own stream when needed
	}, []);

	const handleStreamError = useCallback(() => {
		setUiState("idle");
	}, []);

	const handleStreamEnd = useCallback(() => {
		// Stream ended, handled by audio recorder
	}, []);

	const submitRecording = useCallback(
		async (referenceId: string) => {
			// Use uploaded file blob if available, otherwise use recorded audio blob
			const audioBlob = uploadedFileBlob || audioRecorder.audioBlob;
			if (!audioBlob) return;

			try {
				setUiState("uploading");

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

				// Use uploaded file duration if available, otherwise use recording time
				const durationMs = uploadedFileBlob
					? Math.max(1, Math.round(uploadedFileDuration * 1000))
					: Number.isFinite(audioRecorder.recordingTime)
						? Math.max(1, Math.round(audioRecorder.recordingTime * 1000))
						: 1000;
				console.log("Submitting recording:", {
					textId,
					referenceId,
					durationMs,
					recordingTime: uploadedFileBlob
						? uploadedFileDuration
						: audioRecorder.recordingTime,
					source: uploadedFileBlob ? "upload" : "record",
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
					setUiState("analyzing");
					// Small delay to show complete state
					setTimeout(() => {
						navigate({
							to: "/practice/$textId/analysis/$analysisId",
							params: { textId, analysisId: response.data.analysisId },
						});
					}, 500);
				} else {
					setUiState("idle");
				}
			} catch (err) {
				console.error("Submission error:", err);
				setUiState("idle");
			}
		},
		[
			textId,
			navigate,
			audioRecorder.audioBlob,
			audioRecorder.recordingTime,
			uploadedFileBlob,
			uploadedFileDuration,
		],
	);

	const resetRecording = useCallback(() => {
		setUiState("idle");
		setCountdown(3);
		// Clean up uploaded file
		if (uploadedFileUrl) {
			URL.revokeObjectURL(uploadedFileUrl);
			setUploadedFileUrl(null);
		}
		setUploadedFileBlob(null);
		setUploadedFileDuration(0);
	}, [uploadedFileUrl]);

	const handleFileUpload = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const file = e.target.files?.[0];
			if (!file) return;

			// Validate type
			if (!file.type.startsWith("audio/")) {
				setUiState("idle");
				return;
			}

			// Validate size (10MB limit)
			if (file.size > 10 * 1024 * 1024) {
				setUiState("idle");
				return;
			}

			try {
				setUiState("processing");

				// Clean up previous uploaded file URL if exists
				if (uploadedFileUrl) {
					URL.revokeObjectURL(uploadedFileUrl);
				}

				// Store the file blob
				setUploadedFileBlob(file);

				// Create preview URL
				const url = URL.createObjectURL(file);
				setUploadedFileUrl(url);

				// Get duration from audio metadata
				const audio = new Audio(url);
				audio.onloadedmetadata = () => {
					const duration = audio.duration;
					setUploadedFileDuration(duration);
					setUiState("preview");
				};

				audio.onerror = () => {
					URL.revokeObjectURL(url);
					setUploadedFileUrl(null);
					setUploadedFileBlob(null);
					setUploadedFileDuration(0);
					setUiState("idle");
				};
			} catch {
				setUiState("idle");
			}

			// Reset file input so the same file can be selected again
			e.target.value = "";
		},
		[uploadedFileUrl],
	);

	return {
		state,
		recordingTime: uploadedFileBlob
			? uploadedFileDuration
			: audioRecorder.recordingTime,
		countdown,
		audioPreviewUrl: uploadedFileUrl || audioRecorder.audioUrl,
		error: audioRecorder.error,
		startRecording,
		stopRecording,
		submitRecording,
		resetRecording,
		handleStreamReady,
		handleStreamEnd,
		handleStreamError,
		handleFileUpload,
		mediaStream: audioRecorder.mediaStream,
	};
}

function formatTime(seconds: number) {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
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
		<div className="flex flex-col gap-4 p-4 ring-muted ring-1 rounded-3xl max-w-2xl w-full self-center">
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
										<div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
											<RiVolumeUpLine size={16} />
										</div>
										<div className="flex min-w-0 flex-1 flex-col">
											<div className="flex items-center gap-2">
												<span className="truncate font-medium text-sm">
													{selectedReference.author.name}
												</span>
												<Badge
													variant="secondary"
													className="h-5 shrink-0 px-1.5 font-normal text-[10px]"
												>
													{selectedReference.author.accent}
												</Badge>
											</div>
											{selectedReference.durationMs && (
												<span className="text-muted-foreground text-xs">
													{formatDuration(selectedReference.durationMs)}
												</span>
											)}
										</div>
									</div>
									<RiArrowDownSLine
										size={16}
										className={cn(
											"shrink-0 text-muted-foreground transition-transform",
											isOpen && "rotate-180",
										)}
									/>
								</button>
							</CollapsibleTrigger>

							<CollapsibleContent className="fade-in zoom-in-95 data-[state=closed]:fade-out data-[state=closed]:zoom-out-95 absolute z-10 mt-2 w-full origin-top rounded-xl border bg-popover p-1 shadow-lg data-[state=closed]:animate-out">
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
												<div className="flex min-w-0 items-center gap-3">
													<div className="truncate font-medium">
														{ref.author.name}
													</div>
													<span className="shrink-0 text-muted-foreground text-xs">
														{ref.author.accent}
													</span>
												</div>
												{isSelected && (
													<RiCheckLine size={14} className="shrink-0" />
												)}
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
									<RiVolumeUpLine size={18} />
									<span>Select a reference voice to start</span>
								</div>
								<RiArrowDownSLine
									size={16}
									className={cn("transition-transform", isOpen && "rotate-180")}
								/>
							</Button>
						</CollapsibleTrigger>
						<CollapsibleContent className="mt-2 rounded-xl border bg-popover p-1 shadow-lg">
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
										<div className="flex min-w-0 items-center gap-3">
											<div className="truncate font-medium">
												{ref.author.name}
											</div>
											<span className="shrink-0 text-muted-foreground text-xs">
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
				<WaveformPlayerInline
					src={`/api/audio/${selectedReference.id}`}
					className="bg-card w-full border"
				/>
			)}

			{/* IPA Transcription display */}
			{selectedReference?.ipaTranscription ? (
				<div className="rounded-lg bg-muted/30 p-4">
					<div className="mb-2 flex items-center justify-between">
						<h4 className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Target Pronunciation (IPA)
						</h4>
						<Badge
							variant="outline"
							className="h-5 px-1.5 font-normal text-[10px]"
						>
							{selectedReference.ipaMethod === "powsm"
								? "Audio-guided"
								: "Dictionary"}
						</Badge>
					</div>
					<p className="font-ipa text-xl leading-relaxed tracking-wide text-foreground/80">
						{formatIpaForDisplay(selectedReference.ipaTranscription)}
					</p>
				</div>
			) : (
				<div className="rounded-lg bg-muted/30 p-4">
					<p className="text-muted-foreground text-xs">
						No IPA transcription available. Please choose a different reference
						voice.
					</p>
				</div>
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
		score: number | null;
		date: Date;
		analysisId: string;
		status: "pending" | "processing" | "completed" | "failed";
	}>;
	textId: string;
}

function RecentAttempts({ attempts, textId }: RecentAttemptsProps) {
	if (attempts.length === 0) return null;

	const getStatusBadge = (status: string, score: number | null) => {
		if (status === "completed" && score !== null) {
			return null; // Show score instead
		}
		if (status === "pending") {
			return (
				<Badge variant="secondary" className="h-5 bg-blue-500/10 text-blue-600 text-[10px] dark:text-blue-400">
					Pending
				</Badge>
			);
		}
		if (status === "processing") {
			return (
				<Badge variant="secondary" className="h-5 bg-amber-500/10 text-amber-600 text-[10px] dark:text-amber-400">
					Processing
				</Badge>
			);
		}
		if (status === "failed") {
			return (
				<Badge variant="secondary" className="h-5 bg-red-500/10 text-red-600 text-[10px] dark:text-red-400">
					Failed
				</Badge>
			);
		}
		return null;
	};

	return (
		<div className="flex flex-col gap-4 pt-20">
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

			<div className="grid grid-cols-2 gap-2 sm:flex sm:flex-col">
				{attempts.map((attempt) => {
					const statusBadge = getStatusBadge(attempt.status, attempt.score);
					const showScore = attempt.status === "completed" && attempt.score !== null;

					return (
						<Link
							key={attempt.id}
							to="/practice/$textId/analysis/$analysisId"
							params={{ textId, analysisId: attempt.analysisId }}
							className="group flex flex-col gap-1 rounded-lg border border-border/40 p-3 transition-colors hover:bg-muted/20 sm:flex-row sm:items-center sm:justify-between sm:rounded-md sm:border-0 sm:border-b sm:p-4 sm:last:border-0"
						>
							<div className="flex items-center gap-3 sm:gap-4">
								{showScore ? (
									<span
										className={cn(
											"flex size-8 items-center justify-center rounded-md font-medium text-xs tabular-nums",
											getScoreLevel(attempt.score!) === "high" &&
											"bg-emerald-500/10 text-emerald-600",
											getScoreLevel(attempt.score!) === "medium" &&
											"bg-amber-500/10 text-amber-600",
											getScoreLevel(attempt.score!) === "low" &&
											"bg-red-500/10 text-red-600",
										)}
									>
										{attempt.score}
									</span>
								) : (
									<div className="flex size-8 items-center justify-center">
										{statusBadge}
									</div>
								)}
								<span className="text-muted-foreground text-xs">
									{formatRelativeTime(attempt.date)}
								</span>
							</div>
							<span className="hidden text-muted-foreground text-xs opacity-0 transition-opacity group-hover:opacity-100 sm:inline">
								View →
							</span>
						</Link>
					);
				})}
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
								<RiArrowLeftLine size={16} />
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

	const isRequesting = recording.state === "requesting";
	const isCountdown = recording.state === "countdown";
	const isRecording = recording.state === "recording";
	// Show preview if we have audio, regardless of state (handles transition from processing to preview)
	const hasPreview = !!recording.audioPreviewUrl;
	const isProcessing =
		recording.state === "processing" && !recording.audioPreviewUrl;
	const isUploading = recording.state === "uploading";
	const isAnalyzing = recording.state === "analyzing";
	const isIdle = recording.state === "idle";
	const isActiveRecording = isRequesting || isCountdown || isRecording;

	return (
		<MainLayout>
			<motion.div
				variants={pageVariants}
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<PageContainer maxWidth="lg">
					<div className="flex flex-col gap-0">
						{/* Header with back button */}
						<div className="flex items-center gap-3">
							<Button variant="ghost" size="sm" asChild className="-ml-3">
								<Link
									to="/practice"
									className="gap-2 text-muted-foreground hover:text-foreground"
								>
									<RiArrowLeftLine size={16} />
									Back
								</Link>
							</Button>
						</div>

						{/* Main content */}
						<div className="flex flex-col gap-12">
							{/* Reference voice - clean selector */}
							<ReferenceVoice
								references={references}
								selectedId={selectedReferenceId}
								onSelect={setSelectedReferenceId}
							/>

							{/* Practice text - clean typography, no box */}
							<div
								className={cn(
									"relative transition-all max-w-2xl w-full self-center",
									isActiveRecording && "opacity-80",
								)}
							>
								<p className="font-ipa text-2xl text-foreground/90 leading-relaxed md:text-3xl md:leading-relaxed">
									{text.content}
								</p>
							</div>

							{/* Recording section - fixed heights */}
							<div className="relative flex flex-col gap-4">
								{/* Overlay for uploading/analyzing */}
								{(isUploading || isAnalyzing) && (
									<div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-4 rounded-xl bg-black/80 text-white backdrop-blur-[2px] transition-all duration-300">
										{isUploading && (
											<div className="flex w-full max-w-xs flex-col items-center gap-4 p-6">
												<div className="h-2 w-2 animate-ping rounded-full bg-white" />
												<span className="font-medium">Uploading your speech...</span>
											</div>
										)}
										{isAnalyzing && (
											<div className="flex flex-col items-center gap-3 p-6">
												<div className="h-2 w-2 animate-ping rounded-full bg-white" />
												<ShimmeringText
													text="Hang on, we are bringing your analysis here."
													className="text-white text-lg font-medium"
													shimmerWidth={200}
												/>
											</div>
										)}
									</div>
								)}
								{/* Waveform - fixed height */}
								<div
									className={cn(
										"h-20 w-full overflow-hidden rounded-lg transition-opacity duration-300",
										isRequesting || isCountdown ? "opacity-50" : "opacity-100",
									)}
								>
									<LiveWaveform
										active={isRecording || isCountdown}
										processing={isProcessing}
										stream={recording.mediaStream || undefined}
										height={80}
										barWidth={3}
										barGap={2}
										mode="static"
										fadeEdges
										sensitivity={1.5}
										onStreamReady={recording.handleStreamReady}
										onStreamEnd={recording.handleStreamEnd}
										onError={recording.handleStreamError}
									/>
								</div>

								{/* Controls - fixed min-height */}
								<div className="flex min-h-32 flex-col items-center justify-center gap-4">
									<SignedIn>
										{/* Error state */}
										{recording.error && (
											<div className="flex w-full max-w-md flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/5 p-4">
												<div className="flex items-center gap-2 text-destructive text-sm">
													<RiAlertLine size={16} />
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
											<div className="flex w-full max-w-md gap-3">
												<Button
													size="lg"
													onClick={recording.startRecording}
													disabled={!selectedReferenceId}
													className="flex-1 gap-2"
												>
													<RiMicLine size={18} />
													{selectedReferenceId
														? "Record"
														: "Select voice first"}
												</Button>

												<div className="relative flex-1">
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
														className="w-full gap-2"
														disabled={!selectedReferenceId}
													>
														<RiUploadLine size={18} />
														Upload
													</Button>
												</div>
											</div>
										)}

										{/* Requesting permission state */}
										{isRequesting && (
											<div className="flex w-full max-w-md flex-col items-center gap-4">
												<ShimmeringText
													text="Requesting microphone..."
													className="text-muted-foreground text-sm"
													duration={1.5}
												/>
											</div>
										)}

										{/* Countdown state - 3, 2, 1 */}
										{isCountdown && (
											<div className="flex w-full max-w-md flex-col items-center gap-4">
												<motion.div
													key={recording.countdown}
													initial={{ scale: 0.5, opacity: 0 }}
													animate={{ scale: 1, opacity: 1 }}
													exit={{ scale: 1.5, opacity: 0 }}
													transition={{ duration: 0.3 }}
													className="flex size-16 items-center justify-center rounded-full bg-primary/10"
												>
													<span className="font-bold text-3xl text-primary tabular-nums">
														{recording.countdown}
													</span>
												</motion.div>
												<p className="text-muted-foreground text-sm">
													Get ready...
												</p>
											</div>
										)}

										{/* Recording state - circular progress */}
										{isRecording && (
											<div className="flex w-full max-w-md flex-col items-center gap-4">
												{/* Circular progress ring */}
												<div className="relative size-20">
													<svg
														className="-rotate-90 size-full"
														viewBox="0 0 100 100"
													>
														<title>Recording Progress</title>
														{/* Background ring */}
														<circle
															cx="50"
															cy="50"
															r="42"
															fill="none"
															stroke="currentColor"
															strokeWidth="6"
															className="text-muted/20"
														/>
														{/* Progress ring */}
														<motion.circle
															cx="50"
															cy="50"
															r="42"
															fill="none"
															stroke="currentColor"
															strokeWidth="6"
															strokeLinecap="round"
															className="text-destructive"
															style={{
																strokeDasharray: 2 * Math.PI * 42,
																strokeDashoffset:
																	2 *
																	Math.PI *
																	42 *
																	(1 -
																		recording.recordingTime /
																		MAX_RECORDING_TIME),
															}}
															transition={{
																strokeDashoffset: {
																	duration: 0.1,
																	ease: "linear",
																},
															}}
														/>
													</svg>
													{/* Center content */}
													<div className="absolute inset-0 flex flex-col items-center justify-center">
														<span className="relative flex size-2.5">
															<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
															<span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
														</span>
														<span className="mt-1 font-mono text-sm font-semibold tabular-nums">
															{Math.round(
																(recording.recordingTime / MAX_RECORDING_TIME) *
																100,
															)}
															%
														</span>
													</div>
												</div>
												<Button
													variant="destructive"
													size="lg"
													onClick={recording.stopRecording}
													className="gap-2"
												>
													<RiStopLine size={16} />
													Stop Recording
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
										{hasPreview && recording.audioPreviewUrl && (
											<div className="flex w-full max-w-2xl flex-col gap-4">
												<WaveformPlayer
													src={recording.audioPreviewUrl}
													compact
													showRestartButton
													className="bg-card"
													label={`Preview (${formatTime(recording.recordingTime)})`}
												/>
												<div className="flex gap-3">
													<Button
														variant="outline"
														onClick={recording.resetRecording}
														className="flex-1 gap-2"
													>
														<RiRestartLine size={16} />
														Re-record
													</Button>
													<Button
														onClick={() =>
															selectedReferenceId &&
															recording.submitRecording(selectedReferenceId)
														}
														className="flex-1 gap-2"
													>
														<RiCheckLine size={16} />
														Submit
													</Button>
												</div>
											</div>
										)}


									</SignedIn>

									<SignedOut>
										<div className="flex w-full max-w-md flex-col gap-3">
											<Button disabled className="gap-2" size="lg">
												<RiMicLine size={18} />
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
