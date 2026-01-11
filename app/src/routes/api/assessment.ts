import { auth } from "@clerk/tanstack-react-start/server";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { submitAssessmentJob } from "@/lib/assessment-submission";

// Schema for the submit assessment job request body
const SubmitAssessmentRequestSchema = z.object({
	analysisId: z.string().uuid(),
});

export const Route = createFileRoute("/api/assessment")({
	server: {
		handlers: {
			// POST /api/assessment - Submit a new assessment job
			POST: async ({ request }) => {
				try {
					const body = await request.json();
					const parseResult = SubmitAssessmentRequestSchema.safeParse(body);

					if (!parseResult.success) {
						return Response.json(
							{
								success: false,
								error: "Invalid request body",
								details: parseResult.error.format(),
							},
							{ status: 400 },
						);
					}

					const { analysisId } = parseResult.data;

					// Verify user is authenticated
					let isAuthenticated = false;
					let userId: string | null = null;
					try {
						const authResult = await auth();
						isAuthenticated = authResult.isAuthenticated ?? false;
						userId = authResult.userId ?? null;
					} catch (authError) {
						// Auth context not available
						return Response.json(
							{ success: false, error: "Unauthorized" },
							{ status: 401 },
						);
					}

					if (!isAuthenticated || !userId) {
						return Response.json(
							{ success: false, error: "Unauthorized" },
							{ status: 401 },
						);
					}

					// Submit assessment job using shared function
					const result = await submitAssessmentJob(
						analysisId,
						userId,
						request,
					);

					if (!result.success) {
						return Response.json(
							{ success: false, error: result.error },
							{ status: result.statusCode },
						);
					}

					return Response.json({
						success: true,
						data: result.data,
					});
				} catch (error) {
					console.error("Failed to submit assessment job:", error);
					const message =
						error instanceof Error
							? error.message
							: "Failed to submit assessment job";
					return Response.json(
						{ success: false, error: message },
						{ status: 500 },
					);
				}
			},
		},
	},
});
