import {
	RiBarChartLine,
	RiFileTextLine,
	RiGroupLine,
	RiMicLine,
	RiShieldCheckLine,
	RiStarLine,
} from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AdminStatsLayout } from "@/components/layout/admin-stats-layout";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAdmin } from "@/lib/auth";
import { serverGetOverviewStats } from "@/lib/server-admin-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/dashboard")({
	component: AdminDashboardStats,
});

function StatCard({
	icon: Icon,
	label,
	value,
	children,
}: {
	icon: React.ElementType;
	label: string;
	value: string | number;
	children?: React.ReactNode;
}) {
	return (
		<Card className="bg-card/50">
			<CardContent className="flex flex-col gap-3 p-5">
				<div className="flex items-center gap-2 text-muted-foreground">
					<Icon size={16} />
					<span className="text-xs uppercase tracking-wide">{label}</span>
				</div>
				<span className="font-semibold text-3xl tabular-nums">{value}</span>
				{children}
			</CardContent>
		</Card>
	);
}

function OverviewSkeleton() {
	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{Array.from({ length: 6 }).map((_, i) => (
				<Card key={i} className="bg-card/50">
					<CardContent className="flex flex-col gap-3 p-5">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-9 w-16" />
						<Skeleton className="h-4 w-full" />
					</CardContent>
				</Card>
			))}
		</div>
	);
}

const statusColors: Record<string, string> = {
	completed: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
	pending: "bg-amber-500/10 text-amber-600 border-amber-500/20",
	processing: "bg-blue-500/10 text-blue-600 border-blue-500/20",
	failed: "bg-red-500/10 text-red-600 border-red-500/20",
};

const difficultyColors: Record<string, string> = {
	beginner: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
	intermediate: "bg-amber-500/10 text-amber-600 border-amber-500/20",
	advanced: "bg-red-500/10 text-red-600 border-red-500/20",
};

const qualityColors: Record<string, string> = {
	accept: "bg-emerald-500",
	warning: "bg-amber-500",
	reject: "bg-red-500",
};

function AdminDashboardStats() {
	const { isAdmin, isAuthenticated, isLoading: authLoading } = useRequireAdmin();
	const getStatsFn = useServerFn(serverGetOverviewStats);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["admin-overview-stats"],
		queryFn: async () => {
			const result = await getStatsFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
	});

	if (authLoading) return null;
	if (!isAuthenticated || !isAdmin) return <Navigate to="/login" />;

	return (
		<AdminStatsLayout
			title="Dashboard"
			description="Platform overview and key metrics"
		>
			{isLoading ? (
				<OverviewSkeleton />
			) : isError || !data ? (
				<p className="text-muted-foreground text-sm">
					Failed to load statistics.
				</p>
			) : (
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{/* Total Users */}
					<StatCard
						icon={RiGroupLine}
						label="Total Users"
						value={data.totalUsers}
					/>

					{/* Analyses */}
					<StatCard
						icon={RiBarChartLine}
						label="Total Analyses"
						value={data.totalAnalyses}
					>
						<div className="flex flex-wrap gap-1.5">
							{data.analysesByStatus.map((s) => (
								<Badge
									key={s.status}
									variant="outline"
									className={cn(
										"text-[10px]",
										statusColors[s.status],
									)}
								>
									{s.status} {s.count}
								</Badge>
							))}
						</div>
					</StatCard>

					{/* Practice Texts */}
					<StatCard
						icon={RiFileTextLine}
						label="Practice Texts"
						value={data.totalTexts}
					>
						<div className="flex flex-wrap gap-1.5">
							{data.textsByDifficulty.map((d) => (
								<Badge
									key={d.difficulty}
									variant="outline"
									className={cn(
										"text-[10px]",
										difficultyColors[d.difficulty],
									)}
								>
									{d.difficulty} {d.count}
								</Badge>
							))}
						</div>
					</StatCard>

					{/* Reference Speeches */}
					<StatCard
						icon={RiMicLine}
						label="Reference Speeches"
						value={data.totalReferences}
					/>

					{/* Average Score */}
					<StatCard
						icon={RiStarLine}
						label="Average Score"
						value={`${data.averageScore}%`}
					>
						<Progress
							value={data.averageScore}
							className="h-2"
						/>
					</StatCard>

					{/* Audio Quality */}
					<StatCard
						icon={RiShieldCheckLine}
						label="Audio Quality"
						value={data.audioQualityDistribution.reduce(
							(sum, q) => sum + q.count,
							0,
						)}
					>
						{data.audioQualityDistribution.length > 0 && (
							<div className="flex flex-col gap-2">
								<div className="flex h-2 overflow-hidden rounded-full bg-muted">
									{(() => {
										const total =
											data.audioQualityDistribution.reduce(
												(sum, q) => sum + q.count,
												0,
											);
										return data.audioQualityDistribution.map(
											(q) => (
												<div
													key={q.status}
													className={cn(
														qualityColors[q.status],
													)}
													style={{
														width: `${total > 0 ? (q.count / total) * 100 : 0}%`,
													}}
												/>
											),
										);
									})()}
								</div>
								<div className="flex gap-3 text-[10px] text-muted-foreground">
									{data.audioQualityDistribution.map((q) => (
										<span key={q.status} className="flex items-center gap-1">
											<span
												className={cn(
													"inline-block size-2 rounded-full",
													qualityColors[q.status],
												)}
											/>
											{q.status} ({q.count})
										</span>
									))}
								</div>
							</div>
						)}
					</StatCard>
				</div>
			)}
		</AdminStatsLayout>
	);
}
