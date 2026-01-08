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
