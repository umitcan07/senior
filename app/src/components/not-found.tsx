import { RiArrowLeftLine, RiSearchLine } from "@remixicon/react";
import { Link } from "@tanstack/react-router";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";

export function NotFound() {
	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-8">
					<div className="flex min-h-[40vh] flex-col items-center justify-center gap-8 text-center">
						<div className="flex flex-col items-center gap-4">
							<div className="flex size-16 items-center justify-center rounded-full bg-muted">
								<RiSearchLine className="size-8 text-muted-foreground" />
							</div>
							<div className="flex flex-col items-center gap-2">
								<span className="font-mono text-muted-foreground text-sm">
									Error 404
								</span>
								<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-3xl text-transparent tracking-tight md:text-4xl">
									Page Not Found
								</h1>
							</div>
							<p className="max-w-md text-muted-foreground">
								The page you're looking for doesn't exist or has been moved.
								Let's get you back on track.
							</p>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<Button asChild>
								<Link to="/">
									<RiArrowLeftLine className="size-4" />
									Back to Home
								</Link>
							</Button>
							<Button variant="outline" asChild>
								<Link to="/practice">Browse Practice Texts</Link>
							</Button>
						</div>
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
