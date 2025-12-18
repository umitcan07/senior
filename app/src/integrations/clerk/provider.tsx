import { ClerkProvider } from "@clerk/clerk-react";
import { shadcn } from "@clerk/themes";

// Handle both client-side (import.meta.env) and server-side (process.env) contexts
function getClerkPublishableKey(): string | undefined {
	// Client-side: Vite replaces import.meta.env.VITE_* at build time
	if (typeof import.meta !== "undefined" && import.meta.env) {
		return import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
	}
	// Server-side: Check process.env (Nitro/Node.js context)
	if (process?.env) {
		return process.env.VITE_CLERK_PUBLISHABLE_KEY;
	}
	return undefined;
}

export default function AppClerkProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const publishableKey = getClerkPublishableKey();

	// If Clerk is not configured, render children without ClerkProvider
	if (!publishableKey) {
		if (typeof window !== "undefined") {
			// Only warn in browser console, not in server logs
			console.warn(
				"Clerk Publishable Key not found. Clerk features will be disabled. Add VITE_CLERK_PUBLISHABLE_KEY to enable.",
			);
		}
		return <>{children}</>;
	}

	return (
		<ClerkProvider
			publishableKey={publishableKey}
			afterSignOutUrl="/"
			appearance={{
				theme: shadcn,
			}}
		>
			{children}
		</ClerkProvider>
	);
}
