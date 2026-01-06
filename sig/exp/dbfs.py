#!/usr/bin/env python3
"""
Analyze LUFS and dBFS of a FLAC track and compare it to industry standards.
"""

import sys
import soundfile as sf
import numpy as np
import pyloudnorm as pyln

# Industry loudness targets (approximate integrated LUFS)
STREAMING_STANDARDS = {
    "Spotify": -14.0,
    "Apple Music": -16.0,
    "YouTube": -14.0,
    "Tidal": -14.0,
    "Amazon Music": -13.0,
    "Broadcast TV (EBU R128)": -23.0,
}

def analyze_track(path: str):
    """Analyze the LUFS and dBFS of a given FLAC file."""
    data, rate = sf.read(path)
    meter = pyln.Meter(rate)  # EBU R128 meter

    # LUFS analysis
    loudness = meter.integrated_loudness(data)
    
    # Peak level (in dBFS)
    true_peak = 20 * np.log10(np.max(np.abs(data)))
    
    return loudness, true_peak


def compare_to_standards(loudness: float):
    """Return difference from standard targets."""
    comparisons = {}
    for platform, target in STREAMING_STANDARDS.items():
        diff = loudness - target
        comparisons[platform] = diff
    return comparisons


def main():
    if len(sys.argv) != 2:
        print("Usage: python analyze_loudness.py <path/to/file.flac>")
        sys.exit(1)

    path = sys.argv[1]
    lufs, dbfs = analyze_track(path)
    print(f"\nAnalysis for: {path}")
    print(f"Integrated Loudness (LUFS): {lufs:.2f}")
    print(f"True Peak (dBFS): {dbfs:.2f}")

    print("\nComparison to common streaming loudness targets:")
    differences = compare_to_standards(lufs)
    for platform, diff in differences.items():
        sign = "+" if diff > 0 else ""
        print(f"  {platform}: {diff:+.2f} dB from target")

    print("\nInterpretation:")
    if lufs > -14:
        print("→ Track is louder than most streaming targets (likely downscaled).")
    elif lufs < -16:
        print("→ Track is quieter; normalization may boost it.")
    else:
        print("→ Track is close to streaming standards — suitable for upload.")


if __name__ == "__main__":
    main()