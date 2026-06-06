import {
	RiBarChartLine,
	RiDashboardLine,
	RiFileTextLine,
	RiGroupLine,
	RiMicLine,
	RiTeamLine,
} from "@remixicon/react";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";
import { useRequireAdmin } from "@/lib/auth";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboard,
});

const adminSections = [
	{
		title: "Practice Texts",
		description:
			"Create, edit, and manage practice texts for pronunciation exercises",
		href: "/admin/text",
		icon: RiFileTextLine,
	},
	{
		title: "Reference Speeches",
		description: "Upload and manage reference audio recordings",
		href: "/admin/references",
		icon: RiMicLine,
	},
	{
		title: "Authors",
		description: "Manage voices and authors for reference speeches",
		href: "/admin/authors",
		icon: RiTeamLine,
	},
];

const analyticsSection = [
	{
		title: "Dashboard",
		description: "Platform overview with key metrics and statistics",
		href: "/admin/dashboard",
		icon: RiDashboardLine,
	},
	{
		title: "Analytics",
		description:
			"Score distribution, phoneme errors, and performance insights",
		href: "/admin/analytics",
		icon: RiBarChartLine,
	},
	{
		title: "Users",
		description: "User activity, recordings, and score overview",
		href: "/admin/users",
		icon: RiGroupLine,
	},
];

function AdminDashboard() {
	const { isAdmin, isAuthenticated, isLoading } = useRequireAdmin();

	if (isLoading) {
		return null;
	}

	if (!isAuthenticated || !isAdmin) {
		return <Navigate to="/login" />;
	}

	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-8">
					<PageHeader
						title="Admin Dashboard"
						description="Manage your application content and settings"
					/>

					<h2 className="font-medium text-muted-foreground text-sm uppercase tracking-wide">
						Content Management
					</h2>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{adminSections.map((section) => {
							const Icon = section.icon;
							return (
								<Link key={section.title} to={section.href}>
									<Card className="group h-full transition-colors">
										<CardContent className="flex flex-col gap-4 p-6">
											<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
												<Icon size={20} />
											</div>
											<div className="flex flex-col gap-1">
												<h3 className="font-semibold">{section.title}</h3>
												<p className="text-muted-foreground text-sm leading-relaxed">
													{section.description}
												</p>
											</div>
										</CardContent>
									</Card>
								</Link>
							);
						})}
					</div>

					<h2 className="mt-4 font-medium text-muted-foreground text-sm uppercase tracking-wide">
						Analytics & Insights
					</h2>
					<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
						{analyticsSection.map((section) => {
							const Icon = section.icon;
							return (
								<Link key={section.title} to={section.href}>
									<Card className="group h-full transition-colors">
										<CardContent className="flex flex-col gap-4 p-6">
											<div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
												<Icon size={20} />
											</div>
											<div className="flex flex-col gap-1">
												<h3 className="font-semibold">{section.title}</h3>
												<p className="text-muted-foreground text-sm leading-relaxed">
													{section.description}
												</p>
											</div>
										</CardContent>
									</Card>
								</Link>
							);
						})}
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
