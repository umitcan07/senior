import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { 
    getAnalysisById, 
    getPhonemeErrorsByAnalysisId, 
    getWordErrorsByAnalysisId 
} from "@/db/analysis";
import { createErrorResponse, createSuccessResponse, ErrorCode, type ApiResponse } from "./errors";
import type { Analysis, PhonemeError, WordError } from "@/db/types";

const GetAnalysisSchema = z.object({
	analysisId: z.string(),
});

type AnalysisDetails = {
    analysis: Analysis;
    phonemeErrors: PhonemeError[];
    wordErrors: WordError[];
};

export const serverGetAnalysisDetails = createServerFn({ method: "GET" })
	.inputValidator(GetAnalysisSchema)
	.handler(async ({ data }): Promise<ApiResponse<AnalysisDetails | null>> => {
		try {
            // Validate UUID format manually to avoid crashing on invalid URLs (e.g. from mock data)
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
            if (!uuidRegex.test(data.analysisId)) {
                return createSuccessResponse(null);
            }

            const analysis = await getAnalysisById(data.analysisId);
            
            if (!analysis) {
                 return createSuccessResponse(null);
            }

            const [phonemeErrors, wordErrors] = await Promise.all([
                 getPhonemeErrorsByAnalysisId(analysis.id),
                 getWordErrorsByAnalysisId(analysis.id)
            ]);

            return createSuccessResponse({
                analysis,
                phonemeErrors,
                wordErrors,
            });

		} catch (error) {
			console.error("Get analysis details error:", error);
            if (error instanceof Error) {
                return createErrorResponse(
                    ErrorCode.DATABASE_ERROR,
                    "Failed to retrieve analysis details",
                    { originalError: error.message },
                    500
                );
            }
            return createErrorResponse(
                ErrorCode.DATABASE_ERROR,
                "Failed to retrieve analysis details",
                undefined,
                500
            );
		}
	});
