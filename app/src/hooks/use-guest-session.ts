import { useAuth, useSignIn } from "@clerk/tanstack-react-start";
import { useCallback, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { ApiResponse } from "@/lib/errors";
import { ensureGuestSession } from "@/lib/guest-auth";
import { getTurnstileToken } from "@/lib/turnstile-client";

/**
 * Silently establishes a Clerk guest session on demand. Call `ensure()` right before
 * a gated action (e.g. starting a recording) when the visitor is signed out: it mints
 * a guest user server-side and activates the session via the `ticket` strategy. Once
 * it resolves `true`, the visitor is a normal authenticated (guest) user and the rest
 * of the flow proceeds unchanged. Returns `true` immediately if already signed in.
 */
export function useGuestSession() {
	const { isSignedIn } = useAuth();
	const { isLoaded, signIn, setActive } = useSignIn();
	const { toast } = useToast();
	const [pending, setPending] = useState(false);

	const ensure = useCallback(async (): Promise<boolean> => {
		if (isSignedIn) return true;
		if (!isLoaded || !signIn || !setActive) return false;

		setPending(true);
		try {
			const turnstileToken = await getTurnstileToken();
			const res = (await ensureGuestSession({
				data: { turnstileToken },
			})) as ApiResponse<{ token: string }>;
			if (!res.success) {
				toast({
					variant: "destructive",
					title: "Couldn't start practicing",
					description: res.error.message,
				});
				return false;
			}

			const attempt = await signIn.create({
				strategy: "ticket",
				ticket: res.data.token,
			});
			if (attempt.status === "complete" && attempt.createdSessionId) {
				await setActive({ session: attempt.createdSessionId });
				return true;
			}

			toast({
				variant: "destructive",
				title: "Couldn't start practicing",
				description: "Guest sign-in didn't complete. Please try again.",
			});
			return false;
		} catch (error) {
			console.error("Guest session error:", error);
			toast({
				variant: "destructive",
				title: "Couldn't start practicing",
				description: "Something went wrong. Please try again.",
			});
			return false;
		} finally {
			setPending(false);
		}
	}, [isSignedIn, isLoaded, signIn, setActive, toast]);

	return { ensure, pending };
}
