import { SignedIn, SignIn } from "@clerk/tanstack-react-start";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { NonceLogo } from "@/components/ui/nonce";
import { ThemeToggle } from "@/components/ui/theme-toggle";

export const Route = createFileRoute("/login")({
	component: LoginPage,
});

function LoginPage() {
	return (
		<>
			<SignedIn>
				<Navigate to="/" />
			</SignedIn>
			<div className="flex min-h-screen flex-col bg-linear-to-b from-background to-muted/20">
				{/* Minimal Header */}
				<header className="flex items-center justify-between px-6 py-4">
					<NonceLogo height={22} />
					<ThemeToggle />
				</header>

				{/* Login Content */}
				<main className="flex flex-1 items-center justify-center px-6 py-12">
					<div className="w-full max-w-sm space-y-8">
						<div className="text-center">
							<h1 className="bg-linear-to-b from-foreground to-foreground/70 bg-clip-text font-display font-semibold text-2xl text-transparent tracking-tight">
								Welcome back
							</h1>
							<p className="mt-2 text-muted-foreground text-sm">
								Sign in to access your pronunciation practice
							</p>
						</div>

						<SignIn
							routing="hash"
							appearance={{
								elements: {
									rootBox: "w-full",
									card: "shadow-none border-0 bg-transparent",
								},
							}}
						/>
					</div>
				</main>
			</div>
		</>
	);
}
