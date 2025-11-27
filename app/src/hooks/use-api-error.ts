import { useCallback } from "react";
import { useToastHelpers } from "@/lib/toast";
import { ErrorCode, getErrorMessage, getErrorCode, isApiError } from "@/lib/errors";

export function useApiError() {
	const { showErrorToast, showWarningToast, showInfoToast } =
		useToastHelpers();

	const handleError = useCallback((error: unknown) => {
		const errorCode = getErrorCode(error);
		const errorMessage = getErrorMessage(error);

		let details: string | undefined;

		if (isApiError(error) && error.details) {
			details = JSON.stringify(error.details);
		}

		switch (errorCode) {
			case ErrorCode.VALIDATION_ERROR:
				showErrorToast(
					"Validation Error",
					details || "Please check your input and try again.",
				);
				break;
			case ErrorCode.AUTH_ERROR:
				showErrorToast(
					"Authentication Required",
					"Please sign in to continue.",
				);
				break;
			case ErrorCode.AUDIO_PROCESSING_ERROR:
				showErrorToast(
					"Audio Processing Failed",
					details || "Unable to process audio file. Please try again.",
				);
				break;
			case ErrorCode.R2_UPLOAD_ERROR:
				showErrorToast(
					"Upload Failed",
					details || "Unable to upload file. Please try again.",
				);
				break;
			case ErrorCode.DATABASE_ERROR:
				showErrorToast(
					"Database Error",
					"Unable to save recording. Please try again.",
				);
				break;
			case ErrorCode.NETWORK_ERROR:
				showErrorToast(
					"Network Error",
					"Please check your internet connection and try again.",
				);
				break;
			default:
				showErrorToast(
					"An Error Occurred",
					details || errorMessage || "Please try again later.",
				);
		}
	}, [showErrorToast]);

	return {
		handleError,
	};
}

