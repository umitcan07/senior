"""F0 contours per utterance.

Intonation is the one area that needs the audio, not just the annotation. We
extract an F0 track and downsample it to a compact contour the site plots
beneath the waveform.

Two backends, in order of preference:

* **Parselmouth** (Praat) — the accurate one. `pip install praat-parselmouth`.
* **numpy autocorrelation fallback** — pure numpy, always available. Less
  precise (no octave-jump repair, cruder voicing) but good enough to render a
  readable contour, so the intonation area works out of the box.

Like rhythm, this is presented as a **measurement**, not a verdict: there is no
per-token correct/incorrect here. The contour is shown for inspection, with
summary statistics (range, mean, final slope) that a teacher can read.

If neither the audio nor numpy is available, the utterance emits `pitch: null`
and the site degrades to "no contour" while every other area still works.
"""

from __future__ import annotations

import wave
from dataclasses import dataclass
from pathlib import Path

try:  # pragma: no cover - import guard
    import numpy as np

    _NUMPY = True
except Exception:  # pragma: no cover
    _NUMPY = False

try:  # pragma: no cover - import guard
    import parselmouth  # type: ignore

    _PARSELMOUTH = True
except Exception:  # pragma: no cover
    _PARSELMOUTH = False


def available() -> bool:
    """True if any F0 backend can run."""
    return _PARSELMOUTH or _NUMPY


def backend() -> str:
    if _PARSELMOUTH:
        return "parselmouth"
    if _NUMPY:
        return "numpy-autocorr"
    return "none"


@dataclass(frozen=True)
class PitchContour:
    times: list[float]  # seconds, relative to utterance start
    f0: list[float | None]  # Hz, None where unvoiced
    f0_min: float | None
    f0_max: float | None
    f0_mean: float | None
    final_slope: float | None  # Hz/s over the last voiced ~200 ms

    def as_dict(self) -> dict[str, object]:
        return {
            "times": [round(t, 3) for t in self.times],
            "f0": [round(v, 1) if v is not None else None for v in self.f0],
            "min": round(self.f0_min, 1) if self.f0_min is not None else None,
            "max": round(self.f0_max, 1) if self.f0_max is not None else None,
            "mean": round(self.f0_mean, 1) if self.f0_mean is not None else None,
            "finalSlope": round(self.final_slope, 1)
            if self.final_slope is not None
            else None,
        }


def extract_contour(
    wav_path: Path,
    t0: float,
    t1: float,
    *,
    max_points: int = 120,
    pitch_floor: float = 60.0,
    pitch_ceiling: float = 400.0,
) -> PitchContour | None:
    """Extract a downsampled F0 contour for [t0, t1] of `wav_path`.

    Returns None if Parselmouth is unavailable or the segment has no voiced
    frames. `max_points` caps the contour length so the JSON stays small even
    for an 18 s utterance.
    """
    if _PARSELMOUTH:
        sound = parselmouth.Sound(str(wav_path))
        segment = sound.extract_part(
            from_time=max(t0, sound.xmin),
            to_time=min(t1, sound.xmax),
            preserve_times=False,
        )
        pitch = segment.to_pitch(pitch_floor=pitch_floor, pitch_ceiling=pitch_ceiling)
        values = pitch.selected_array["frequency"]  # 0 where unvoiced
        times = pitch.xs()
    elif _NUMPY:
        result = _autocorr_pitch(wav_path, t0, t1, pitch_floor, pitch_ceiling)
        if result is None:
            return None
        times, values = result
    else:
        return None

    if len(values) == 0:
        return None

    # Downsample by striding to at most max_points.
    stride = max(1, len(values) // max_points)
    idx = range(0, len(values), stride)
    out_times = [float(times[i]) for i in idx]
    out_f0 = [float(values[i]) if values[i] > 0 else None for i in idx]

    voiced = [v for v in values if v > 0]
    if not voiced:
        return None

    return PitchContour(
        times=out_times,
        f0=out_f0,
        f0_min=float(np.min(voiced)),
        f0_max=float(np.max(voiced)),
        f0_mean=float(np.mean(voiced)),
        final_slope=_final_slope(times, values),
    )


def _read_wav_mono(wav_path: Path) -> tuple["np.ndarray", int] | None:
    """Read a WAV as float32 mono via the stdlib wave module + numpy."""
    with wave.open(str(wav_path), "rb") as w:
        sr = w.getframerate()
        n = w.getnframes()
        ch = w.getnchannels()
        width = w.getsampwidth()
        raw = w.readframes(n)
    if width == 2:
        data = np.frombuffer(raw, dtype="<i2").astype(np.float32) / 32768.0
    elif width == 4:
        data = np.frombuffer(raw, dtype="<i4").astype(np.float32) / 2147483648.0
    elif width == 1:
        data = (np.frombuffer(raw, dtype=np.uint8).astype(np.float32) - 128) / 128.0
    else:
        return None
    if ch > 1:
        data = data.reshape(-1, ch).mean(axis=1)
    return data, sr


def _autocorr_pitch(
    wav_path: Path,
    t0: float,
    t1: float,
    floor: float,
    ceiling: float,
    frame_s: float = 0.04,
    hop_s: float = 0.01,
) -> tuple[list[float], "np.ndarray"] | None:
    """Frame-wise F0 via normalised autocorrelation. numpy-only fallback.

    Deliberately simple: Hann window, peak of the autocorrelation between the
    lags corresponding to `ceiling` and `floor`, with a voicing gate on the
    normalised peak height. No octave-jump repair — Parselmouth is preferred
    when present — but it produces a legible contour from clean speech.
    """
    got = _read_wav_mono(wav_path)
    if got is None:
        return None
    data, sr = got
    a = max(0, int(t0 * sr))
    b = min(len(data), int(t1 * sr))
    seg = data[a:b]
    if len(seg) < int(frame_s * sr):
        return None

    frame = int(frame_s * sr)
    hop = int(hop_s * sr)
    min_lag = max(2, int(sr / ceiling))
    max_lag = min(frame - 1, int(sr / floor))
    if max_lag <= min_lag:
        return None

    win = np.hanning(frame)
    times: list[float] = []
    freqs: list[float] = []
    for start in range(0, len(seg) - frame, hop):
        f = seg[start : start + frame] * win
        energy = float(np.dot(f, f))
        times.append((start + frame / 2) / sr)
        if energy < 1e-6:
            freqs.append(0.0)
            continue
        corr = np.correlate(f, f, mode="full")[frame - 1 :]
        window = corr[min_lag : max_lag + 1]
        if len(window) == 0:
            freqs.append(0.0)
            continue
        lag = int(np.argmax(window)) + min_lag
        peak = corr[lag] / (corr[0] + 1e-9)
        # Voicing gate: require the periodic peak to carry real energy.
        freqs.append(sr / lag if peak > 0.3 else 0.0)

    return times, np.array(freqs, dtype=np.float32)


def _final_slope(times, values, window_s: float = 0.2) -> float | None:
    """Linear slope (Hz/s) over the final voiced `window_s` — nuclear rise/fall."""
    voiced = [(t, v) for t, v in zip(times, values) if v > 0]
    if len(voiced) < 2:
        return None
    end = voiced[-1][0]
    tail = [(t, v) for t, v in voiced if t >= end - window_s]
    if len(tail) < 2:
        tail = voiced[-2:]
    ts = [float(t) for t, _ in tail]
    vs = [float(v) for _, v in tail]
    span = ts[-1] - ts[0]
    return (vs[-1] - vs[0]) / span if span else None
