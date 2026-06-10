import {
	RiArrowDownSLine,
	RiCheckboxCircleLine,
	RiErrorWarningLine,
	RiLoaderLine,
	RiTimeLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useState } from "react";
import { DiffViewer } from "@/components/diff-viewer";
import { AdminStatsLayout } from "@/components/layout/admin-stats-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
	type ErrorRegion,
	type PhoneRegion,
	WaveformPlayer,
} from "@/components/ui/waveform-player";
import type { AdminJobRow } from "@/db/admin-stats";
import { useRequireAdmin } from "@/lib/auth";
import {
	serverGetAdminJobDetails,
	serverGetAdminLatestJobs,
} from "@/lib/server-admin-stats";
import { cn, formatRelativeTime } from "@/lib/utils";

export const Route = createFileRoute("/admin/jobs")({
	component: AdminJobs,
});

const analysisStatusColors: Record<string, string> = {
	completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
	pending: "border-amber-500/20 bg-amber-500/10 text-amber-600",
	processing: "border-blue-500/20 bg-blue-500/10 text-blue-600",
	failed: "border-red-500/20 bg-red-500/10 text-red-600",
};

const jobStatusColors: Record<string, string> = {
	completed: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600",
	in_queue: "border-amber-500/20 bg-amber-500/10 text-amber-600",
	in_progress: "border-blue-500/20 bg-blue-500/10 text-blue-600",
	failed: "border-red-500/20 bg-red-500/10 text-red-600",
};

function scoreColor(score: number): string {
	if (score >= 80)
		return "border-emerald-500/20 bg-emerald-500/10 text-emerald-600";
	if (score >= 50) return "border-amber-500/20 bg-amber-500/10 text-amber-600";
	return "border-red-500/20 bg-red-500/10 text-red-600";
}

function JobsSkeleton() {
	return (
		<Card className="overflow-hidden bg-card/50">
			{Array.from({ length: 8 }).map((_, i) => (
				<div
					key={i}
					className="flex items-center gap-4 border-border/40 border-b px-5 py-4 last:border-0"
				>
					<Skeleton className="h-4 w-40" />
					<Skeleton className="h-4 flex-1" />
					<Skeleton className="h-5 w-20" />
					<Skeleton className="h-5 w-16" />
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-4 w-20" />
				</div>
			))}
		</Card>
	);
}

function JobRowDetail({ job }: { job: AdminJobRow }) {
	const getDetailsFn = useServerFn(serverGetAdminJobDetails);

	const { data, isLoading } = useQuery({
		queryKey: ["admin-job-details", job.analysisId],
		queryFn: async () => {
			const res = await getDetailsFn({ data: { analysisId: job.analysisId } });
			if (!res.success) throw new Error(res.error.message);
			return res.data;
		},
	});

	const phonemeErrors = data?.phonemeErrors ?? [];

	const errorRegions: ErrorRegion[] = phonemeErrors
		.flatMap((e) => {
			if (e.timestampStartMs == null || e.timestampEndMs == null) return [];
			return [
				{
					start: e.timestampStartMs / 1000,
					end: e.timestampEndMs / 1000,
					type: e.errorType as "substitute" | "insert" | "delete",
					label: e.actual ?? undefined,
				},
			];
		})
		.sort((a, b) => a.start - b.start);

	const [playRegion, setPlayRegion] = useState<{
		startMs: number;
		endMs: number;
		nonce: number;
	} | null>(null);

	const handleSegmentClick = useCallback((startMs: number, endMs: number) => {
		setPlayRegion((prev) => ({
			startMs,
			endMs,
			nonce: (prev?.nonce ?? 0) + 1,
		}));
	}, []);

	const referenceRegions: PhoneRegion[] = [];

	return (
		<div className="flex flex-col gap-6 border-border/40 border-t bg-muted/5 px-5 py-5">
			{/* Metadata row */}
			<div className="flex flex-wrap gap-4 text-muted-foreground text-xs">
				<span>
					<span className="font-medium text-foreground">Analysis ID:</span>{" "}
					<span className="font-mono">{job.analysisId}</span>
				</span>
				{job.jobExternalId && (
					<span>
						<span className="font-medium text-foreground">Job ID:</span>{" "}
						<span className="font-mono">{job.jobExternalId}</span>
					</span>
				)}
				{job.executionTimeMs != null && (
					<span>
						<span className="font-medium text-foreground">Exec time:</span>{" "}
						{(job.executionTimeMs / 1000).toFixed(1)}s
					</span>
				)}
				{job.phonemeDistance != null && (
					<span>
						<span className="font-medium text-foreground">
							Phoneme distance:
						</span>{" "}
						{job.phonemeDistance}
					</span>
				)}
				{job.abstentionReason && (
					<span className="text-amber-600">
						<span className="font-medium">Abstention:</span>{" "}
						{job.abstentionReason}
					</span>
				)}
			</div>

			{/* Audio players */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<WaveformPlayer
					src={`/api/audio/${job.referenceId}`}
					label="Reference Audio"
					phoneRegions={referenceRegions}
				/>
				<WaveformPlayer
					src={`/api/audio/user/${job.recordingId}`}
					label="User Recording"
					errorRegions={errorRegions}
					playRegion={playRegion ?? undefined}
				/>
			</div>

			{/* Diff viewer */}
			{isLoading ? (
				<div className="flex flex-col gap-2">
					<Skeleton className="h-6 w-32" />
					<Skeleton className="h-16 w-full" />
				</div>
			) : job.targetPhonemes && job.recognizedPhonemes != null ? (
				<DiffViewer
					target={job.targetPhonemes}
					recognized={job.recognizedPhonemes}
					errors={phonemeErrors as Parameters<typeof DiffViewer>[0]["errors"]}
					type="phoneme"
					audioSrc={`/api/audio/user/${job.recordingId}`}
					onSegmentClick={handleSegmentClick}
				/>
			) : job.abstentionReason ? null : (
				<p className="text-muted-foreground text-sm">
					No phoneme data available.
				</p>
			)}
		</div>
	);
}

function JobRow({ job }: { job: AdminJobRow }) {
	const [expanded, setExpanded] = useState(false);
	const score =
		job.overallScore != null
			? Math.round(Number(job.overallScore) * 100)
			: null;
	const shortUserId =
		job.userId.length > 20
			? `${job.userId.slice(0, 10)}…${job.userId.slice(-6)}`
			: job.userId;

	return (
		<div className="border-border/40 border-b last:border-0">
			{/* Summary row */}
			<button
				type="button"
				onClick={() => setExpanded((v) => !v)}
				className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-muted/10"
			>
				{/* Status icon */}
				<span className="shrink-0 text-muted-foreground">
					{job.analysisStatus === "completed" ? (
						<RiCheckboxCircleLine size={16} className="text-emerald-500" />
					) : job.analysisStatus === "failed" ? (
						<RiErrorWarningLine size={16} className="text-red-500" />
					) : job.analysisStatus === "processing" ? (
						<RiLoaderLine size={16} className="animate-spin text-blue-500" />
					) : (
						<RiTimeLine size={16} className="text-amber-500" />
					)}
				</span>

				{/* User ID */}
				<span
					className="w-36 shrink-0 truncate font-mono text-muted-foreground text-xs"
					title={job.userId}
				>
					{shortUserId}
				</span>

				{/* Practice text */}
				<span className="min-w-0 flex-1 truncate text-sm">
					{job.textContent}
				</span>

				{/* Score */}
				<span className="shrink-0">
					{score != null ? (
						<Badge
							variant="outline"
							className={cn("text-[11px]", scoreColor(score))}
						>
							{score}%
						</Badge>
					) : (
						<Badge
							variant="outline"
							className="text-[11px] text-muted-foreground"
						>
							—
						</Badge>
					)}
				</span>

				{/* Analysis status */}
				<span className="shrink-0">
					<Badge
						variant="outline"
						className={cn(
							"text-[11px]",
							analysisStatusColors[job.analysisStatus] ?? "",
						)}
					>
						{job.analysisStatus}
					</Badge>
				</span>

				{/* Job status (RunPod) */}
				{job.jobStatus && (
					<span className="hidden shrink-0 sm:block">
						<Badge
							variant="outline"
							className={cn(
								"text-[11px]",
								jobStatusColors[job.jobStatus] ?? "",
							)}
						>
							{job.jobStatus.replace("_", " ")}
						</Badge>
					</span>
				)}

				{/* Time */}
				<span className="w-20 shrink-0 text-right text-muted-foreground text-xs">
					{formatRelativeTime(new Date(job.analysisCreatedAt))}
				</span>

				{/* Expand chevron */}
				<RiArrowDownSLine
					size={16}
					className={cn(
						"shrink-0 text-muted-foreground transition-transform",
						expanded && "rotate-180",
					)}
				/>
			</button>

			{/* Detail panel */}
			{expanded && <JobRowDetail job={job} />}
		</div>
	);
}

function AdminJobs() {
	const {
		isAdmin,
		isAuthenticated,
		isLoading: authLoading,
	} = useRequireAdmin();
	const getJobsFn = useServerFn(serverGetAdminLatestJobs);

	const { data, isLoading, isError, refetch } = useQuery({
		queryKey: ["admin-jobs"],
		queryFn: async () => {
			const res = await getJobsFn();
			if (!res.success) throw new Error(res.error.message);
			return res.data;
		},
	});

	if (authLoading) return null;
	if (!isAuthenticated || !isAdmin) return <Navigate to="/login" />;

	const jobs = data ?? [];

	return (
		<AdminStatsLayout title="Jobs" description="Latest assessment jobs">
			<div className="flex items-center justify-between">
				<p className="text-muted-foreground text-sm">
					{isLoading ? "" : `${jobs.length} most recent jobs`}
				</p>
				<Button
					variant="outline"
					size="sm"
					onClick={() => refetch()}
					disabled={isLoading}
				>
					Refresh
				</Button>
			</div>

			{isLoading ? (
				<JobsSkeleton />
			) : isError ? (
				<p className="text-muted-foreground text-sm">Failed to load jobs.</p>
			) : jobs.length === 0 ? (
				<EmptyState
					title="No jobs yet"
					description="Assessment jobs will appear here once users start practicing."
				/>
			) : (
				<Card className="overflow-hidden bg-card/50">
					{/* Table header */}
					<div className="flex items-center gap-3 border-border/60 border-b bg-muted/30 px-5 py-2.5 text-[11px] text-muted-foreground uppercase tracking-wide">
						<span className="w-4 shrink-0" />
						<span className="w-36 shrink-0">User</span>
						<span className="min-w-0 flex-1">Practice Text</span>
						<span className="shrink-0">Score</span>
						<span className="shrink-0">Analysis</span>
						<span className="hidden shrink-0 sm:block">Job</span>
						<span className="w-20 shrink-0 text-right">When</span>
						<span className="w-4 shrink-0" />
					</div>

					{jobs.map((job) => (
						<JobRow key={job.analysisId} job={job} />
					))}
				</Card>
			)}
		</AdminStatsLayout>
	);
}
