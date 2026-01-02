import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MainLayout, PageContainer, PageHeader } from "./main-layout";

interface AdminLayoutProps {
	children: React.ReactNode;
	title: string;
	description?: string;
	headerActions?: React.ReactNode;
	className?: string;
}

export function AdminLayout({
	children,
	title,
	description,
	headerActions,
	className,
}: AdminLayoutProps) {
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
							<ArrowLeft size={16} />
							Back to Dashboard
						</Button>
					</Link>

					{/* Page Header */}
					<PageHeader title={title} description={description}>
						{headerActions}
					</PageHeader>

					{/* Content */}
					{children}
				</div>
			</PageContainer>
		</MainLayout>
	);
}
