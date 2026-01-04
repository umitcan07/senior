import type { ErrorComponentProps } from "@tanstack/react-router";
import { Link, useRouter } from "@tanstack/react-router";
import { AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react";
import { MainLayout, PageContainer } from "@/components/layout/main-layout";
import { Button } from "@/components/ui/button";

interface GlobalErrorProps extends Partial<ErrorComponentProps> {
	title?: string;
	message?: string;
}

export function GlobalError({ error, title, message }: GlobalErrorProps) {
	const router = useRouter();

	const errorMessage =
		message ||
		(error instanceof Error ? error.message : "An unexpected error occurred");
	const errorTitle = title || "Something went wrong";

	const handleRetry = () => {
		router.invalidate();
	};

	return (
		<MainLayout>
			<PageContainer>
				<div className="flex flex-col gap-8">
					<div className="flex min-h-[40vh] flex-col items-center justify-center gap-8 text-center">
						<div className="flex flex-col items-center gap-4">
							<div className="flex size-16 items-center justify-center rounded-full bg-destructive/5">
								<AlertTriangle className="size-6 text-destructive" />
							</div>
							<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-3xl text-transparent tracking-tight md:text-4xl">
								{errorTitle}
							</h1>
							<code className="wrap-anywhere max-w-xl rounded-lg bg-muted p-2 text-muted-foreground text-xs">
								{errorMessage}
							</code>
						</div>

						<div className="flex flex-col gap-3 sm:flex-row">
							<Button onClick={handleRetry}>
								<RefreshCw className="size-4" />
								Try Again
							</Button>
							<Button variant="outline" asChild>
								<Link to="/">
									<ArrowLeft className="size-4" />
									Back to Home
								</Link>
							</Button>
						</div>

						{process.env.NODE_ENV === "development" && error && (
							<details className="mt-4 w-full max-w-2xl text-left">
								<summary className="cursor-pointer text-muted-foreground text-sm">
									Error Details (Development Only)
								</summary>
								<pre className="mt-2 overflow-auto rounded-lg bg-muted p-4 font-mono text-xs">
									{error instanceof Error
										? `${error.name}: ${error.message}\n\n${error.stack}`
										: JSON.stringify(error, null, 2)}
								</pre>
							</details>
						)}
					</div>
				</div>
			</PageContainer>
		</MainLayout>
	);
}
