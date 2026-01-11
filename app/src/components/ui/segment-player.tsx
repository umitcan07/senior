"use client";

import {
	RiCloseLine,
	RiPauseLine,
	RiPlayLine,
	RiRestartLine,
	RiSpeedLine,
} from "@remixicon/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface SegmentPlayerProps {
	src: string;
	startMs?: number;
	endMs?: number;
	label?: string;
	errorType?: "substitute" | "insert" | "delete";
	className?: string;
	variant?: "default" | "compact" | "inline";
	showTimestamps?: boolean;
	defaultSpeed?: number;
	onClose?: () => void;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

function formatTime(seconds: number) {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
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
	onClose,
}: SegmentPlayerProps) {
	const audioRef = useRef<HTMLAudioElement>(null);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playbackSpeed, setPlaybackSpeed] = useState(defaultSpeed);
	const [currentTime, setCurrentTime] = useState(0);
	const animationRef = useRef<number | null>(null);

	const startSec = startMs / 1000;
	const endSec = endMs ? endMs / 1000 : undefined;
	const segmentDuration = endSec ? endSec - startSec : 0;

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

	const handleRestart = useCallback(() => {
		const audio = audioRef.current;
		if (!audio) return;

		audio.currentTime = startSec;
		setCurrentTime(startSec);
	}, [startSec]);

	const handleSpeedChange = useCallback((speed: number) => {
		setPlaybackSpeed(speed);
	}, []);

	// Handle time updates and segment end
	useEffect(() => {
		const audio = audioRef.current;
		if (!audio) return;

		const updateTime = () => {
			setCurrentTime(audio.currentTime);

			// Check if we've passed the end of the segment
			if (endSec && audio.currentTime >= endSec) {
				audio.pause();
				setIsPlaying(false);
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
	}, [isPlaying, endSec]);

	// Update playback rate when speed changes
	useEffect(() => {
		const audio = audioRef.current;
		if (audio) {
			audio.playbackRate = playbackSpeed;
		}
	}, [playbackSpeed]);

	// Calculate segment progress
	const segmentProgress = endSec
		? Math.max(
				0,
				Math.min(100, ((currentTime - startSec) / segmentDuration) * 100),
			)
		: 0;
	const segmentCurrentTime = Math.max(0, currentTime - startSec);

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
				{isPlaying ? <RiPauseLine size={12} /> : <RiPlayLine size={12} />}
				{label && <span>{label}</span>}
				<audio ref={audioRef} src={src} preload="metadata" className="hidden">
					<track kind="captions" />
				</audio>
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
					{isPlaying ? <RiPauseLine size={14} /> : <RiPlayLine size={14} />}
				</Button>
				{showTimestamps && startMs !== undefined && endMs !== undefined && (
					<span className="font-mono text-muted-foreground text-xs">
						{formatTimestamp(startMs)} - {formatTimestamp(endMs)}
					</span>
				)}
				<audio ref={audioRef} src={src} preload="metadata" className="hidden">
					<track kind="captions" />
				</audio>
			</div>
		);
	}

	// Default variant - styled similar to WaveformPlayer but with visual differences
	return (
		<div
			className={cn(
				"rounded-xl border bg-linear-to-br from-primary/10 via-background to-primary/5 p-4",
				className,
			)}
		>
			<div className="flex items-start justify-between gap-4">
				{label && (
					<div className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
						<span className="size-1.5 rounded-full bg-primary/60" />
						{label}
						{showTimestamps && startMs !== undefined && endMs !== undefined && (
							<span className="ml-auto font-mono text-xs tabular-nums">
								{formatTimestamp(startMs)} - {formatTimestamp(endMs)}
							</span>
						)}
					</div>
				)}
				{onClose && (
					<Button
						variant="ghost"
						size="icon"
						className="-mr-1 -mt-1 h-6 w-6 text-muted-foreground hover:text-foreground"
						onClick={onClose}
					>
						<RiCloseLine size={16} />
					</Button>
				)}
			</div>

			{/* Segment progress bar - visual indicator */}
			<div className="relative mb-4 h-1.5 overflow-hidden rounded-full bg-primary/10">
				<div
					className="absolute top-0 left-0 h-full bg-primary/40 transition-all"
					style={{
						width: `${segmentProgress}%`,
					}}
				/>
			</div>

			<div className="flex items-center gap-3">
				<Button
					variant="default"
					size="icon"
					className="size-10 shrink-0 rounded-full"
					onClick={togglePlay}
				>
					{isPlaying ? (
						<RiPauseLine size={18} />
					) : (
						<RiPlayLine size={18} className="ml-0.5" />
					)}
				</Button>

				<div className="flex min-w-0 flex-1 items-center gap-2">
					<span className="font-mono text-muted-foreground text-xs tabular-nums">
						{formatTime(segmentCurrentTime)}
					</span>
					<div className="flex-1" />
					<span className="font-mono text-muted-foreground text-xs tabular-nums">
						{formatTime(segmentDuration)}
					</span>
				</div>

				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0"
					onClick={handleRestart}
				>
					<RiRestartLine size={14} />
				</Button>

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							className="h-8 shrink-0 gap-1 px-2 font-mono text-xs"
						>
							<RiSpeedLine size={14} />
							{playbackSpeed}x
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end" className="min-w-16">
						{PLAYBACK_SPEEDS.map((speed) => (
							<DropdownMenuItem
								key={speed}
								onClick={() => handleSpeedChange(speed)}
								className={cn(
									"font-mono text-xs",
									playbackSpeed === speed && "bg-primary/10",
								)}
							>
								{speed}x
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>

			<audio ref={audioRef} src={src} preload="metadata" className="hidden">
				<track kind="captions" />
			</audio>
		</div>
	);
}

// Utility component for playing a specific error segment
interface ErrorSegmentPlayerProps {
	src: string;
	error: {
		errorType?: string | null;
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

	const startMs = error.timestampStartMs;
	const endMs = error.timestampEndMs;

	return (
		<SegmentPlayer
			src={src}
			startMs={startMs ?? undefined}
			endMs={endMs ?? undefined}
			variant="default"
			className={className}
		/>
	);
}
