"use client";

import {
	RiPauseLine,
	RiPlayLine,
	RiRestartLine,
	RiSpeedLine,
} from "@remixicon/react";
import { useWavesurfer } from "@wavesurfer/react";
import { useCallback, useEffect, useRef, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import Regions from "wavesurfer.js/dist/plugins/regions.esm.js";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";

// Error region types
export interface ErrorRegion {
	id?: string;
	start: number;
	end: number;
	type: "substitute" | "insert" | "delete";
	label?: string;
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

const ERROR_COLORS = {
	substitute: "rgba(239, 68, 68, 0.3)",
	insert: "rgba(245, 158, 11, 0.3)",
	delete: "rgba(59, 130, 246, 0.3)",
} as const;

export interface WaveformPlayerProps {
	src: string;
	errorRegions?: ErrorRegion[];
	onRegionClick?: (startMs: number, endMs: number, type: string) => void;
	compact?: boolean;
	className?: string;
	defaultSpeed?: number;
	showSpeedControl?: boolean;
	showRestartButton?: boolean;
	label?: string;
}

function WaveformPlayerContent({
	src,
	errorRegions = [],
	onRegionClick,
	compact = false,
	className,
	defaultSpeed = 1,
	showSpeedControl = true,
	showRestartButton = false,
	label,
}: WaveformPlayerProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const regionsPluginRef = useRef<ReturnType<typeof Regions.create> | null>(
		null,
	);
	const [playbackSpeed, setPlaybackSpeed] = useState(defaultSpeed);
	const [currentTime, setCurrentTime] = useState(0);
	const [duration, setDuration] = useState(0);

	const { wavesurfer, isReady, isPlaying } = useWavesurfer({
		container: containerRef,
		url: src,
		height: compact ? 40 : 56,
		waveColor: "rgba(120, 120, 120)",
		progressColor: "rgba(80, 80, 80, 0.5)",
		cursorColor: "rgba(80, 80, 80, 0.8)",
		cursorWidth: 2,
		barWidth: 2,
		barGap: 4,
		barRadius: 4,
		barHeight: .75,
		normalize: true,
		interact: true, // Enable click-to-seek
	});

	// Store current error regions for click handler
	const errorRegionsRef = useRef(errorRegions);
	useEffect(() => {
		errorRegionsRef.current = errorRegions;
	}, [errorRegions]);

	// Initialize regions plugin when wavesurfer is ready
	useEffect(() => {
		if (!wavesurfer || !isReady) return;

		// Create and register regions plugin only once
		if (!regionsPluginRef.current) {
			const regions = Regions.create();
			wavesurfer.registerPlugin(regions);
			regionsPluginRef.current = regions;

			// Handle region clicks - use ref to get current errorRegions
			if (onRegionClick) {
				regions.on("region-clicked", (region, e) => {
					const currentRegions = errorRegionsRef.current;
					// Find the region data by matching the region ID
					const regionIndex = currentRegions.findIndex(
						(r, idx) => r.id === region.id || `error-${idx}` === region.id,
					);
					if (regionIndex >= 0) {
						const regionData = currentRegions[regionIndex];
						// Convert seconds to ms for the callback
						onRegionClick(
							regionData.start * 1000,
							regionData.end * 1000,
							regionData.type,
						);
					}
					e.stopPropagation();
				});
			}
		}

		const regions = regionsPluginRef.current;

		// Clear existing regions and add new ones
		regions.clearRegions();

		// Add error regions
		errorRegions.forEach((region, index) => {
			const regionId = region.id || `error-${index}`;
			regions.addRegion({
				id: regionId,
				start: region.start, // Convert ms to seconds
				end: region.end,
				color: ERROR_COLORS[region.type],
				content: region.label,
				drag: false,
				resize: false,
			});
		});
	}, [wavesurfer, isReady, errorRegions, onRegionClick]);

	// Update playback speed
	useEffect(() => {
		if (wavesurfer && isReady) {
			wavesurfer.setPlaybackRate(playbackSpeed);
		}
	}, [wavesurfer, isReady, playbackSpeed]);

	// Update current time and duration
	useEffect(() => {
		if (!wavesurfer || !isReady) return;

		const updateTime = () => {
			if (wavesurfer) {
				const time = wavesurfer.getCurrentTime();
				const dur = wavesurfer.getDuration();
				setCurrentTime(time);
				if (dur && dur !== duration) {
					setDuration(dur);
				}
			}
		};

		// Initial update
		updateTime();

		// Listen to timeupdate events
		const unsubscribe = wavesurfer.on("timeupdate", updateTime);
		wavesurfer.on("decode", () => {
			updateTime();
		});

		return () => {
			unsubscribe();
		};
	}, [wavesurfer, isReady, duration]);

	// Set initial duration when ready
	useEffect(() => {
		if (wavesurfer && isReady) {
			const dur = wavesurfer.getDuration();
			if (dur) {
				setDuration(dur);
			}
		}
	}, [wavesurfer, isReady]);

	const handleSpeedChange = useCallback((speed: number) => {
		setPlaybackSpeed(speed);
	}, []);

	const handleRestart = useCallback(() => {
		if (wavesurfer) {
			wavesurfer.setTime(0);
			setCurrentTime(0);
		}
	}, [wavesurfer]);

	const handlePlayPause = useCallback(() => {
		if (wavesurfer) {
			wavesurfer.playPause();
		}
	}, [wavesurfer]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = Math.floor(seconds % 60);
		return `${mins}:${secs.toString().padStart(2, "0")}`;
	};

	return (
		<div
			className={cn(
				"rounded-xl border bg-gradient-to-br from-primary/0 via-background to-primary/5",
				compact ? "p-3" : "p-4",
				className,
			)}
		>
			{label && (
				<div className="mb-3 flex items-center gap-2 text-muted-foreground text-sm">
					{label}
				</div>
			)}
			<div
				className={cn(
					"relative overflow-hidden rounded-sm bg-primary/4 flex items-center justify-center",
					compact ? "min-h-16" : "min-h-24",
				)}
			>
				<div ref={containerRef} className="w-full" />
			</div>

			<div className={cn("flex items-center gap-3", compact ? "mt-2" : "mt-4")}>
				<Button
					variant="default"
					size="icon"
					className={cn(
						"shrink-0 rounded-full",
						compact ? "size-8" : "size-10",
					)}
					onClick={handlePlayPause}
					disabled={!isReady}
				>
					{isPlaying ? (
						<RiPauseLine size={compact ? 16 : 18} />
					) : (
						<RiPlayLine size={compact ? 16 : 18} className="ml-0.5" />
					)}
				</Button>

				<div className="flex min-w-0 flex-1 items-center gap-2">
					<span className="font-mono text-muted-foreground text-xs tabular-nums">
						{formatTime(currentTime)}
					</span>
					<div className="flex-1" />
					<span className="font-mono text-muted-foreground text-xs tabular-nums">
						{formatTime(duration)}
					</span>
				</div>

				{showRestartButton && (
					<Button
						variant="ghost"
						size="icon"
						className={cn("shrink-0", compact ? "size-7" : "size-8")}
						onClick={handleRestart}
						disabled={!isReady}
					>
						<RiRestartLine size={compact ? 14 : 16} />
					</Button>
				)}

				{showSpeedControl && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="sm"
								className={cn(
									"shrink-0 gap-1 font-mono",
									compact ? "h-7 px-2 text-[10px]" : "h-8 px-2 text-xs",
								)}
							>
								<RiSpeedLine size={compact ? 12 : 14} />
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
				)}
			</div>
		</div>
	);
}

function LoadingSkeleton({
	compact,
	className,
}: {
	compact?: boolean;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"rounded-xl border bg-gradient-to-br from-primary/0 via-background to-primary/5",
				compact ? "p-3" : "p-4",
				className,
			)}
		>
			<div
				className={cn(
					"flex items-center justify-center rounded-lg bg-primary/20 animate-pulse",
					compact ? "h-12" : "h-16",
				)}
			>
				<span className="text-muted-foreground text-xs">
					Loading waveform...
				</span>
			</div>
		</div>
	);
}

export function WaveformPlayer(props: WaveformPlayerProps) {
	// Only render on client to avoid hydration mismatch
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	if (!isMounted) {
		return (
			<LoadingSkeleton compact={props.compact} className={props.className} />
		);
	}

	return (
		<ErrorBoundary
			fallback={
				<div
					className={cn(
						"rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-center",
						props.compact ? "p-3" : "p-4",
						props.className,
					)}
				>
					<span className="text-destructive text-xs">
						Failed to load waveform
					</span>
				</div>
			}
		>
			<WaveformPlayerContent {...props} />
		</ErrorBoundary>
	);
}

export function WaveformPlayerInline(props: {
	src: string;
	className?: string;
}) {
	return (
		<WaveformPlayer
			src={props.src}
			compact
			showSpeedControl={false}
			showRestartButton={false}
			className={props.className}
		/>
	);
}

export default WaveformPlayer;
