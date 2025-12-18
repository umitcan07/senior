import { Protect, SignedIn, SignedOut } from "@clerk/clerk-react";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { ShieldX } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/admin")({
	component: AdminLayout,
});

function AdminLayout() {
	const navigate = useNavigate();

	return (
		<>
			<SignedOut>
				<div className="flex min-h-screen items-center justify-center bg-linear-to-b from-background to-muted/20 p-6">
					<EmptyState
						icon={<ShieldX size={20} />}
						title="Authentication Required"
						description="You need to sign in to access the admin area."
						primaryAction={{
							label: "Sign In",
							onClick: () => navigate({ to: "/" }),
						}}
					/>
				</div>
			</SignedOut>
			<SignedIn>
				<Protect
					condition={(has) => true}
					fallback={
						<div className="flex min-h-screen items-center justify-center bg-linear-to-b from-background to-muted/20 p-6">
							<EmptyState
								icon={<ShieldX size={20} />}
								title="Access Denied"
								description="You don't have permission to access the admin area. Please contact an administrator if you believe this is an error."
								primaryAction={{
									label: "Go Home",
									onClick: () => navigate({ to: "/" }),
								}}
							/>
						</div>
					}
				>
					<Outlet />
				</Protect>
			</SignedIn>
		</>
	);
}
