import {
	RiArrowLeftLine,
	RiBarChartLine,
	RiDashboardLine,
	RiGroupLine,
	RiListCheck3,
} from "@remixicon/react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MainLayout, PageContainer, PageHeader } from "./main-layout";

const navItems = [
	{ label: "Overview", href: "/admin/dashboard", icon: RiDashboardLine },
	{ label: "Analytics", href: "/admin/analytics", icon: RiBarChartLine },
	{ label: "Users", href: "/admin/users", icon: RiGroupLine },
	{ label: "Jobs", href: "/admin/jobs", icon: RiListCheck3 },
];

interface AdminStatsLayoutProps {
	children: React.ReactNode;
	title: string;
	description?: string;
	className?: string;
}

export function AdminStatsLayout({
	children,
	title,
	description,
	className,
}: AdminStatsLayoutProps) {
	const routerState = useRouterState();
	const currentPath = routerState.location.pathname;

	return (
		<MainLayout>
			<PageContainer>
				<div className={cn("flex flex-col gap-6", className)}>
					{/* Back Button */}
					<Link to="/admin">
						<Button
							variant="ghost"
							size="sm"
							className="gap-2 text-muted-foreground hover:text-foreground"
						>
							<RiArrowLeftLine size={16} />
							Back to Admin
						</Button>
					</Link>

					{/* Header */}
					<PageHeader title={title} description={description} />

					{/* Navigation Tabs */}
					<nav className="flex gap-1 border-b border-border/40">
						{navItems.map((item) => {
							const Icon = item.icon;
							const isActive =
								item.href === "/admin/dashboard"
									? currentPath === "/admin/dashboard" ||
										currentPath === "/admin/dashboard/"
									: currentPath.startsWith(item.href);

							return (
								<Link
									key={item.href}
									to={item.href}
									className={cn(
										"flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm transition-colors",
										isActive
											? "border-primary font-medium text-primary"
											: "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
									)}
								>
									<Icon size={16} />
									{item.label}
								</Link>
							);
						})}
					</nav>

					{/* Content */}
					{children}
				</div>
			</PageContainer>
		</MainLayout>
	);
}
