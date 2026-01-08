import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	ArrowLeftIcon,
	CheckCircle2Icon,
	ClockIcon,
	Loader2Icon,
	PlayIcon,
	RefreshCwIcon,
	XCircleIcon,
} from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { z } from "zod";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { pageVariants } from "@/components/ui/animations";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// Zod schemas for API responses
const JobSchema = z.object({
	id: z.string(),
	externalJobId: z.string(),
	status: z.enum(["in_queue", "in_progress", "completed", "failed"]),
	result: z.record(z.string(), z.unknown()).nullable(),
	error: z.string().nullable(),
	executionTimeMs: z.number().nullable(),
	delayTimeMs: z.number().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});

const JobsResponseSchema = z.object({
	success: z.boolean(),
	data: z.array(JobSchema),
});

const SingleJobResponseSchema = z.object({
	success: z.boolean(),
	data: JobSchema,
});

const SubmitJobResponseSchema = z.object({
	success: z.boolean(),
	data: z.object({
		id: z.string(),
		externalJobId: z.string(),
		status: z.string(),
	}),
});

type Job = z.infer<typeof JobSchema>;

export const Route = createFileRoute("/jobs")({
	component: JobsPage,
});

function StatusBadge({ status }: { status: Job["status"] }) {
	const config = {
		in_queue: {
			icon: <ClockIcon className="size-3" />,
			label: "In Queue",
			className: "bg-yellow-500/10 text-yellow-600 ring-yellow-500/20",
		},
		in_progress: {
			icon: <Loader2Icon className="size-3 animate-spin" />,
			label: "Processing",
			className: "bg-blue-500/10 text-blue-600 ring-blue-500/20",
		},
		completed: {
			icon: <CheckCircle2Icon className="size-3" />,
			label: "Completed",
			className: "bg-green-500/10 text-green-600 ring-green-500/20",
		},
		failed: {
			icon: <XCircleIcon className="size-3" />,
			label: "Failed",
			className: "bg-red-500/10 text-red-600 ring-red-500/20",
		},
	}[status];

	return (
		<span
			className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs ring-1 ring-inset ${config.className}`}
		>
			{config.icon}
			{config.label}
		</span>
	);
}

function JobsPage() {
	const queryClient = useQueryClient();
	const [autoRefresh, setAutoRefresh] = useState(false);

	// Fetch all jobs
	const jobsQuery = useQuery({
		queryKey: ["jobs"],
		queryFn: async () => {
			const response = await fetch("/api/jobs");
			const data = await response.json();
			const result = JobsResponseSchema.safeParse(data);
			if (!result.success) {
				throw new Error("Invalid response from server");
			}
			return result.data.data;
		},
		refetchInterval: autoRefresh ? 2000 : false,
	});

	// Submit new job mutation
	const submitMutation = useMutation({
		mutationFn: async () => {
			const response = await fetch("/api/jobs", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ input: { test: true } }),
			});
			const data = await response.json();
			const result = SubmitJobResponseSchema.safeParse(data);
			if (!result.success) {
				throw new Error("Invalid response from server");
			}
			return result.data.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["jobs"] });
		},
	});

	// Refresh single job mutation
	const refreshMutation = useMutation({
		mutationFn: async (jobId: string) => {
			const response = await fetch(`/api/jobs/${jobId}`);
			const data = await response.json();
			const result = SingleJobResponseSchema.safeParse(data);
			if (!result.success) {
				throw new Error("Invalid response from server");
			}
			return result.data.data;
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["jobs"] });
		},
	});

	return (
		<MainLayout>
			<motion.div
				variants={pageVariants}
				initial="initial"
				animate="animate"
				exit="exit"
			>
				<PageContainer>
					<div className="flex flex-col gap-6">
						{/* Header */}
						<div className="flex items-center gap-4">
							<Button variant="ghost" size="icon" asChild>
								<Link to="/">
									<ArrowLeftIcon className="size-4" />
								</Link>
							</Button>
							<div className="flex-1">
								<h1 className="font-semibold text-2xl">Jobs Dashboard</h1>
								<p className="text-muted-foreground text-sm">
									Test RunPod simulation flow
								</p>
							</div>
						</div>

						{/* Controls */}
						<div className="flex flex-wrap items-center gap-3">
							<Button
								onClick={() => submitMutation.mutate()}
								disabled={submitMutation.isPending}
							>
								{submitMutation.isPending ? (
									<Loader2Icon className="mr-2 size-4 animate-spin" />
								) : (
									<PlayIcon className="mr-2 size-4" />
								)}
								Submit New Job
							</Button>
							<Button
								variant="outline"
								onClick={() => jobsQuery.refetch()}
								disabled={jobsQuery.isFetching}
							>
								<RefreshCwIcon
									className={`mr-2 size-4 ${jobsQuery.isFetching ? "animate-spin" : ""}`}
								/>
								Refresh All
							</Button>
							<div className="flex items-center gap-2">
								<Checkbox
									id="auto-refresh"
									checked={autoRefresh}
									onCheckedChange={(checked) =>
										setAutoRefresh(checked === true)
									}
								/>
								<Label
									htmlFor="auto-refresh"
									className="cursor-pointer text-sm"
								>
									Auto-refresh (2s)
								</Label>
							</div>
						</div>

						{/* Jobs Table */}
						<div className="rounded-xl border bg-card">
							<div className="overflow-x-auto">
								<table className="w-full text-sm">
									<thead>
										<tr className="border-b bg-muted/50">
											<th className="px-4 py-3 text-left font-medium">
												External ID
											</th>
											<th className="px-4 py-3 text-left font-medium">
												Status
											</th>
											<th className="px-4 py-3 text-left font-medium">
												Result / Error
											</th>
											<th className="px-4 py-3 text-left font-medium">
												Timing
											</th>
											<th className="px-4 py-3 text-right font-medium">
												Actions
											</th>
										</tr>
									</thead>
									<tbody>
										{jobsQuery.isLoading && (
											<tr>
												<td colSpan={5} className="px-4 py-8 text-center">
													<Loader2Icon className="mx-auto size-6 animate-spin text-muted-foreground" />
												</td>
											</tr>
										)}
										{jobsQuery.data?.length === 0 && (
											<tr>
												<td
													colSpan={5}
													className="px-4 py-8 text-center text-muted-foreground"
												>
													No jobs yet. Click "Submit New Job" to get started.
												</td>
											</tr>
										)}
										{jobsQuery.data?.map((job) => (
											<tr key={job.id} className="border-b last:border-0">
												<td className="px-4 py-3">
													<code className="rounded bg-muted px-1.5 py-0.5 text-xs">
														{job.externalJobId.slice(0, 12)}...
													</code>
												</td>
												<td className="px-4 py-3">
													<StatusBadge status={job.status} />
												</td>
												<td className="px-4 py-3">
													{job.status === "completed" && job.result ? (
														<code className="text-green-600 text-xs">
															{JSON.stringify(job.result)}
														</code>
													) : null}
													{job.status === "failed" && job.error ? (
														<span className="text-red-600 text-xs">
															{job.error}
														</span>
													) : null}
													{job.status === "completed" &&
													job.result &&
													"error" in job.result ? (
														<span className="text-orange-600 text-xs">
															App Error: {String(job.result.error)}
														</span>
													) : null}
												</td>
												<td className="px-4 py-3 text-muted-foreground text-xs">
													{job.executionTimeMs !== null && (
														<span>Exec: {job.executionTimeMs}ms</span>
													)}
													{job.delayTimeMs !== null && (
														<span className="ml-2">
															Delay: {job.delayTimeMs}ms
														</span>
													)}
												</td>
												<td className="px-4 py-3 text-right">
													<Button
														variant="ghost"
														size="sm"
														onClick={() => refreshMutation.mutate(job.id)}
														disabled={
															refreshMutation.isPending ||
															job.status === "completed" ||
															job.status === "failed"
														}
													>
														<RefreshCwIcon
															className={`size-3 ${refreshMutation.isPending ? "animate-spin" : ""}`}
														/>
													</Button>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				</PageContainer>
			</motion.div>
		</MainLayout>
	);
}
