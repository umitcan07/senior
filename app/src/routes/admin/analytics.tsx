import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { AdminStatsLayout } from "@/components/layout/admin-stats-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAdmin } from "@/lib/auth";
import {
	serverGetAnalyticsData,
	type AnalyticsData,
} from "@/lib/server-admin-stats";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/admin/analytics")({
	component: AdminAnalytics,
});

function SectionCard({
	title,
	children,
	className,
}: {
	title: string;
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<Card className={cn("bg-card/50", className)}>
			<CardContent className="flex flex-col gap-4 p-5">
				<h3 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
					{title}
				</h3>
				{children}
			</CardContent>
		</Card>
	);
}

function AnalyticsSkeleton() {
	return (
		<div className="flex flex-col gap-6">
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Skeleton className="h-80" />
				<Skeleton className="h-80" />
			</div>
			<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
				<Skeleton className="h-64" />
				<Skeleton className="h-64" />
			</div>
			<Skeleton className="h-24" />
		</div>
	);
}

function ScoreDistributionChart({
	data,
}: {
	data: AnalyticsData["scoreDistribution"];
}) {
	return (
		<ResponsiveContainer width="100%" height={250}>
			<BarChart data={data}>
				<CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
				<XAxis
					dataKey="range"
					className="text-xs"
					tick={{ fill: "hsl(var(--muted-foreground))" }}
				/>
				<YAxis
					className="text-xs"
					tick={{ fill: "hsl(var(--muted-foreground))" }}
					allowDecimals={false}
				/>
				<Tooltip
					contentStyle={{
						backgroundColor: "hsl(var(--card))",
						border: "1px solid hsl(var(--border))",
						borderRadius: "8px",
						fontSize: "12px",
					}}
				/>
				<Bar
					dataKey="count"
					fill="hsl(var(--primary))"
					radius={[4, 4, 0, 0]}
					name="Analyses"
				/>
			</BarChart>
		</ResponsiveContainer>
	);
}

function AnalysesOverTimeChart({
	data,
}: {
	data: AnalyticsData["analysesOverTime"];
}) {
	const formatted = data.map((d) => ({
		...d,
		date: new Date(d.date).toLocaleDateString("en-US", {
			month: "short",
			day: "numeric",
		}),
	}));

	return (
		<ResponsiveContainer width="100%" height={250}>
			<AreaChart data={formatted}>
				<CartesianGrid strokeDasharray="3 3" className="stroke-border/40" />
				<XAxis
					dataKey="date"
					className="text-xs"
					tick={{ fill: "hsl(var(--muted-foreground))" }}
				/>
				<YAxis
					className="text-xs"
					tick={{ fill: "hsl(var(--muted-foreground))" }}
					allowDecimals={false}
				/>
				<Tooltip
					contentStyle={{
						backgroundColor: "hsl(var(--card))",
						border: "1px solid hsl(var(--border))",
						borderRadius: "8px",
						fontSize: "12px",
					}}
				/>
				<Area
					type="monotone"
					dataKey="count"
					stroke="hsl(var(--primary))"
					fill="hsl(var(--primary))"
					fillOpacity={0.1}
					name="Analyses"
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}

function PhonemeErrorsTable({
	errors,
}: {
	errors: AnalyticsData["topPhonemeErrors"];
}) {
	if (errors.length === 0) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				No phoneme error data available.
			</p>
		);
	}

	const maxCount = Math.max(...errors.map((e) => e.count));

	return (
		<div className="flex flex-col gap-2">
			{errors.map((error, i) => (
				<div
					key={error.expected}
					className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/20"
				>
					<span className="w-5 text-muted-foreground text-xs">{i + 1}</span>
					<span className="w-10 font-ipa text-lg">{error.expected}</span>
					<div className="flex-1">
						<div
							className="h-2 rounded-full bg-primary/20"
							style={{
								width: `${(error.count / maxCount) * 100}%`,
							}}
						/>
					</div>
					<span className="w-10 text-right text-muted-foreground text-xs tabular-nums">
						{error.count}
					</span>
				</div>
			))}
		</div>
	);
}

function PhonemeConfusionsTable({
	confusions,
}: {
	confusions: AnalyticsData["topPhonemeConfusions"];
}) {
	if (confusions.length === 0) {
		return (
			<p className="py-8 text-center text-muted-foreground text-sm">
				No confusion data available.
			</p>
		);
	}

	const maxCount = Math.max(...confusions.map((c) => c.count));

	return (
		<div className="flex flex-col gap-2">
			{confusions.map((c, i) => (
				<div
					key={`${c.expected}-${c.actual}`}
					className="flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-muted/20"
				>
					<span className="w-5 text-muted-foreground text-xs">{i + 1}</span>
					<span className="flex w-24 items-center gap-2 font-ipa text-lg">
						<span className="text-red-500">{c.expected}</span>
						<span className="text-muted-foreground text-xs">→</span>
						<span className="text-amber-500">{c.actual}</span>
					</span>
					<div className="flex-1">
						<div
							className="h-2 rounded-full bg-red-500/20"
							style={{
								width: `${(c.count / maxCount) * 100}%`,
							}}
						/>
					</div>
					<span className="w-10 text-right text-muted-foreground text-xs tabular-nums">
						{c.count}
					</span>
				</div>
			))}
		</div>
	);
}

function formatMs(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	return `${(ms / 1000).toFixed(1)}s`;
}

function ProcessingTimeCards({
	stats,
}: {
	stats: AnalyticsData["processingTime"];
}) {
	const items = [
		{ label: "Average", value: formatMs(stats.avgMs) },
		{ label: "Median", value: formatMs(stats.medianMs) },
		{ label: "Min", value: formatMs(stats.minMs) },
		{ label: "Max", value: formatMs(stats.maxMs) },
	];

	return (
		<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
			{items.map((item) => (
				<div
					key={item.label}
					className="flex flex-col gap-1 rounded-lg border border-border/40 bg-muted/10 p-3"
				>
					<span className="text-[10px] text-muted-foreground uppercase tracking-wide">
						{item.label}
					</span>
					<span className="font-medium text-lg tabular-nums">
						{item.value}
					</span>
				</div>
			))}
		</div>
	);
}

function AdminAnalytics() {
	const { isAdmin, isAuthenticated, isLoading: authLoading } = useRequireAdmin();
	const getAnalyticsFn = useServerFn(serverGetAnalyticsData);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["admin-analytics"],
		queryFn: async () => {
			const result = await getAnalyticsFn();
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
			title="Analytics"
			description="Detailed analysis of pronunciation assessment data"
		>
			{isLoading ? (
				<AnalyticsSkeleton />
			) : isError || !data ? (
				<p className="text-muted-foreground text-sm">
					Failed to load analytics data.
				</p>
			) : (
				<div className="flex flex-col gap-6">
					{/* Charts Row */}
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<SectionCard title="Score Distribution">
							<ScoreDistributionChart
								data={data.scoreDistribution}
							/>
						</SectionCard>
						<SectionCard title="Analyses Over Time (30 days)">
							<AnalysesOverTimeChart
								data={data.analysesOverTime}
							/>
						</SectionCard>
					</div>

					{/* Phoneme Tables Row */}
					<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
						<SectionCard title="Most Common Phoneme Errors">
							<PhonemeErrorsTable
								errors={data.topPhonemeErrors}
							/>
						</SectionCard>
						<SectionCard title="Phoneme Confusions (Expected → Actual)">
							<PhonemeConfusionsTable
								confusions={data.topPhonemeConfusions}
							/>
						</SectionCard>
					</div>

					{/* Processing Time */}
					<SectionCard title="Processing Time">
						<ProcessingTimeCards stats={data.processingTime} />
					</SectionCard>
				</div>
			)}
		</AdminStatsLayout>
	);
}
