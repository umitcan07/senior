export enum ErrorCode {
	VALIDATION_ERROR = "VALIDATION_ERROR",
	AUTH_ERROR = "AUTH_ERROR",
	AUDIO_PROCESSING_ERROR = "AUDIO_PROCESSING_ERROR",
	R2_UPLOAD_ERROR = "R2_UPLOAD_ERROR",
	DATABASE_ERROR = "DATABASE_ERROR",
	NETWORK_ERROR = "NETWORK_ERROR",
	UNKNOWN_ERROR = "UNKNOWN_ERROR",
}

export interface ApiError {
	code: ErrorCode | string;
	message: string;
	details?: Record<string, unknown>;
	statusCode?: number;
}

export type ApiResponse<T> =
	| { success: true; data: T }
	| { success: false; error: ApiError };

export function createErrorResponse(
	code: ErrorCode | string,
	message: string,
	details?: Record<string, unknown>,
	statusCode?: number,
): { success: false; error: ApiError } {
	return {
		success: false,
		error: {
			code,
			message,
			details,
			statusCode,
		},
	};
}

export function createSuccessResponse<T>(
	data: T,
): { success: true; data: T } {
	return {
		success: true,
		data,
	};
}

export function isApiError(error: unknown): error is ApiError {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		"message" in error
	);
}

export function getErrorMessage(error: unknown): string {
	if (isApiError(error)) {
		return error.message;
	}
	if (error instanceof Error) {
		return error.message;
	}
	return "An unexpected error occurred";
}

export function getErrorCode(error: unknown): ErrorCode | string {
	if (isApiError(error)) {
		return error.code;
	}
	return ErrorCode.UNKNOWN_ERROR;
}

