"""Audio quality metrics: SNR, VAD, clipping detection, empty segment analysis."""

from __future__ import annotations

import numpy as np
import librosa


# ---------------------------------------------------------------------------
# Core calculations
# ---------------------------------------------------------------------------

def calculate_snr(signal: np.ndarray, noise: np.ndarray) -> float:
    """Calculate Signal-to-Noise Ratio (SNR) in dB."""
    signal = np.asarray(signal)
    noise = np.asarray(noise)
    if len(signal) != len(noise):
        raise ValueError("Signal and noise must have the same length")
    signal_power = np.mean(signal ** 2)
    noise_power = np.mean(noise ** 2)
    if noise_power == 0:
        return np.inf
    return 10 * np.log10(signal_power / noise_power)


def calculate_snr_from_files(clean_file: str, noisy_file: str) -> float:
    """Calculate SNR between two audio files (clean vs noisy)."""
    clean, sr_clean = librosa.load(clean_file, sr=None)
    noisy, sr_noisy = librosa.load(noisy_file, sr=None)
    if sr_clean != sr_noisy:
        noisy = librosa.resample(noisy, orig_sr=sr_noisy, target_sr=sr_clean)
    min_len = min(len(clean), len(noisy))
    noise = noisy[:min_len] - clean[:min_len]
    return calculate_snr(clean[:min_len], noise)


# ---------------------------------------------------------------------------
# Voice Activity Detection (energy-based)
# ---------------------------------------------------------------------------

def detect_noise_segments(
    signal: np.ndarray,
    sr: int,
    frame_length: int = 2048,
    hop_length: int = 512,
    energy_threshold_percentile: float = 20,
) -> np.ndarray:
    """Return a boolean mask (sample-level) where True = noise / non-speech."""
    signal = np.asarray(signal)
    frame_energy = []
    for i in range(0, len(signal) - frame_length + 1, hop_length):
        frame_energy.append(np.mean(signal[i : i + frame_length] ** 2))
    frame_energy = np.array(frame_energy)

    threshold = np.percentile(frame_energy, energy_threshold_percentile)
    noise_frames = frame_energy < threshold

    noise_mask = np.zeros(len(signal), dtype=bool)
    for i, is_noise in enumerate(noise_frames):
        start = i * hop_length
        end = min(start + frame_length, len(signal))
        noise_mask[start:end] = is_noise
    return noise_mask


def estimate_noise_from_signal(
    signal: np.ndarray,
    sr: int,
    method: str = "vad",
    **kwargs,
) -> tuple[np.ndarray, np.ndarray]:
    """Estimate noise from a single recording.

    Returns (noise_estimate, noise_mask).
    """
    signal = np.asarray(signal)

    if method == "vad":
        noise_mask = detect_noise_segments(signal, sr, **kwargs)
        noise_estimate = signal.copy()
        if np.any(noise_mask):
            noise_estimate[~noise_mask] = 0
        else:
            # fallback: use lowest-energy frame
            frame_length = kwargs.get("frame_length", 2048)
            hop_length = kwargs.get("hop_length", 512)
            energies = [
                np.mean(signal[i : i + frame_length] ** 2)
                for i in range(0, len(signal) - frame_length + 1, hop_length)
            ]
            idx = int(np.argmin(energies))
            start = idx * hop_length
            end = min(start + frame_length, len(signal))
            noise_estimate = np.zeros_like(signal)
            noise_estimate[start:end] = signal[start:end]
            noise_mask = np.zeros(len(signal), dtype=bool)
            noise_mask[start:end] = True
    elif method == "spectral_subtraction":
        stft = librosa.stft(signal)
        magnitude = np.abs(stft)
        noise_spectrum = np.min(magnitude, axis=1, keepdims=True)
        noise_stft = noise_spectrum * np.exp(1j * np.angle(stft))
        noise_estimate = librosa.istft(noise_stft, length=len(signal))
        noise_mask = np.ones(len(signal), dtype=bool)
    else:
        raise ValueError(f"Unknown method: {method}")

    return noise_estimate, noise_mask


# ---------------------------------------------------------------------------
# Empty / quiet segment detection
# ---------------------------------------------------------------------------

def detect_empty_segments(
    signal: np.ndarray,
    sr: int,
    frame_length: int = 2048,
    hop_length: int = 512,
    quiet_percentile: float = 10,
    min_segment_duration: float = 0.1,
) -> tuple[np.ndarray, list[tuple[float, float]]]:
    """Detect quiet segments in a recording.

    Returns (empty_mask, list_of_(start, end)_tuples_in_seconds).
    """
    signal = np.asarray(signal)
    frame_energy = []
    frame_times = []

    for i in range(0, len(signal) - frame_length + 1, hop_length):
        frame_energy.append(np.mean(signal[i : i + frame_length] ** 2))
        frame_times.append(i / sr)

    frame_energy = np.array(frame_energy)
    frame_times = np.array(frame_times)

    if len(frame_energy) == 0 or np.max(frame_energy) == 0:
        return np.ones(len(signal), dtype=bool), [(0, len(signal) / sr)]

    lower_q = frame_energy[frame_energy < np.percentile(frame_energy, 25)]
    threshold = np.median(lower_q) if len(lower_q) > 0 else np.percentile(frame_energy, quiet_percentile)

    quiet_frames = frame_energy < threshold

    empty_mask = np.zeros(len(signal), dtype=bool)
    for i, is_quiet in enumerate(quiet_frames):
        start = i * hop_length
        end = min(start + frame_length, len(signal))
        empty_mask[start:end] = is_quiet

    # Extract continuous segments
    min_frames = int(min_segment_duration * sr / hop_length)
    segments: list[tuple[float, float]] = []
    in_seg = False
    seg_start = 0.0
    seg_start_frame = 0

    for i, is_quiet in enumerate(quiet_frames):
        if is_quiet and not in_seg:
            in_seg = True
            seg_start = frame_times[i]
            seg_start_frame = i
        elif not is_quiet and in_seg:
            in_seg = False
            if (i - seg_start_frame) >= min_frames:
                segments.append((seg_start, frame_times[i]))

    if in_seg and (len(quiet_frames) - seg_start_frame) >= min_frames:
        segments.append((seg_start, len(signal) / sr))

    return empty_mask, segments


# ---------------------------------------------------------------------------
# Clipping
# ---------------------------------------------------------------------------

def calculate_clipping_ratio(
    signal: np.ndarray,
    threshold: float = 0.99,
) -> tuple[float, int, float]:
    """Return (clipping_ratio_percent, num_clipped, peak_amplitude)."""
    signal = np.asarray(signal)
    clipped = np.abs(signal) >= threshold
    num_clipped = int(np.sum(clipped))
    ratio = (num_clipped / len(signal)) * 100
    peak = float(np.max(np.abs(signal)))
    return ratio, num_clipped, peak


def calculate_clipping_from_file(
    audio_file: str,
    threshold: float = 0.99,
) -> tuple[float, int, float, float]:
    """Return (clipping_ratio, num_clipped, peak_amplitude, peak_dBFS)."""
    signal, _ = librosa.load(audio_file, sr=None)
    ratio, num_clipped, peak = calculate_clipping_ratio(signal, threshold)
    peak_db = 20 * np.log10(peak) if peak > 0 else -np.inf
    return ratio, num_clipped, peak, peak_db


# ---------------------------------------------------------------------------
# Single-file combined analysis
# ---------------------------------------------------------------------------

def analyze_audio_file(
    audio_file: str,
    method: str = "vad",
    **kwargs,
) -> dict:
    """Run all quality metrics on a single audio file.  Returns a summary dict."""
    signal, sr = librosa.load(audio_file, sr=None)

    noise_est, noise_mask = estimate_noise_from_signal(signal, sr, method=method, **kwargs)
    empty_mask, empty_segments = detect_empty_segments(signal, sr, **kwargs)
    clip_ratio, num_clipped, peak, peak_db = calculate_clipping_from_file(audio_file)

    # SNR from VAD
    if method == "vad" and np.any(~noise_mask):
        signal_power = np.mean(signal[~noise_mask] ** 2)
    else:
        signal_power = np.mean(signal ** 2)

    noise_power = np.mean(noise_est[noise_mask] ** 2) if np.any(noise_mask) else np.mean(noise_est ** 2)
    snr = 10 * np.log10(signal_power / noise_power) if noise_power > 0 else np.inf

    return {
        "snr_db": snr,
        "clipping_ratio": clip_ratio,
        "num_clipped": num_clipped,
        "peak_amplitude": peak,
        "peak_db": peak_db,
        "noise_pct": np.sum(noise_mask) / len(noise_mask) * 100,
        "empty_pct": np.sum(empty_mask) / len(empty_mask) * 100,
        "empty_segments": empty_segments,
    }


# ---------------------------------------------------------------------------
# Terminal visualization
# ---------------------------------------------------------------------------

def visualize_segments(
    signal: np.ndarray,
    sr: int,
    noise_mask: np.ndarray,
    empty_mask: np.ndarray,
    empty_segments: list[tuple[float, float]],
    width: int = 80,
) -> tuple[str, str, list[str]]:
    """Return (timeline_str, legend_str, formatted_segments)."""
    duration = len(signal) / sr
    RESET = "\033[0m"
    SPEECH = "\033[92m"
    NOISE = "\033[93m"
    EMPTY = "\033[91m"
    BOLD = "\033[1m"

    timeline = []
    for i in range(width):
        idx = min(int((i / width) * duration * sr), len(signal) - 1)
        if empty_mask[idx]:
            timeline.append(f"{EMPTY}\u2588{RESET}")
        elif noise_mask[idx]:
            timeline.append(f"{NOISE}\u2588{RESET}")
        else:
            timeline.append(f"{SPEECH}\u2588{RESET}")

    legend = f"{BOLD}Legend:{RESET} {SPEECH}\u2588{RESET} Speech  {NOISE}\u2588{RESET} Noise  {EMPTY}\u2588{RESET} Empty"
    formatted = [f"({s:.3f}, {e:.3f})" for s, e in empty_segments]

    return "".join(timeline), legend, formatted
