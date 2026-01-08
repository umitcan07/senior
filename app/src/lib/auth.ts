import { createClerkClient } from "@clerk/backend";
import { useUser } from "@clerk/tanstack-react-start";
import { createErrorResponse, ErrorCode } from "./errors";

/**
 * Get Clerk secret key from environment
 */
function getClerkSecretKey(): string {
	const secretKey =
		process.env.CLERK_SECRET_KEY || process.env.VITE_CLERK_SECRET_KEY;

	if (!secretKey) {
		throw new Error(
			"CLERK_SECRET_KEY or VITE_CLERK_SECRET_KEY environment variable is not set",
		);
	}

	return secretKey;
}

/**
 * Get server-side auth object from request
 * Used in server functions and route loaders
 * Note: This function should be called from within a server function or loader context
 * where the request is available via TanStack Start's context
 */
export async function getServerAuth(request?: Request) {
	try {
		if (!request) {
			return {
				isAuthenticated: false,
				userId: null,
				publicMetadata: null,
			};
		}

		const secretKey = getClerkSecretKey();
		const clerk = createClerkClient({ secretKey });

		// Get auth token from request headers/cookies
		// Clerk sets __session cookie automatically
		const sessionToken =
			request.headers.get("authorization")?.replace("Bearer ", "") ||
			// Try to get from cookies if available
			request.headers.get("cookie")?.split("__session=")[1]?.split(";")[0];

		if (!sessionToken) {
			return {
				isAuthenticated: false,
				userId: null,
				publicMetadata: null,
			};
		}

		// Get session from token
		const session = await clerk.sessions.getSession(sessionToken);

		if (!session || !session.userId) {
			return {
				isAuthenticated: false,
				userId: null,
				publicMetadata: null,
			};
		}

		// Get user to access public metadata
		const user = await clerk.users.getUser(session.userId);

		return {
			isAuthenticated: true,
			userId: session.userId,
			publicMetadata: user.publicMetadata,
		};
	} catch (error) {
		console.error("Auth error:", error);
		return {
			isAuthenticated: false,
			userId: null,
			publicMetadata: null,
		};
	}
}

/**
 * Check if user is admin (server-side)
 * Returns boolean
 * @param request - Request object (optional, but required for proper auth checks)
 */
export async function checkAdmin(request?: Request): Promise<boolean> {
	if (!request) {
		return false;
	}

	const authResult = await getServerAuth(request);

	if (!authResult.isAuthenticated || !authResult.publicMetadata) {
		return false;
	}

	return (
		typeof authResult.publicMetadata.role === "string" &&
		authResult.publicMetadata.role === "app_admin"
	);
}

/**
 * Require admin access (server-side)
 * Returns error response if not admin, null if authorized
 * @param request - Request object (required)
 */
export async function requireAdmin(request: Request) {
	const authResult = await getServerAuth(request);

	if (!authResult.isAuthenticated) {
		return createErrorResponse(
			ErrorCode.AUTH_ERROR,
			"User is not authenticated",
			undefined,
			401,
		);
	}

	const isAdmin =
		authResult.publicMetadata &&
		typeof authResult.publicMetadata.role === "string" &&
		authResult.publicMetadata.role === "app_admin";

	if (!isAdmin) {
		return createErrorResponse(
			ErrorCode.AUTH_ERROR,
			"User does not have admin permissions",
			undefined,
			403,
		);
	}

	return null;
}

/**
 * Client-side hook to check admin access
 * Uses Clerk's useUser hook to access public metadata
 * Note: This is a React hook and can only be used in client components
 */
export function useRequireAdmin() {
	const { isSignedIn, user, isLoaded } = useUser();

	// Wait for Clerk to load user data
	if (!isLoaded) {
		return { isAdmin: false, isAuthenticated: false, isLoading: true };
	}

	if (!isSignedIn || !user) {
		return { isAdmin: false, isAuthenticated: false, isLoading: false };
	}

	const isAdmin =
		typeof user.publicMetadata.role === "string" &&
		user.publicMetadata.role === "app_admin";

	return { isAdmin, isAuthenticated: true, isLoading: false };
}
