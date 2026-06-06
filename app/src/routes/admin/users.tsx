import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AdminStatsLayout } from "@/components/layout/admin-stats-layout";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequireAdmin } from "@/lib/auth";
import { serverGetUserActivity } from "@/lib/server-admin-stats";
import { formatRelativeTime } from "@/lib/utils";

export const Route = createFileRoute("/admin/users")({
	component: AdminUsers,
});

const ITEMS_PER_PAGE = 10;

function getScoreBadge(score: number | null) {
	if (score === null) {
		return (
			<Badge variant="outline" className="text-muted-foreground">
				N/A
			</Badge>
		);
	}
	if (score >= 80) {
		return (
			<Badge
				variant="outline"
				className="border-emerald-500/20 bg-emerald-500/10 text-emerald-600"
			>
				{score}%
			</Badge>
		);
	}
	if (score >= 40) {
		return (
			<Badge
				variant="outline"
				className="border-amber-500/20 bg-amber-500/10 text-amber-600"
			>
				{score}%
			</Badge>
		);
	}
	return (
		<Badge
			variant="outline"
			className="border-red-500/20 bg-red-500/10 text-red-600"
		>
			{score}%
		</Badge>
	);
}

function UsersSkeleton() {
	return (
		<Card className="bg-card/50">
			<div className="flex flex-col">
				{Array.from({ length: 5 }).map((_, i) => (
					<div key={i} className="flex items-center gap-4 border-b border-border/40 px-5 py-4">
						<Skeleton className="h-4 w-40" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-4 w-16" />
						<Skeleton className="h-6 w-14" />
						<Skeleton className="ml-auto h-4 w-20" />
					</div>
				))}
			</div>
		</Card>
	);
}

function AdminUsers() {
	const { isAdmin, isAuthenticated, isLoading: authLoading } = useRequireAdmin();
	const getUsersFn = useServerFn(serverGetUserActivity);
	const [currentPage, setCurrentPage] = useState(1);

	const { data, isLoading, isError } = useQuery({
		queryKey: ["admin-users"],
		queryFn: async () => {
			const result = await getUsersFn();
			if (!result.success) {
				throw new Error(result.error.message);
			}
			return result.data;
		},
	});

	if (authLoading) return null;
	if (!isAuthenticated || !isAdmin) return <Navigate to="/login" />;

	const users = data ?? [];
	const totalPages = Math.ceil(users.length / ITEMS_PER_PAGE);
	const currentUsers = users.slice(
		(currentPage - 1) * ITEMS_PER_PAGE,
		currentPage * ITEMS_PER_PAGE,
	);

	return (
		<AdminStatsLayout
			title="Users"
			description="User activity and performance overview"
		>
			{isLoading ? (
				<UsersSkeleton />
			) : isError ? (
				<p className="text-muted-foreground text-sm">
					Failed to load user data.
				</p>
			) : users.length === 0 ? (
				<EmptyState
					title="No users yet"
					description="User activity will appear here once users start practicing."
				/>
			) : (
				<div className="flex flex-col gap-6">
					<Card className="bg-card/50 overflow-hidden">
						{/* Table Header */}
						<div className="flex items-center gap-4 border-b border-border/60 bg-muted/30 px-5 py-3 text-[11px] text-muted-foreground uppercase tracking-wide">
							<span className="min-w-0 flex-1">User ID</span>
							<span className="w-24 text-center">Recordings</span>
							<span className="w-24 text-center">Analyses</span>
							<span className="w-24 text-center">Avg Score</span>
							<span className="w-28 text-right">Last Active</span>
						</div>

						{/* Table Rows */}
						{currentUsers.map((user) => (
							<div
								key={user.userId}
								className="flex items-center gap-4 border-b border-border/40 px-5 py-3.5 transition-colors last:border-0 hover:bg-muted/10"
							>
								<span
									className="min-w-0 flex-1 truncate font-mono text-sm"
									title={user.userId}
								>
									{user.userId.length > 24
										? `${user.userId.slice(0, 12)}...${user.userId.slice(-8)}`
										: user.userId}
								</span>
								<span className="w-24 text-center text-sm tabular-nums">
									{user.totalRecordings}
								</span>
								<span className="w-24 text-center text-sm tabular-nums">
									{user.totalAnalyses}
								</span>
								<span className="flex w-24 justify-center">
									{getScoreBadge(user.averageScore)}
								</span>
								<span className="w-28 text-right text-muted-foreground text-xs">
									{formatRelativeTime(new Date(user.lastActiveDate))}
								</span>
							</div>
						))}
					</Card>

					{/* Pagination */}
					{totalPages > 1 && (
						<Pagination>
							<PaginationContent>
								<PaginationItem>
									<PaginationPrevious
										onClick={() =>
											setCurrentPage(Math.max(1, currentPage - 1))
										}
										className={
											currentPage === 1
												? "pointer-events-none opacity-50"
												: "cursor-pointer"
										}
									/>
								</PaginationItem>

								{Array.from({ length: totalPages }).map((_, i) => (
									<PaginationItem key={i}>
										<PaginationLink
											isActive={currentPage === i + 1}
											onClick={() => setCurrentPage(i + 1)}
											className="cursor-pointer"
										>
											{i + 1}
										</PaginationLink>
									</PaginationItem>
								))}

								<PaginationItem>
									<PaginationNext
										onClick={() =>
											setCurrentPage(
												Math.min(totalPages, currentPage + 1),
											)
										}
										className={
											currentPage === totalPages
												? "pointer-events-none opacity-50"
												: "cursor-pointer"
										}
									/>
								</PaginationItem>
							</PaginationContent>
						</Pagination>
					)}
				</div>
			)}
		</AdminStatsLayout>
	);
}
