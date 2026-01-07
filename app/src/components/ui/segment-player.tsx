"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SegmentPlayerProps {
	src: string;
	startMs?: number;
	endMs?: number;
	label?: string;
	className?: string;
	variant?: "default" | "compact" | "inline";
	showTimestamps?: boolean;
	defaultSpeed?: number;
}

function formatTimestamp(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	const millis = Math.floor((ms % 1000) / 10);
	return `${mins}:${secs.toString().padStart(2, "0")}.${millis.toString().padStart(2, "0")}`;
}

export function SegmentPlayer({
	src,
	startMs = 0,
	endMs,
	label,
	className,
	variant = "default",
	showTimestamps = true,
	defaultSpeed = 1,
}: SegmentPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [isLooping, setIsLooping] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState(defaultSpeed);
	const [currentTime, setCurrentTime] = useState(0);
	const animationRef = useRef<number | null>(null);

	const startSec = startMs / 1000;
	const endSec = endMs ? endMs / 1000 : undefined;

	const playSegment = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.currentTime = startSec;
		audio.playbackRate = playbackSpeed;
		audio.play();
		setIsPlaying(true);
	}, [startSec, playbackSpeed]);

	const pauseSegment = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.pause();
		setIsPlaying(false);
	}, []);

	const togglePlay = useCallback(() => {
		if (isPlaying) {
			pauseSegment();
		} else {
			playSegment();
		}
	}, [isPlaying, playSegment, pauseSegment]);

	const resetToStart = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.currentTime = startSec;
		setCurrentTime(startSec);
	}, [startSec]);

	// Handle time updates and segment end
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const updateTime = () => {
			setCurrentTime(audio.currentTime);

			// Check if we've passed the end of the segment
			if (endSec && audio.currentTime >= endSec) {
				if (isLooping) {
					audio.currentTime = startSec;
				} else {
					audio.pause();
					setIsPlaying(false);
				}
			}

			if (isPlaying) {
				animationRef.current = requestAnimationFrame(updateTime);
			}
		};

		if (isPlaying) {
			animationRef.current = requestAnimationFrame(updateTime);
		}

		return () => {
			if (animationRef.current) {
				cancelAnimationFrame(animationRef.current);
			}
		};
	}, [isPlaying, endSec, startSec, isLooping]);

	// Update playback rate when speed changes
	useEffect(() => {
		const audio = audioRef.current;
		if (audio) {
			audio.playbackRate = playbackSpeed;
		}
	}, [playbackSpeed]);

	const speeds = [0.5, 0.75, 1];

	if (variant === "inline") {
		return (
			<button
				type="button"
				onClick={togglePlay}
				className={cn(
					"inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs transition-colors",
					"bg-primary/10 text-primary hover:bg-primary/20",
					className,
				)}
			>
				{isPlaying ? <Pause size={12} /> : <Play size={12} />}
				{label && <span>{label}</span>}
				<audio ref={audioRef} src={src} preload="metadata" className="hidden" />
			</button>
		);
	}

	if (variant === "compact") {
		return (
			<div className={cn("flex items-center gap-2", className)}>
				<Button
					variant="ghost"
					size="icon"
					className="size-8"
					onClick={togglePlay}
				>
					{isPlaying ? <Pause size={14} /> : <Play size={14} />}
				</Button>
				{showTimestamps && startMs !== undefined && endMs !== undefined && (
					<span className="font-mono text-muted-foreground text-xs">
						{formatTimestamp(startMs)} - {formatTimestamp(endMs)}
					</span>
				)}
				<audio ref={audioRef} src={src} preload="metadata" className="hidden" />
			</div>
		);
	}

	// Default variant
	return (
		<div
			className={cn(
				"flex flex-col gap-3 rounded-lg border bg-card p-4",
				className,
			)}
		>
			{label && <div className="font-medium text-sm">{label}</div>}

			<div className="flex items-center gap-3">
				<Button
					variant="default"
					size="icon"
					className="size-10 shrink-0"
					onClick={togglePlay}
				>
					{isPlaying ? <Pause size={18} /> : <Play size={18} />}
				</Button>

				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0"
					onClick={resetToStart}
				>
					<RotateCcw size={14} />
				</Button>

				{/* Progress bar */}
				<div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
					<div
						className="absolute top-0 left-0 h-full bg-primary transition-all"
						style={{
							width: endSec
								? `${((currentTime - startSec) / (endSec - startSec)) * 100}%`
								: "0%",
						}}
					/>
				</div>

				{showTimestamps && (
					<span className="shrink-0 font-mono text-muted-foreground text-xs">
						{formatTimestamp(startMs)} -{" "}
						{endMs ? formatTimestamp(endMs) : "end"}
					</span>
				)}
			</div>

			{/* Speed controls */}
			<div className="flex items-center gap-2">
				<span className="text-muted-foreground text-xs">Speed:</span>
				<div className="flex gap-1">
					{speeds.map((speed) => (
						<button
							key={speed}
							type="button"
							onClick={() => setPlaybackSpeed(speed)}
							className={cn(
								"rounded px-2 py-0.5 font-mono text-xs transition-colors",
								playbackSpeed === speed
									? "bg-primary text-primary-foreground"
									: "bg-muted hover:bg-muted/80",
							)}
						>
							{speed}x
						</button>
					))}
				</div>
				<button
					type="button"
					onClick={() => setIsLooping(!isLooping)}
					className={cn(
						"ml-auto flex items-center gap-1 rounded px-2 py-0.5 text-xs transition-colors",
						isLooping
							? "bg-primary/10 text-primary"
							: "text-muted-foreground hover:text-foreground",
					)}
				>
					<RotateCcw size={12} />
					Loop
				</button>
			</div>

			<audio ref={audioRef} src={src} preload="metadata" className="hidden" />
		</div>
	);
}

// Utility component for playing a specific error segment
interface ErrorSegmentPlayerProps {
	src: string;
	error: {
		timestampStartMs?: number | null;
		timestampEndMs?: number | null;
		expected?: string | null;
		actual?: string | null;
	};
	className?: string;
}

export function ErrorSegmentPlayer({
	src,
	error,
	className,
}: ErrorSegmentPlayerProps) {
	const hasTimestamps =
		error.timestampStartMs != null && error.timestampEndMs != null;

	if (!hasTimestamps) {
		return null;
	}

	return (
		<SegmentPlayer
			src={src}
			startMs={error.timestampStartMs!}
			endMs={error.timestampEndMs!}
			variant="compact"
			className={className}
		/>
	);
}
