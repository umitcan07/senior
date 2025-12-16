import { createFileRoute, Link } from "@tanstack/react-router";
import {
	MainLayout,
	PageContainer,
	PageHeader,
} from "@/components/layout/main-layout";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/admin/")({
	component: AdminDashboard,
});

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
	{
		title: "Settings",
		description: "Configure application settings and preferences",
		href: "/admin/settings",
		disabled: true,
	},
];

function AdminDashboard() {
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
							<Link
								key={section.title}
								to={section.disabled ? undefined : section.href}
								className={section.disabled ? "pointer-events-none" : ""}
							>
								<Card
									className={`h-full transition-all duration-200 ${
										section.disabled
											? "opacity-50"
											: "hover:border-primary/30 hover:shadow-md"
									}`}
								>
									<CardContent className="p-6">
										<div className="space-y-2">
											<h3 className="font-semibold">
												{section.title}
												{section.disabled && (
													<span className="ml-2 font-normal text-muted-foreground text-xs">
														Coming soon
													</span>
												)}
											</h3>
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
