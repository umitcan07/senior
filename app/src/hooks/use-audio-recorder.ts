import { useCallback, useEffect, useRef, useState } from "react";

export type RecordingState = "idle" | "requesting" | "recording" | "stopped" | "error";

export interface UseAudioRecorderOptions {
	onStart?: () => void;
	onStop?: (blob: Blob) => void;
	onError?: (error: Error) => void;
	mimeType?: string;
	audioBitsPerSecond?: number;
	timeslice?: number; // How often to collect data (ms)
}

export interface UseAudioRecorderReturn {
	startRecording: () => Promise<void>;
	stopRecording: () => void;
	pauseRecording: () => void;
	resumeRecording: () => void;
	state: RecordingState;
	error: string | null;
	audioBlob: Blob | null;
	audioUrl: string | null;
	recordingTime: number; // in seconds
	isRecording: boolean;
	mediaStream: MediaStream | null;
}

export function useAudioRecorder(
	options: UseAudioRecorderOptions = {},
): UseAudioRecorderReturn {
	const {
		onStart,
		onStop,
		onError,
		mimeType = "audio/webm",
		audioBitsPerSecond,
		timeslice = 100,
	} = options;

	const [state, setState] = useState<RecordingState>("idle");
	const [error, setError] = useState<string | null>(null);
	const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
	const [audioUrl, setAudioUrl] = useState<string | null>(null);
	const [recordingTime, setRecordingTime] = useState(0);
	const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

	const mediaRecorderRef = useRef<MediaRecorder | null>(null);
	const chunksRef = useRef<Blob[]>([]);
	const startTimeRef = useRef<number>(0);
	const timerRef = useRef<number | null>(null);
	const streamRef = useRef<MediaStream | null>(null);

	// Cleanup audio URL
	useEffect(() => {
		return () => {
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl);
			}
		};
	}, [audioUrl]);

	// Update recording time
	useEffect(() => {
		if (state === "recording" && startTimeRef.current > 0) {
			const updateTime = () => {
				const elapsed = (performance.now() - startTimeRef.current) / 1000;
				setRecordingTime(elapsed);
				timerRef.current = requestAnimationFrame(updateTime);
			};
			timerRef.current = requestAnimationFrame(updateTime);

			return () => {
				if (timerRef.current) {
					cancelAnimationFrame(timerRef.current);
					timerRef.current = null;
				}
			};
		} else {
			if (timerRef.current) {
				cancelAnimationFrame(timerRef.current);
				timerRef.current = null;
			}
		}
	}, [state]);

	// Cleanup on unmount
	useEffect(() => {
		return () => {
			// Stop recording if active
			if (
				mediaRecorderRef.current &&
				mediaRecorderRef.current.state !== "inactive"
			) {
				try {
					mediaRecorderRef.current.stop();
				} catch {
					// Ignore errors during cleanup
				}
			}

			// Stop stream
			if (streamRef.current) {
				streamRef.current.getTracks().forEach((track) => {
					track.stop();
				});
			}

			// Clear timer
			if (timerRef.current) {
				cancelAnimationFrame(timerRef.current);
			}

			// Revoke URL
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl);
			}
		};
	}, [audioUrl]);

	const startRecording = useCallback(async () => {
		try {
			setError(null);
			setState("requesting");
			chunksRef.current = [];
			setAudioBlob(null);
			if (audioUrl) {
				URL.revokeObjectURL(audioUrl);
				setAudioUrl(null);
			}

			// Get media stream
			const stream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true,
				},
			});

			streamRef.current = stream;
			setMediaStream(stream);

			// Create MediaRecorder
			const mediaRecorder = new MediaRecorder(stream, {
				mimeType,
				audioBitsPerSecond,
			});

			// Handle data available
			mediaRecorder.ondataavailable = (event) => {
				if (event.data && event.data.size > 0) {
					chunksRef.current.push(event.data);
				}
			};

			// Handle stop
			mediaRecorder.onstop = () => {
				if (chunksRef.current.length > 0) {
					const blob = new Blob(chunksRef.current, { type: mimeType });
					setAudioBlob(blob);
					const url = URL.createObjectURL(blob);
					setAudioUrl(url);
					onStop?.(blob);
				} else {
					const err = new Error("No audio data was recorded");
					setError(err.message);
					onError?.(err);
				}

				// Stop stream tracks
				if (streamRef.current) {
					streamRef.current.getTracks().forEach((track) => {
						track.stop();
					});
					streamRef.current = null;
					setMediaStream(null);
				}
			};

			// Handle errors
			mediaRecorder.onerror = (event) => {
				const err = new Error(
					event instanceof ErrorEvent ? event.message : "Recording error",
				);
				setError(err.message);
				setState("error");
				onError?.(err);

				// Cleanup
				if (streamRef.current) {
					streamRef.current.getTracks().forEach((track) => {
						track.stop();
					});
					streamRef.current = null;
					setMediaStream(null);
				}
			};

			mediaRecorderRef.current = mediaRecorder;

			// Start recording
			mediaRecorder.start(timeslice);
			startTimeRef.current = performance.now();
			setRecordingTime(0);
			setState("recording");
			onStart?.();
		} catch (err) {
			const error =
				err instanceof Error
					? err
					: new Error("Failed to access microphone");
			setError(error.message);
			setState("error");
			onError?.(error);
		}
	}, [mimeType, audioBitsPerSecond, timeslice, onStart, onStop, onError, audioUrl]);

	const stopRecording = useCallback(() => {
		if (mediaRecorderRef.current && state === "recording") {
			if (mediaRecorderRef.current.state !== "inactive") {
				mediaRecorderRef.current.stop();
			}
			setState("stopped");
		}
	}, [state]);

	const pauseRecording = useCallback(() => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state === "recording"
		) {
			mediaRecorderRef.current.pause();
		}
	}, []);

	const resumeRecording = useCallback(() => {
		if (
			mediaRecorderRef.current &&
			mediaRecorderRef.current.state === "paused"
		) {
			mediaRecorderRef.current.resume();
		}
	}, []);

	return {
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		state,
		error,
		audioBlob,
		audioUrl,
		recordingTime,
		isRecording: state === "recording",
		mediaStream,
	};
}

