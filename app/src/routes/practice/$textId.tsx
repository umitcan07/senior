import { SignedIn, SignedOut, SignInButton } from "@clerk/clerk-react";
import {
	createFileRoute,
	Link,
	Outlet,
	useMatches,
	useNavigate,
} from "@tanstack/react-router";
import { ArrowLeft, Mic, Pause, Play, Square, Upload } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Pulse } from "@/components/ui/pulse";
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
	type Author,
	formatDuration,
	formatRelativeTime,
	getRecentAttemptsForText,
	getReferencesForText,
	MOCK_TEXTS,
	type ReferenceSpeech,
} from "@/data/mock";
import { getScoreLevel, scoreColorVariants } from "@/lib/score";
import { serverGetPracticeTextById } from "@/lib/text";
import { cn } from "@/lib/utils";

const UUID_REGEX =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const Route = createFileRoute("/practice/$textId")({
	component: PracticeTextLayout,
	loader: async ({ params }) => {
		// Only try database if the ID looks like a valid UUID
		if (UUID_REGEX.test(params.textId)) {
			try {
				const result = await serverGetPracticeTextById({
					data: { id: params.textId },
				});

				if (result.success && result.data) {
					// Use real data with mock references
					return {
						text: result.data,
						references: getReferencesForText(params.textId),
						recentAttempts: getRecentAttemptsForText(params.textId),
						source: "database" as const,
					};
				}
			} catch {
				// Database lookup failed, fall through to mock
			}
		}

		// Fall back to mock
		const mockText = MOCK_TEXTS.find((t) => t.id === params.textId);
		if (!mockText) {
			return {
				text: null,
				references: [],
				recentAttempts: [],
				source: "mock" as const,
			};
		}

		return {
			text: mockText,
			references: getReferencesForText(params.textId),
			recentAttempts: getRecentAttemptsForText(params.textId),
			source: "mock" as const,
		};
	},
	pendingComponent: TextDetailSkeleton,
});

interface ReferenceSelectorProps {
	references: (ReferenceSpeech & { author: Author })[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}

function ReferenceSelector({
	references,
	selectedId,
	onSelect,
}: ReferenceSelectorProps) {
	if (references.length === 0) {
		return (
			<Card>
				<CardContent className="py-6">
					<EmptyState
						title="No reference audio available"
						description="Reference audio for this text is not yet available. Check back soon."
					/>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Reference Voice</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				<Select value={selectedId ?? undefined} onValueChange={onSelect}>
					<SelectTrigger>
						<SelectValue placeholder="Select a voice" />
					</SelectTrigger>
					<SelectContent>
						{references.map((ref) => (
							<SelectItem key={ref.id} value={ref.id}>
								<div className="flex items-center gap-2">
									<span>{ref.author.name}</span>
									<Badge variant="secondary" className="text-xs">
										{ref.author.accent}
									</Badge>
									{ref.durationMs && (
										<span className="text-muted-foreground text-xs">
											{formatDuration(ref.durationMs)}
										</span>
									)}
								</div>
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{selectedId && (
					<AudioPlayer
						// In production, this would be the actual audio URL
						audioUrl={`/api/audio/${selectedId}`}
						disabled
					/>
				)}
			</CardContent>
		</Card>
	);
}

// AUDIO PLAYER (placeholder)

interface AudioPlayerProps {
	audioUrl: string;
	disabled?: boolean;
}

function AudioPlayer({ disabled }: AudioPlayerProps) {
	const [isPlaying, setIsPlaying] = useState(false);
	const [progress, setProgress] = useState(0);

	// Simulated playback for demo
	const togglePlay = useCallback(() => {
		if (disabled) return;
		setIsPlaying(!isPlaying);
		if (!isPlaying) {
			// Simulate progress
			const interval = setInterval(() => {
				setProgress((p) => {
					if (p >= 100) {
						clearInterval(interval);
						setIsPlaying(false);
						return 0;
					}
					return p + 2;
				});
			}, 100);
		}
	}, [isPlaying, disabled]);

	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-3">
				<Button
					variant="outline"
					size="icon"
					onClick={togglePlay}
					disabled={disabled}
					aria-label={isPlaying ? "Pause" : "Play"}
				>
					{isPlaying ? <Pause size={16} /> : <Play size={16} />}
				</Button>
				<div className="flex-1">
					<Progress value={progress} className="h-2" />
				</div>
				<span className="text-muted-foreground text-xs tabular-nums">
					0:00 / --:--
				</span>
			</div>
			{disabled && (
				<p className="text-muted-foreground text-xs">
					Audio playback requires backend integration
				</p>
			)}
		</div>
	);
}

type RecordingState =
	| "idle"
	| "recording"
	| "processing"
	| "preview"
	| "uploading"
	| "analyzing";

interface RecordingSectionProps {
	textId: string;
	referenceId: string | null;
	disabled?: boolean;
}

function RecordingSection({ textId, disabled }: RecordingSectionProps) {
	const [state, setState] = useState<RecordingState>("idle");
	const [recordingTime, setRecordingTime] = useState(0);
	const [uploadProgress, setUploadProgress] = useState(0);
	const timerRef = useRef<NodeJS.Timeout | null>(null);
	const navigate = useNavigate();

	const startRecording = useCallback(() => {
		setState("recording");
		setRecordingTime(0);
		timerRef.current = setInterval(() => {
			setRecordingTime((t) => t + 1);
		}, 1000);
	}, []);

	const stopRecording = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
		}
		setState("processing");
		// Simulate processing
		setTimeout(() => setState("preview"), 1000);
	}, []);

	const submitRecording = useCallback(() => {
		setState("uploading");
		setUploadProgress(0);
		// Simulate upload
		const interval = setInterval(() => {
			setUploadProgress((p) => {
				if (p >= 100) {
					clearInterval(interval);
					setState("analyzing");
					// Simulate analysis
					setTimeout(() => {
						// Navigate to analysis page (mock)
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
	}, []);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	if (disabled) {
		return (
			<Card>
				<CardHeader className="pb-3">
					<CardTitle className="text-base">Record Your Voice</CardTitle>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div className="flex flex-col items-center gap-4 py-4">
						<Button size="lg" disabled>
							<Mic size={18} />
							Start Recording
						</Button>
						<p className="text-muted-foreground text-xs">
							Select a reference voice to start recording
						</p>
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Record Your Voice</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{state === "idle" && (
					<div className="flex flex-col items-center gap-4 py-4 sm:flex-row sm:justify-center">
						<Button size="lg" onClick={startRecording}>
							<Mic size={18} />
							Start Recording
						</Button>
						<span className="text-muted-foreground text-sm">or</span>
						<Button variant="outline" size="lg" disabled>
							<Upload size={18} />
							Upload Audio
						</Button>
					</div>
				)}

				{state === "recording" && (
					<div className="flex flex-col items-center gap-4 py-4">
						<div className="flex items-center gap-3">
							<span className="relative flex size-3">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
								<span className="relative inline-flex size-3 rounded-full bg-destructive" />
							</span>
							<span className="font-mono text-lg tabular-nums">
								{formatTime(recordingTime)}
							</span>
						</div>
						<Button variant="destructive" size="lg" onClick={stopRecording}>
							<Square size={18} />
							Stop Recording
						</Button>
						{recordingTime >= 55 && (
							<p className="text-destructive text-xs">
								Max recording time: 60 seconds
							</p>
						)}
					</div>
				)}

				{state === "processing" && (
					<div className="flex flex-col items-center gap-4 py-8">
						<div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
						<p className="text-muted-foreground text-sm">Processing audio...</p>
					</div>
				)}

				{state === "preview" && (
					<div className="flex flex-col gap-4 py-4">
						<div className="rounded-lg bg-muted p-4">
							<div className="flex items-center justify-between">
								<span className="text-sm">Recording ready</span>
								<span className="font-mono text-muted-foreground text-sm">
									{formatTime(recordingTime)}
								</span>
							</div>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
							<Button variant="outline" onClick={resetRecording}>
								Re-record
							</Button>
							<Button onClick={submitRecording}>Submit for Analysis</Button>
						</div>
					</div>
				)}

				{state === "uploading" && (
					<div className="flex flex-col gap-4 py-4">
						<div className="flex flex-col gap-2">
							<div className="flex justify-between text-sm">
								<span className="tabular-nums">{uploadProgress}%</span>
							</div>
							<Progress value={uploadProgress} />
						</div>
					</div>
				)}

				{state === "analyzing" && (
					<div className="flex flex-col items-center gap-4 py-8">
						<Pulse className="w-10" />
						<p className="text-muted-foreground text-sm">
							Analyzing pronunciation...
						</p>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

interface RecentAttemptsProps {
	attempts: Attempt[];
	textId: string;
}

function RecentAttempts({ attempts, textId }: RecentAttemptsProps) {
	if (attempts.length === 0) {
		return null;
	}

	return (
		<Card>
			<CardHeader className="pb-3">
				<CardTitle className="text-base">Recent Attempts</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="flex flex-col gap-2">
					{attempts.map((attempt) => (
						<Link
							key={attempt.id}
							to="/practice/$textId/analysis/$analysisId"
							params={{ textId, analysisId: attempt.analysisId }}
							className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-muted"
						>
							<div className="flex items-center gap-3">
								<div
									className={cn(
										"font-medium tabular-nums",
										scoreColorVariants({ level: getScoreLevel(attempt.score) }),
									)}
								>
									{attempt.score}%
								</div>
								<span className="text-muted-foreground text-sm">
									{formatRelativeTime(attempt.date)}
								</span>
							</div>
							<span className="text-muted-foreground text-xs">
								View analysis →
							</span>
						</Link>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

// SKELETON

function TextDetailSkeleton() {
	return (
		<MainLayout>
			<PageContainer maxWidth="lg">
				<div className="flex flex-col gap-6">
					<div className="flex items-center gap-4">
						<Skeleton className="size-9" />
						<div className="flex flex-col gap-2">
							<Skeleton className="h-7 w-48" />
							<Skeleton className="h-4 w-72" />
						</div>
					</div>
					<Skeleton className="h-40 w-full" />
					<div className="grid gap-6 lg:grid-cols-2">
						<Skeleton className="h-48" />
						<Skeleton className="h-48" />
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

// LAYOUT

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

// MAIN PAGE

function PracticeTextPage() {
	const { text, references, recentAttempts } = Route.useLoaderData();
	const [selectedReferenceId, setSelectedReferenceId] = useState<string | null>(
		references[0]?.id ?? null,
	);
	const navigate = useNavigate();

	if (!text) {
		return (
			<MainLayout>
				<PageContainer maxWidth="lg">
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

	return (
		<MainLayout>
			<PageContainer maxWidth="lg">
				<div className="flex flex-col gap-6">
					{/* Header */}
					<div className="flex items-center gap-4">
						<Button variant="ghost" size="icon" asChild>
							<Link to="/practice">
								<ArrowLeft size={18} />
							</Link>
						</Button>
						<div className="flex flex-col gap-1">
							<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-xl text-transparent tracking-tight md:text-2xl">
								Practice Session
							</h1>
							<p className="text-muted-foreground text-sm">
								Read the text aloud and get feedback on your pronunciation
							</p>
						</div>
					</div>

					{/* Text Content */}
					<Card>
						<CardContent className="p-6">
							<p className="text-foreground text-lg leading-relaxed">
								{text.content}
							</p>
						</CardContent>
					</Card>

					{/* Reference Selector & Recording Section */}
					<div className="grid gap-6 lg:grid-cols-2">
						<ReferenceSelector
							references={references}
							selectedId={selectedReferenceId}
							onSelect={setSelectedReferenceId}
						/>

						<SignedIn>
							<RecordingSection
								textId={text.id}
								referenceId={selectedReferenceId}
								disabled={!selectedReferenceId}
							/>
						</SignedIn>
						<SignedOut>
							<Card>
								<CardHeader className="pb-3">
									<CardTitle className="text-base">Record Your Voice</CardTitle>
								</CardHeader>
								<CardContent className="flex flex-col gap-4">
									<div className="flex flex-col items-center gap-4 py-4">
										<Button disabled>
											<Mic size={18} />
											Sign in to record
										</Button>
										<Button asChild>
											<SignInButton mode="modal">
												Sign in to start practicing
											</SignInButton>
										</Button>
									</div>
								</CardContent>
							</Card>
						</SignedOut>
					</div>

					{/* Recent Attempts */}
					<SignedIn>
						<RecentAttempts attempts={recentAttempts} textId={text.id} />
					</SignedIn>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
