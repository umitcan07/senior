/**
 * RunPod API configuration
 * Throws if required environment variables are missing
 */

function getRequiredEnv(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

// Lazy initialization to avoid throwing at module load time
let _config: {
	apiUrl: string;
	apiKey: string;
	endpoints: {
		assessment: string;
		generation: string;
	};
} | null = null;

export function getRunPodConfig() {
	if (!_config) {
		_config = {
			apiUrl: getRequiredEnv("RUNPOD_API_URL"),
			apiKey: getRequiredEnv("RUNPOD_API_KEY"),
			endpoints: {
				// Endpoint IDs - use dev names locally, production IDs in cloud
				assessment:
					process.env.RUNPOD_ASSESSMENT_ENDPOINT_ID ??
					"pronunciation-assessment",
				generation:
					process.env.RUNPOD_GENERATION_ENDPOINT_ID ?? "ipa-generation",
			},
		};
	}
	return _config;
}

export function getRunPodHeaders() {
	const config = getRunPodConfig();
	return {
		"Content-Type": "application/json",
		Authorization: `Bearer ${config.apiKey}`,
	};
}

/**
 * Get webhook base URL for RunPod webhooks
 * Prefers WEBHOOK_BASE_URL environment variable for security and consistency
 * Falls back to request origin for local development
 */
export function getWebhookBaseUrl(request?: Request): string {
	// Prefer environment variable (required in production)
	if (process.env.WEBHOOK_BASE_URL) {
		return process.env.WEBHOOK_BASE_URL;
	}

	// Fallback to origin-based logic for local development
	if (request) {
		const origin = request.headers.get("origin") ?? "http://localhost:3000";
		// For Docker, use host.docker.internal
		return origin.includes("localhost")
			? "http://host.docker.internal:3000"
			: origin;
	}

	// Final fallback
	return "http://localhost:3000";
}
