import { auth } from "@clerk/tanstack-react-start/server";
import { createFileRoute } from "@tanstack/react-router";
import { getUserRecordingById } from "@/db/recording";
import { getFromR2 } from "@/lib/r2";

export const Route = createFileRoute("/api/audio/user/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					const { id } = params;

					// Get user recording from database
					const recording = await getUserRecordingById(id);
					if (!recording) {
						return new Response("Recording not found", { status: 404 });
					}

					// Verify user owns this recording - require authentication
					let isAuthenticated = false;
					let userId: string | null = null;
					try {
						const authResult = await auth();
						isAuthenticated = authResult.isAuthenticated ?? false;
						userId = authResult.userId ?? null;
					} catch (authError) {
						// Auth context not available
						return new Response("Unauthorized", { status: 401 });
					}

					if (!isAuthenticated || !userId) {
						return new Response("Unauthorized", { status: 401 });
					}

					// Verify the recording belongs to the authenticated user
					if (recording.userId !== userId) {
						return new Response("Forbidden", { status: 403 });
					}

					// Get audio file from R2
					const result = await getFromR2(recording.storageKey);
					if (!result.success) {
						console.error(
							"Failed to get user recording from R2:",
							result.error,
						);
						return new Response("Failed to retrieve audio", { status: 500 });
					}

					// Return audio with proper headers
					const audioData = new Uint8Array(result.data.data);
					return new Response(audioData, {
						status: 200,
						headers: {
							"Content-Type": result.data.contentType,
							"Content-Length": result.data.data.length.toString(),
							"Cache-Control": "private, max-age=86400",
							"Accept-Ranges": "bytes",
						},
					});
				} catch (error) {
					console.error("User audio API error:", error);
					return new Response("Internal server error", { status: 500 });
				}
			},
		},
	},
});
