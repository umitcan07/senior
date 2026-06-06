"""Silero VAD wrapper (E3.1 / issue #18).

Voice-activity detection used by the assess orchestrator to abstain with
``no_speech`` before any (GPU) phone recognition runs. The model is small and
CPU-only — a singleton loaded once on container startup, same pattern as
``mod/alignment.py`` ``get_aligner``.
"""

import logging
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)

TARGET_SR = 16000

_model = None


def get_model():
    """Lazy-load the Silero VAD model once and cache it (CPU)."""
    global _model
    if _model is None:
        from silero_vad import load_silero_vad

        log.info("Loading Silero VAD (CPU)")
        _model = load_silero_vad()
    return _model


def has_speech(
    audio: np.ndarray, sr: int = TARGET_SR
) -> tuple[bool, list[tuple[float, float]]]:
    """Detect whether ``audio`` contains any speech.

    Args:
        audio: mono float32 samples in [-1, 1].
        sr: sample rate (Silero supports 16 kHz / 8 kHz; we use 16 kHz).

    Returns:
        ``(any_speech_detected, [(start_s, end_s), ...])`` — the bool is True iff
        at least one speech region was found; the list holds those regions in
        seconds. Pure silence returns ``(False, [])``.
    """
    import torch
    from silero_vad import get_speech_timestamps

    if audio.dtype != np.float32:
        audio = audio.astype(np.float32)
    # Silero expects a 1-D float32 tensor.
    tensor = torch.from_numpy(np.ascontiguousarray(audio))

    stamps = get_speech_timestamps(
        tensor,
        get_model(),
        sampling_rate=sr,
        return_seconds=True,
    )
    regions = [(float(s["start"]), float(s["end"])) for s in stamps]
    return (len(regions) > 0, regions)
