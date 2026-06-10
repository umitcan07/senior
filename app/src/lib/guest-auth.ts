import { createClerkClient } from "@clerk/backend";
import { auth } from "@clerk/tanstack-react-start/server";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getClerkSecretKey } from "./auth";
import {
	type ApiResponse,
	createErrorResponse,
	createSuccessResponse,
	ErrorCode,
} from "./errors";

/**
 * Guest (anonymous) sessions via Clerk's sign-in token + `ticket` strategy.
 *
 * Clerk has no native "anonymous users" feature, so we mint a real Clerk user
 * (flagged `publicMetadata.guest = true`) on demand and hand the client a one-time
 * sign-in token. The client consumes it with `signIn.create({ strategy: "ticket" })`,
 * after which the visitor is a normal authenticated user — every existing auth,
 * ownership and DB-by-userId path keeps working unchanged. They can later "upgrade"
 * by adding an email to the SAME user (userId never changes → history is preserved).
 */

/** Free analyses a guest may run before being prompted to sign up. Mirrors the UI
 * indicator in `use-guest-trial.ts`; this is the server-authoritative source. */
export const MAX_GUEST_ANALYSES = 5;

/** Domain for synthetic guest emails. Never receives mail; replaced by the real
 * address on upgrade. Backend `createUser` does not verify it. */
const GUEST_EMAIL_DOMAIN = "guests.nounce.app";

function backendClerk() {
	return createClerkClient({ secretKey: getClerkSecretKey() });
}

/**
 * Verify a Cloudflare Turnstile token. Env-gated: if `TURNSTILE_SECRET_KEY` is unset
 * (local/dev/demo), verification is skipped and any token passes. Clerk uses Turnstile
 * under the hood; we add it here because guest creation goes through the Backend API,
 * which Clerk's built-in bot protection (Frontend API only) does not cover.
 */
async function verifyTurnstile(token: string | null): Promise<boolean> {
	const secret = process.env.TURNSTILE_SECRET_KEY;
	if (!secret) return true; // not configured → no-op
	if (!token) return false;
	try {
		const res = await fetch(
			"https://challenges.cloudflare.com/turnstile/v0/siteverify",
			{
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({ secret, response: token }),
			},
		);
		const body = (await res.json()) as { success?: boolean };
		return body.success === true;
	} catch (error) {
		console.error("Turnstile verification failed:", error);
		return false;
	}
}

/**
 * Create a guest Clerk user and return a one-time sign-in token for the client to
 * consume via the `ticket` strategy. No-op-safe: callers only invoke this when the
 * visitor is signed out.
 */
export const ensureGuestSession = createServerFn({ method: "POST" })
	.inputValidator(
		z.object({ turnstileToken: z.string().nullable().optional() }),
	)
	.handler(async ({ data }): Promise<ApiResponse<{ token: string }>> => {
		// Guard: if somehow already authenticated, don't mint a duplicate guest.
		try {
			const existing = await auth();
			if (existing.isAuthenticated && existing.userId) {
				return createErrorResponse(
					ErrorCode.VALIDATION_ERROR,
					"Already signed in",
					undefined,
					409,
				);
			}
		} catch {
			// no auth context → proceed
		}

		if (!(await verifyTurnstile(data.turnstileToken ?? null))) {
			return createErrorResponse(
				ErrorCode.AUTH_ERROR,
				"Bot verification failed",
				undefined,
				403,
			);
		}

		try {
			const clerk = backendClerk();
			const user = await clerk.users.createUser({
				emailAddress: [`guest_${crypto.randomUUID()}@${GUEST_EMAIL_DOMAIN}`],
				skipPasswordRequirement: true,
				skipLegalChecks: true,
				publicMetadata: { guest: true },
			});
			const signInToken = await clerk.signInTokens.createSignInToken({
				userId: user.id,
				expiresInSeconds: 600,
			});
			return createSuccessResponse({ token: signInToken.token });
		} catch (error) {
			console.error("Failed to create guest session:", error);
			return createErrorResponse(
				ErrorCode.INTERNAL_ERROR,
				"Could not start a guest session",
				undefined,
				500,
			);
		}
	});

/**
 * Clear the guest flag on the current user after they add real credentials
 * ("upgrade"). publicMetadata is backend-writable only, so this must be a server fn.
 */
export const clearGuestFlag = createServerFn({ method: "POST" }).handler(
	async (): Promise<ApiResponse<{ upgraded: true }>> => {
		const authResult = await auth();
		if (!authResult.isAuthenticated || !authResult.userId) {
			return createErrorResponse(
				ErrorCode.AUTH_ERROR,
				"Not authenticated",
				undefined,
				401,
			);
		}
		try {
			await backendClerk().users.updateUserMetadata(authResult.userId, {
				publicMetadata: { guest: false },
			});
			return createSuccessResponse({ upgraded: true });
		} catch (error) {
			console.error("Failed to clear guest flag:", error);
			return createErrorResponse(
				ErrorCode.INTERNAL_ERROR,
				"Could not finalize account",
				undefined,
				500,
			);
		}
	},
);

/**
 * Whether a userId belongs to a guest (server-side check via backend metadata).
 * Returns false on any error so signed-up users are never wrongly limited.
 */
export async function isGuestUserId(userId: string): Promise<boolean> {
	try {
		const user = await backendClerk().users.getUser(userId);
		return user.publicMetadata?.guest === true;
	} catch (error) {
		console.error("isGuestUserId check failed:", error);
		return false;
	}
}
