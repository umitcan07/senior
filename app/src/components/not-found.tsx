import { Link } from "@tanstack/react-router";
import { ArrowLeft, Ghost } from "lucide-react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";

export function NotFound() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
					<div className="flex size-20 items-center justify-center rounded-full bg-muted">
						<Ghost size={40} className="text-muted-foreground" />
					</div>

					<div className="space-y-3">
						<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-3xl text-transparent tracking-tight md:text-4xl">
							Page Not Found
						</h1>
						<p className="max-w-md text-muted-foreground">
							The page you're looking for doesn't exist or has been moved. Let's
							get you back on track.
						</p>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row">
						<Button asChild>
							<Link to="/">
								<ArrowLeft size={16} className="mr-2" />
								Back to Home
							</Link>
						</Button>
						<Button variant="outline" asChild>
							<Link to="/practice">Browse Practice Texts</Link>
						</Button>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
