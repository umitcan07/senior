"""Pronunciation assessment orchestrator (E3.2 / #19, contract #22).

Aligner-only, reference-based. Given a learner recording and the precomputed
reference phones, this:

  1. loads the audio (16 kHz mono),
  2. runs a cascade of *abstention* gates (no_speech, low_audio_quality,
     duration_out_of_range, wrong_sentence, uncertain) and returns early with a
     reason instead of a misleading score, then
  3. otherwise scores the recording against the reference via ``phone_diff`` and
     attaches per-phone GOP / entropy and real POWSM CTC timestamps.

V1's PR+G2P+ASR three-model load and the ASR ``word_score`` path were removed
here: content mismatch is detected from the phone error rate vs the reference
(no ASR, no target-text priming). See doc/V2_CONTEXT.md §3.
"""

import logging
import os
import sys
from typing import Dict, List, Optional

import numpy as np

# Add parent directory (mod/) to path to import shared + sibling modules.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import alignment  # mod/alignment.py
import gop_scoring  # mod/gop_scoring.py
from phone_diff import phone_diff  # mod/phone_diff.py
from shared.audio import load_audio
from vad import has_speech

log = logging.getLogger(__name__)

# --- Abstention thresholds (first-pass; tuned in the E6 validation study). ----
SNR_MIN_DB = 5.0
MIN_DURATION_S = 0.5
MAX_DURATION_S = 25.0
WRONG_SENTENCE_PER = 0.7  # phone error rate vs reference above this == wrong content
UNCERTAIN_THRESHOLD = gop_scoring.DEFAULT_ENTROPY_THRESHOLD  # 2.0 nats


# ============================================================================
# SIGNAL QUALITY CHECKS
# ============================================================================

def check_signal_quality(audio: np.ndarray, sample_rate: int) -> Dict:
    """
    Analyze audio signal quality and return metrics.

    Checks for:
    - RMS level (too quiet or too loud)
    - Clipping (samples at max amplitude)
    - Silence ratio (percentage of silent frames)
    - Estimated SNR (signal-to-noise ratio)

    Returns a dict with is_acceptable, quality_score, rms_db, clipping_ratio,
    silence_ratio, snr_estimate_db, duration_seconds, warnings, suggestions.
    """
    warnings = []
    suggestions = []

    # Ensure mono audio
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)

    # Normalize to float if needed
    if audio.dtype != np.float32 and audio.dtype != np.float64:
        audio = audio.astype(np.float32) / np.iinfo(audio.dtype).max

    # 1. RMS Level
    rms = np.sqrt(np.mean(audio ** 2))
    rms_db = 20 * np.log10(rms + 1e-10)  # Add epsilon to avoid log(0)

    # Target RMS: -20dB to -6dB is typical for speech
    if rms_db < -40:
        warnings.append("audio_too_quiet")
        suggestions.append("Speak louder or move closer to the microphone")
    elif rms_db < -30:
        warnings.append("audio_quiet")
        suggestions.append("Consider speaking slightly louder")
    elif rms_db > -3:
        warnings.append("audio_too_loud")
        suggestions.append("Move away from the microphone or reduce input gain")

    # 2. Clipping Detection
    clip_threshold = 0.99
    clipped_samples = np.sum(np.abs(audio) >= clip_threshold)
    clipping_ratio = clipped_samples / len(audio)

    if clipping_ratio > 0.01:  # More than 1% clipped
        warnings.append("severe_clipping")
        suggestions.append("Reduce recording volume to avoid distortion")
    elif clipping_ratio > 0.001:  # More than 0.1% clipped
        warnings.append("minor_clipping")
        suggestions.append("Consider reducing recording volume slightly")

    # 3. Silence Detection (using frame-based energy)
    frame_size = int(0.025 * sample_rate)  # 25ms frames
    hop_size = int(0.010 * sample_rate)    # 10ms hop

    num_frames = max(1, (len(audio) - frame_size) // hop_size + 1)
    frame_energies = []

    for i in range(num_frames):
        start = i * hop_size
        end = min(start + frame_size, len(audio))
        frame = audio[start:end]
        energy = np.sum(frame ** 2)
        frame_energies.append(energy)

    frame_energies = np.array(frame_energies)

    # Consider frames with energy < 1% of max as silence
    energy_threshold = np.max(frame_energies) * 0.01 if len(frame_energies) > 0 else 0
    silent_frames = np.sum(frame_energies < energy_threshold)
    silence_ratio = silent_frames / max(1, len(frame_energies))

    if silence_ratio > 0.7:
        warnings.append("mostly_silence")
        suggestions.append("Make sure to speak during the recording")
    elif silence_ratio > 0.5:
        warnings.append("excessive_silence")
        suggestions.append("Try to fill more of the recording with speech")

    # 4. SNR Estimation (simple method: signal power vs noise floor)
    if len(frame_energies) > 10:
        sorted_energies = np.sort(frame_energies)
        noise_floor = np.mean(sorted_energies[:len(sorted_energies) // 10])
        signal_power = np.mean(sorted_energies[len(sorted_energies) // 2:])  # Top 50%

        if noise_floor > 0:
            snr_estimate_db = 10 * np.log10((signal_power + 1e-10) / (noise_floor + 1e-10))
        else:
            snr_estimate_db = 40.0  # Assume good SNR if noise floor is 0
    else:
        snr_estimate_db = 20.0  # Default estimate for very short audio

    if snr_estimate_db < 10:
        warnings.append("low_snr")
        suggestions.append("Record in a quieter environment or use a better microphone")
    elif snr_estimate_db < 15:
        warnings.append("moderate_noise")
        suggestions.append("Consider reducing background noise")

    # 5. Duration check
    duration = len(audio) / sample_rate
    if duration < 0.5:
        warnings.append("too_short")
        suggestions.append("Recording is very short, speak longer for better analysis")
    elif duration > 30:
        warnings.append("too_long")
        suggestions.append("Recording is long, consider shorter segments for faster processing")

    # Calculate overall quality score
    quality_score = 1.0
    if "audio_too_quiet" in warnings:
        quality_score -= 0.3
    elif "audio_quiet" in warnings:
        quality_score -= 0.1
    if "audio_too_loud" in warnings:
        quality_score -= 0.2
    if "severe_clipping" in warnings:
        quality_score -= 0.4
    elif "minor_clipping" in warnings:
        quality_score -= 0.1
    if "mostly_silence" in warnings:
        quality_score -= 0.5
    elif "excessive_silence" in warnings:
        quality_score -= 0.2
    if "low_snr" in warnings:
        quality_score -= 0.3
    elif "moderate_noise" in warnings:
        quality_score -= 0.1
    if "too_short" in warnings:
        quality_score -= 0.2

    quality_score = max(0.0, quality_score)
    is_acceptable = quality_score >= 0.5 and "mostly_silence" not in warnings

    return {
        "is_acceptable": is_acceptable,
        "quality_score": round(quality_score, 2),
        "rms_db": round(rms_db, 1),
        "clipping_ratio": round(clipping_ratio, 4),
        "silence_ratio": round(silence_ratio, 2),
        "snr_estimate_db": round(snr_estimate_db, 1),
        "duration_seconds": round(duration, 2),
        "warnings": warnings,
        "suggestions": suggestions,
    }


def parse_ipa_phonemes(ipa_phonemes: str) -> List[str]:
    """Parse phones from POWSM IPA format (e.g. ``/h//ɛ//l//o//ʊ/``) to bare tokens."""
    cleaned = ipa_phonemes.strip().strip("/")
    if not cleaned:
        return []
    return [p.strip("/") for p in cleaned.split("//") if p.strip("/")]


def _ipa_str(phones: List[str]) -> str:
    """Render bare phones back to POWSM ``/.../`` format for storage/display."""
    return "".join(f"/{p}/" for p in phones)


def _abstain(reason: str, detail: Dict, signal_quality: Dict) -> Dict:
    """Build the abstention response (no score; UI shows a banner — #38)."""
    log.info("Abstaining: reason=%s detail=%s", reason, detail)
    return {
        "status": "abstained",
        "abstention": {"reason": reason, "detail": detail},
        "signal_quality": signal_quality,
    }


def assess(
    audio_uri: str,
    reference_id: Optional[str] = None,
    reference_phones: Optional[List[str]] = None,
    reference_ipa: Optional[str] = None,
    device: Optional[str] = None,
) -> Dict:
    """Download the recording and assess it (see ``assess_audio``)."""
    audio, sr = load_audio(audio_uri)
    return assess_audio(
        audio,
        sr,
        reference_id=reference_id,
        reference_phones=reference_phones,
        reference_ipa=reference_ipa,
        device=device,
    )


def assess_audio(
    audio: np.ndarray,
    sr: int,
    reference_id: Optional[str] = None,
    reference_phones: Optional[List[str]] = None,
    reference_ipa: Optional[str] = None,
    device: Optional[str] = None,
) -> Dict:
    """Assess a preloaded recording against a reference, abstaining on non-happy paths.

    Split out from ``assess`` so the offline harness (mod/dev/verify.py) can run
    the real pipeline on local clips without a URL download.

    Args:
        audio: mono float32 samples (16 kHz).
        sr: sample rate.
        reference_id: opaque id (for logging/traceability only).
        reference_phones: precomputed reference phones (bare tokens). Preferred;
            the app derives these from ``reference_speeches.phone_timings_json``.
        reference_ipa: POWSM-format reference IPA; used to derive phones if
            ``reference_phones`` is absent, and echoed back as ``target_ipa``.
        device: "cuda"/"cpu"; aligner auto-detects when None.

    Returns:
        Either an abstention dict ``{status:"abstained", abstention, signal_quality}``
        or a scored dict ``{status:"scored", score, confidence, errors, phones, ...}``.
    """
    if reference_phones is None:
        if not reference_ipa:
            raise ValueError(
                "reference_phones or reference_ipa is required (V2 references "
                "carry precomputed phones — see E4)"
            )
        reference_phones = parse_ipa_phonemes(reference_ipa)
    target_ipa = reference_ipa or _ipa_str(reference_phones)

    sq = check_signal_quality(audio, sr)
    duration = len(audio) / sr if sr else 0.0
    log.info(
        "assess ref=%s duration=%.2fs snr=%.1fdB",
        reference_id, duration, sq["snr_estimate_db"],
    )

    # --- Abstention cascade ---------------------------------------------------
    # 1. No speech at all (VAD) — runs before the GPU pass.
    speech_present, _regions = has_speech(audio, sr)
    if not speech_present:
        return _abstain("no_speech", {}, sq)

    # 2. Audio too noisy to trust.
    if sq["snr_estimate_db"] < SNR_MIN_DB:
        return _abstain("low_audio_quality", {"snr_db": sq["snr_estimate_db"]}, sq)

    # 3. Recording too short / too long.
    if not (MIN_DURATION_S <= duration <= MAX_DURATION_S):
        return _abstain(
            "duration_out_of_range", {"duration_seconds": round(duration, 2)}, sq
        )

    # --- Recognition + alignment (single CTC encoder pass reused below) -------
    aligner = alignment.get_aligner(device=device)
    aligner_out = aligner.encode(audio)
    user_segs = aligner.free_alignment(audio)
    user_phones = [s.token for s in user_segs]

    diff = phone_diff(reference_phones, user_phones)  # (ref, user)

    # 4. Wrong sentence / gibberish: clean speech + acceptable audio but the
    #    phones don't match the reference at all (#54). Audio/speech gates above
    #    already passed, so a catastrophic PER means wrong *content*, not bad mic.
    if diff["per"] > WRONG_SENTENCE_PER:
        return _abstain("wrong_sentence", {"per": round(diff["per"], 3)}, sq)

    # 5. Model uncertainty: high mean entropy over the *recognized* phones.
    #    Free-alignment entropy answers "is the model sure what it heard?", which
    #    is the right signal for abstaining — independent of the target.
    free_gops = gop_scoring.compute_gop(
        aligner_out.logprobs,
        user_segs,
        aligner_out.vocab,
        aligner_out.blank_id,
        aligner_out.frame_stride_ms,
    )
    free_gop_by_user = {i: g for i, g in enumerate(free_gops)}
    m_entropy = gop_scoring.mean_entropy(free_gops)
    if m_entropy > UNCERTAIN_THRESHOLD:
        return _abstain("uncertain", {"entropy": round(m_entropy, 3)}, sq)

    # Forced alignment of the audio onto the *target* phones gives true
    # Goodness-of-Pronunciation: P(target) at each target phone's frames (low on
    # a mispronounced phone, unlike free-alignment recognition confidence), plus
    # a timestamp for EVERY target phone — including ones the user dropped
    # (deletions). POWSM's tokenizer strips the word-boundary "▁", so we map the
    # forced segments back onto reference positions by skipping "▁". If the
    # tokenization round-trip doesn't line up 1:1 we fall back to free GOP so the
    # assessment still succeeds.
    target_gop_by_ref: dict[int, object] = {}
    forced_seg_by_ref: dict[int, object] = {}
    forced_conf: Optional[float] = None
    forced_ok = False
    try:
        # POWSM's tokenizer can't wrap the "▁" word-boundary marker as "/▁/", so
        # forced-align only the real phones; map results back below by skipping ▁.
        non_blank_ref = [p for p in reference_phones if p != "▁"]
        forced_segs = aligner.forced_alignment(audio, non_blank_ref)
        if non_blank_ref and len(forced_segs) == len(non_blank_ref):
            forced_gops = gop_scoring.compute_gop(
                aligner_out.logprobs,
                forced_segs,
                aligner_out.vocab,
                aligner_out.blank_id,
                aligner_out.frame_stride_ms,
            )
            fi = 0
            for ri, ph in enumerate(reference_phones):
                if ph == "▁":
                    continue
                target_gop_by_ref[ri] = forced_gops[fi]
                forced_seg_by_ref[ri] = forced_segs[fi]
                fi += 1
            forced_conf = float(np.mean([s.confidence for s in forced_segs]))
            forced_ok = True
        else:
            log.warning(
                "forced alignment length mismatch (%d segs vs %d target phones); "
                "falling back to free-alignment GOP",
                len(forced_segs), len(non_blank_ref),
            )
    except Exception as exc:  # tokenization / forced_align failure — degrade, don't crash
        log.warning("forced alignment failed (%s); falling back to free GOP", exc)

    # --- Score ----------------------------------------------------------------
    subs = sum(1 for e in diff["errors"] if e["type"] == "sub")
    dels = sum(1 for e in diff["errors"] if e["type"] == "del")
    n_ref = len(reference_phones)
    if n_ref == 0:
        score = 1.0 if not user_phones else 0.0
    else:
        score = max(0.0, (n_ref - subs - dels) / n_ref)

    # Overall confidence: mean forced-alignment P(target) when available (how well
    # the audio matched the target), else mean recognition confidence.
    if forced_conf is not None:
        confidence = forced_conf
    else:
        confidence = (
            float(np.mean([s.confidence for s in user_segs])) if user_segs else 0.0
        )

    # Long op labels + per-phone GOP/timestamps for the webhook/DB contract.
    # Substitutions/deletions reference a TARGET phone -> use the forced (target)
    # GOP + timestamp. Insertions have no target phone -> use the user's recognized
    # span; GOP-vs-target is undefined, so leave it null.
    _LABEL = {"sub": "substitute", "ins": "insert", "del": "delete"}
    errors = []
    for e in diff["errors"]:
        rp = e["ref_position"]
        up = e["user_position"]
        tgop = target_gop_by_ref.get(rp) if rp is not None else None
        fseg = forced_seg_by_ref.get(rp) if rp is not None else None

        if e["type"] in ("sub", "del") and tgop is not None and fseg is not None:
            gop_score, entropy, uncertain = tgop.gop_score, tgop.entropy, tgop.uncertain
            ts_seg = fseg
        elif e["type"] == "ins":
            # User added a phone not in the target — no target GOP.
            ts_seg = user_segs[up] if up is not None and up < len(user_segs) else None
            gop_score = entropy = uncertain = None
        else:
            # Fallback (forced alignment unavailable): mirror the old free behavior.
            ts_seg = user_segs[up] if up is not None and up < len(user_segs) else None
            fg = free_gop_by_user.get(up) if up is not None else None
            gop_score = fg.gop_score if fg is not None else None
            entropy = fg.entropy if fg is not None else None
            uncertain = fg.uncertain if fg is not None else None

        errors.append({
            "type": _LABEL[e["type"]],
            "position": up if up is not None else rp,
            "expected": e["expected"],
            "actual": e["actual"],
            "timestamp": (
                {"start": ts_seg.start_ms / 1000.0, "end": ts_seg.end_ms / 1000.0}
                if ts_seg is not None else None
            ),
            "gop_score": gop_score,
            "entropy": entropy,
            "uncertain": uncertain,
        })

    # Recognized phones the user actually produced (for the user-recording
    # waveform / future GOP coloring — #37). Carries free recognition confidence.
    phones = [
        {
            "token": s.token,
            "start_ms": s.start_ms,
            "end_ms": s.end_ms,
            "confidence": s.confidence,
            "gop_score": g.gop_score,
            "entropy": g.entropy,
            "uncertain": g.uncertain,
        }
        for s, g in zip(user_segs, free_gops)
    ]

    return {
        "status": "scored",
        "score": score,
        "confidence": confidence,
        "actual_ipa": _ipa_str(user_phones),
        "target_ipa": target_ipa,
        "per": diff["per"],
        "errors": errors,
        "phones": phones,
        "signal_quality": sq,
        "alignment_method": "powsm_ctc_forced" if forced_ok else "powsm_ctc_free",
    }
