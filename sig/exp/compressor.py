#!/usr/bin/env python3
"""
Simple Feed-Forward Compressor Demonstration
"""

import soundfile as sf
import numpy as np
import pyloudnorm as pyln
import matplotlib.pyplot as plt
import sys

# Try to import numba for JIT compilation (optional)
try:
    from numba import jit
    HAS_NUMBA = True
except ImportError:
    HAS_NUMBA = False
    # Dummy decorator if numba not available
    def jit(*args, **kwargs):
        def decorator(func):
            return func
        return decorator

# ----------------------
# Compressor parameters
# ----------------------
THRESHOLD_DB = -18.0   # dBFS threshold
RATIO = 4.0             # compression ratio
ATTACK_MS = 5.0         # ms
RELEASE_MS = 100.0      # ms
MAKEUP_GAIN_DB = 6.0    # add output gain compensation


def db_to_lin(db):
    return 10 ** (db / 20.0)


def lin_to_db(x):
    return 20 * np.log10(np.clip(x, 1e-12, None))


def _envelope_follower_impl(rect_ch, attack_coeff, release_coeff, num_samples):
    """Envelope follower for a single channel."""
    env_ch = np.zeros(num_samples)
    for n in range(1, num_samples):
        if rect_ch[n] > env_ch[n - 1]:
            env_ch[n] = attack_coeff * env_ch[n - 1] + (1 - attack_coeff) * rect_ch[n]
        else:
            env_ch[n] = release_coeff * env_ch[n - 1] + (1 - release_coeff) * rect_ch[n]
    return env_ch

# JIT compile if numba is available
if HAS_NUMBA:
    _envelope_follower = jit(nopython=True, cache=True)(_envelope_follower_impl)
else:
    _envelope_follower = _envelope_follower_impl


def compressor(x, fs):
    """Feeding-forward dynamic range compressor with envelope follower."""
    attack_coeff = np.exp(-1.0 / (0.001 * ATTACK_MS * fs))
    release_coeff = np.exp(-1.0 / (0.001 * RELEASE_MS * fs))

    # Handle multi-channel audio
    original_shape = x.shape
    if x.ndim == 1:
        x = x[:, np.newaxis]  # Convert to 2D for consistent processing
    num_samples, num_channels = x.shape
    
    # Rectified signal
    rect = np.abs(x)
    
    # Envelope detection (rectified, smoothed) - process each channel
    env = np.zeros_like(x)
    
    # Process each channel independently (JIT-compiled if numba available)
    for ch in range(num_channels):
        rect_ch = rect[:, ch]
        env[:, ch] = _envelope_follower(rect_ch, attack_coeff, release_coeff, num_samples)
    
    # Vectorized gain calculation
    env_db = lin_to_db(env)
    gain_db = np.where(env_db > THRESHOLD_DB, 
                       (THRESHOLD_DB - env_db) * (1 - 1 / RATIO),
                       0.0)
    g = db_to_lin(gain_db)

    # Apply smoothed gain and makeup
    y = x * g * db_to_lin(MAKEUP_GAIN_DB)
    
    # Convert back to original shape
    if len(original_shape) == 1:
        y = y[:, 0]
        g = g[:, 0]
    
    return y, g


def analyze_loudness(signal, rate):
    """Compute integrated loudness (LUFS) using pyloudnorm."""
    meter = pyln.Meter(rate)
    loudness = meter.integrated_loudness(signal)
    peak = 20 * np.log10(np.max(np.abs(signal)))
    return loudness, peak


def main():
    if len(sys.argv) != 2:
        print("Usage: python compressor.py <path/to/file.flac>")
        sys.exit(1)
    in_path = sys.argv[1]
    out_path = f"{in_path.split('.')[0]}_compressed.flac"

    x, fs = sf.read(in_path)
    print(f"Loaded {len(x)} samples at {fs} Hz")

    y, gain = compressor(x, fs)

    sf.write(out_path, y, fs)
    print(f"Wrote compressed output to: {out_path}")

    # Loudness analysis
    l_in, p_in = analyze_loudness(x, fs)
    l_out, p_out = analyze_loudness(y, fs)

    print("\nLoudness results:")
    print(f"Input Loudness: {l_in:.2f} LUFS | Peak: {p_in:.2f} dBFS")
    print(f"Output Loudness: {l_out:.2f} LUFS | Peak: {p_out:.2f} dBFS")

    # Visualization
    t = np.arange(len(x)) / fs
    plt.figure(figsize=(10, 5))
    plt.plot(t, x, label="Input", alpha=0.5)
    plt.plot(t, y, label="Compressed", alpha=0.7)
    plt.title("Waveform Before and After Compression")
    plt.xlabel("Time [s]")
    plt.ylabel("Amplitude")
    plt.legend()
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    main()