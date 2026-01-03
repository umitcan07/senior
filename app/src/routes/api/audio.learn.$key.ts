import { createFileRoute } from "@tanstack/react-router";
import { getFromR2 } from "@/lib/r2";

export const Route = createFileRoute("/api/audio/learn/$key")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				try {
					const { key } = params;

					// Decode the key (it may contain slashes which are URL encoded)
					const decodedKey = decodeURIComponent(key);

					// Get audio file from R2
					const result = await getFromR2(decodedKey);
					if (!result.success) {
						console.error("Failed to get IPA audio from R2:", result.error);
						return new Response("Audio not found", { status: 404 });
					}

					// Return audio with proper headers
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
					console.error("IPA Audio API error:", error);
					return new Response("Internal server error", { status: 500 });
				}
			},
		},
	},
});
