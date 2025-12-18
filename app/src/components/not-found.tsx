import { Link } from "@tanstack/react-router";

import { ArrowLeft } from "lucide-react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";

export function NotFound() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
					<div className="flex flex-col items-center gap-4">
						<div className="rounded-full px-5 py-2 font-medium text-3xl text-foreground ring-1 ring-accent/20">
							404
						</div>
						<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-3xl text-transparent tracking-tight md:text-4xl">
							There seems to be nothing here...
						</h1>
						<p className="max-w-md text-muted-foreground">
							The page you're looking for doesn't exist or has been moved. Let's
							get you back on track.
						</p>
					</div>

					<div className="flex flex-col gap-3 sm:flex-row">
						<Button asChild>
							<Link to="/">
								<ArrowLeft />
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
