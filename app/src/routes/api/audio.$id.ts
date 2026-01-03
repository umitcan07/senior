import { createFileRoute } from "@tanstack/react-router";
import { getReferenceSpeechById } from "@/db/reference";
import { getFromR2 } from "@/lib/r2";

export const Route = createFileRoute("/api/audio/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					const { id } = params;

					// Get reference speech from database
					const reference = await getReferenceSpeechById(id);
					if (!reference) {
						return new Response("Audio not found", { status: 404 });
					}

					// Get audio file from R2
					const result = await getFromR2(reference.storageKey);
					if (!result.success) {
						console.error("Failed to get audio from R2:", result.error);
						return new Response("Failed to retrieve audio", { status: 500 });
					}

					// Return audio with proper headers
					// Convert Buffer to Uint8Array for Response compatibility
					const audioData = new Uint8Array(result.data.data);
					return new Response(audioData, {
						status: 200,
						headers: {
							"Content-Type": result.data.contentType,
							"Content-Length": result.data.data.length.toString(),
							"Cache-Control": "public, max-age=31536000, immutable",
							"Accept-Ranges": "bytes",
						},
					});
				} catch (error) {
					console.error("Audio API error:", error);
					return new Response("Internal server error", { status: 500 });
				}
			},
		},
	},
});
