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

function AdminDashboard() {
	const { isAdmin, isAuthenticated, isLoading } = useRequireAdmin();

	if (isLoading) {
		return null; // Or show a loading spinner
	}

	if (!isAuthenticated || !isAdmin) {
		return <Navigate to="/login" />;
	}

	return (
		<MainLayout>
			<PageContainer>
				<div className="space-y-8">
					<PageHeader
						title="Admin Dashboard"
						description="Manage your application content and settings"
					/>

					<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
						{adminSections.map((section) => (
							<Link key={section.title} to={section.href}>
								<Card className="h-full transition-all duration-200 hover:border-primary/30">
									<CardContent className="p-6">
										<div className="space-y-2">
											<h3 className="font-semibold">{section.title}</h3>
											<p className="text-muted-foreground text-sm leading-relaxed">
												{section.description}
											</p>
										</div>
									</CardContent>
								</Card>
							</Link>
						))}
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}

const adminSections = [
	{
		title: "Practice Texts",
		description:
			"Create, edit, and manage practice texts for pronunciation exercises",
		href: "/admin/text",
	},
	{
		title: "Reference Speeches",
		description: "Upload and manage reference audio recordings",
		href: "/admin/references",
	},
	{
		title: "Authors",
		description: "Manage voices and authors for reference speeches",
		href: "/admin/authors",
	},
];
