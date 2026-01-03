import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { FileText, Mic, Users } from "lucide-react";
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
		icon: FileText,
	},
	{
		title: "Reference Speeches",
		description: "Upload and manage reference audio recordings",
		href: "/admin/references",
		icon: Mic,
	},
	{
		title: "Authors",
		description: "Manage voices and authors for reference speeches",
		href: "/admin/authors",
		icon: Users,
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

					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
				</div>
			</PageContainer>
		</MainLayout>
	);
}
