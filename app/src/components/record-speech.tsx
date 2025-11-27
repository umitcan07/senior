import { ClientOnly } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useRef } from "react";
import { useVoiceVisualizer, VoiceVisualizer } from "react-voice-visualizer";
import { useAuth } from "@clerk/clerk-react";
import { useServerFn } from "@tanstack/react-start";
import { serverUploadRecording } from "@/lib/recording";
import { convertTo16kHzMonoWav } from "@/lib/audio";
import { useToastHelpers } from "@/lib/toast";
import { useApiError } from "@/hooks/use-api-error";
import { ErrorCode } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { RiLoader4Line, RiSoundModuleLine } from "@remixicon/react";

export const RecordSpeech = () => {
	const { userId } = useAuth();
	const { showSuccessToast, showErrorToast, showInfoToast } =
		useToastHelpers();
	const { handleError } = useApiError();
	const [isUploading, setIsUploading] = useState(false);
	const [isProcessing, setIsProcessing] = useState(false);
	const [isUploadComplete, setIsUploadComplete] = useState(false);
	const processedBlobRef = useRef<string | null>(null);

	const uploadRecordingFn = useServerFn(serverUploadRecording);

	const handleUpload = useCallback(async (blob: Blob) => {
		if (!userId) {
			showErrorToast(
				"Authentication Required",
				"Please sign in to upload recordings.",
			);
			return;
		}

		const blobId = `${blob.size}-${blob.type}`;
		if (processedBlobRef.current === blobId) {
			return;
		}

		processedBlobRef.current = blobId;

		try {
			setIsProcessing(true);
			showInfoToast("Processing audio...", "Converting to 16kHz mono WAV");

			const processedBlob = await convertTo16kHzMonoWav(blob);

			setIsProcessing(false);
			setIsUploading(true);
			showInfoToast("Uploading recording...", "Please wait while we upload your recording");

			const base64data = await new Promise<string>((resolve, reject) => {
				const reader = new FileReader();
				reader.onloadend = () => {
					if (reader.result && typeof reader.result === "string") {
						resolve(reader.result);
					} else {
						reject(new Error("Failed to read file as data URL"));
					}
				};
				reader.onerror = () => {
					reject(new Error("File read error"));
				};
				reader.readAsDataURL(processedBlob);
			});

			try {
				const result = await uploadRecordingFn({
					data: {
						file: base64data,
						fileName: `recording-${Date.now()}.wav`,
						contentType: "audio/wav",
						userId,
					},
				}) as { success: true; data: unknown } | { success: false; error: unknown };

			setIsUploading(false);

				if (result.success) {
					setIsUploadComplete(true);
					showSuccessToast(
						"Recording Uploaded Successfully!",
						"Your recording has been uploaded. Analysis is running in the background. Check back later for results."
					);
				} else {
					processedBlobRef.current = null;
					handleError(result.error);
				}
			} catch (error) {
				setIsUploading(false);
				setIsUploadComplete(false);
				processedBlobRef.current = null;
				handleError(error);
			}
		} catch (error) {
			setIsProcessing(false);
			setIsUploading(false);
			setIsUploadComplete(false);
			processedBlobRef.current = null;

			if (error instanceof Error) {
				if (error.message === "File read error") {
					showErrorToast(
						"File Read Error",
						"Failed to read audio file. Please try again.",
					);
				} else {
					showErrorToast(
						"Audio Processing Failed",
						error.message || "Unable to process audio file.",
					);
				}
			} else {
				handleError({
					code: ErrorCode.AUDIO_PROCESSING_ERROR,
					message: "Audio processing failed",
				});
			}
		}
	}, [userId, showErrorToast, showInfoToast, showSuccessToast, handleError, uploadRecordingFn]);

	const recorderControls = useVoiceVisualizer({
		onStopRecording: () => {
			// Recording stopped - user can now upload and analyze
			setIsUploadComplete(false);
		},
	});

	const { recordedBlob, error } = recorderControls;

	const memoizedHandleError = useCallback(
		(error: unknown) => {
			handleError(error);
		},
		[handleError],
	);

	useEffect(() => {
		if (!error) return;
		console.error(error);
		memoizedHandleError(error);
	}, [error, memoizedHandleError]);

	if (error) {
		return (
			<div className="p-4">
				<div className="text-destructive">
					An error occurred while recording: {error.message}
				</div>
			</div>
		);
	}

	return (
		<div className="p-4 space-y-6">
			{(isProcessing || isUploading) && (
				<div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
					{isProcessing && (
						<>
							<RiLoader4Line className="animate-spin text-teal-600" />
							<span>Processing audio...</span>
						</>
					)}
					{isUploading && (
						<>
							<RiSoundModuleLine className="animate-pulse text-teal-600" />
							<span>Uploading recording...</span>
						</>
					)}
				</div>
			)}
			<ClientOnly fallback={<div className="flex items-center justify-center p-8">Loading recorder...</div>}>
				<div className="rounded-lg border bg-card p-6 shadow-sm">
					<VoiceVisualizer
						controls={recorderControls}
						mainBarColor="#dddddd"
						secondaryBarColor="#18D1B8"
						barWidth={4}
						speed={3}
						backgroundColor="#f0f0f0"
						progressIndicatorTimeClassName="font-mono"
						isProgressIndicatorOnHoverShown={true}
						progressIndicatorTimeOnHoverClassName="font-bold font-mono bg-slate-200"
						audioProcessingTextClassName="text-slate-400"
						gap={4}
						progressIndicatorClassName="bg-slate-400"
						rounded={4}
						onlyRecording={false}
						isControlPanelShown={true}
						isDownloadAudioButtonShown={false}
						isAudioProcessingTextShown={true}
						isDefaultUIShown={false}
						controlButtonsClassName="bg-teal-600 hover:bg-teal-700 text-white rounded-md px-4 py-2 transition-colors"
						animateCurrentPick={false}
						isProgressIndicatorShown={true}
						mainContainerClassName="w-full"
						canvasContainerClassName="w-full rounded-lg overflow-hidden"
					/>
				</div>
			</ClientOnly>
			{recordedBlob && !isUploading && !isProcessing && !isUploadComplete && (
				<div className="flex justify-center">
					<Button
						onClick={() => handleUpload(recordedBlob)}
						disabled={!userId || isUploading || isProcessing}
						size="lg"
					>
						<RiSoundModuleLine className="mr-2 text-lg" />
						Upload & Analyze
					</Button>
				</div>
			)}
			{isUploadComplete && (
				<div className="rounded-lg border-2 border-teal-500/50 bg-teal-50 dark:bg-teal-950/30 p-6 text-center space-y-3">
					<div className="flex items-center justify-center gap-2 text-teal-700 dark:text-teal-300">
						<RiSoundModuleLine className="text-xl" />
						<h3 className="font-semibold text-lg">Recording Uploaded Successfully!</h3>
					</div>
					<p className="text-sm text-teal-600 dark:text-teal-400">
						Your recording has been uploaded. Analysis is running in the background and may take a few minutes.
					</p>
					<p className="text-xs text-muted-foreground">
						You can check back later to view your pronunciation analysis results.
					</p>
				</div>
			)}
		</div>
	);
};
