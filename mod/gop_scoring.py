"""Goodness-of-Pronunciation scoring from CTC logprobs (E2.3 / issue #16).

Pure numpy. Consumes the POWSM CTC encoder output already produced by
``mod/alignment.py`` (``AlignerOutput.logprobs`` [T, V] and the per-phone frame
spans from ``free_alignment``/``forced_alignment``) — no extra model pass.

For each aligned phone segment we report:

- ``gop_score`` — mean log P(target) over the segment frames minus the mean of
  the best *competing* (non-target, non-blank) log-prob per frame. High when the
  model is both confident in and unambiguous about the realized phone; drops on
  confident-wrong and ambiguous realizations.
- ``entropy``   — mean per-frame entropy of the posterior (nats). High = the
  model is spreading probability mass = uncertain recognition.
- ``margin``    — mean per-frame (top-1 prob − top-2 prob). Low = ambiguous.
- ``uncertain`` — ``entropy > entropy_threshold`` (default 2.0 nats, tunable in E6).

Tokens in ``vocab`` carry POWSM's ``/.../`` slashes; ``PhoneSegment.token`` is
the bare phone — we match on the stripped form.
"""

import dataclasses
import logging
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)

DEFAULT_ENTROPY_THRESHOLD = 2.0  # nats


@dataclasses.dataclass
class PhoneGOP:
    token: str
    gop_score: Optional[float]  # None when the phone isn't in the CTC vocab
    entropy: float
    margin: float
    uncertain: bool

    def to_dict(self) -> dict:
        return {
            "token": self.token,
            "gop_score": self.gop_score,
            "entropy": self.entropy,
            "margin": self.margin,
            "uncertain": self.uncertain,
        }


def _stripped_vocab_index(vocab: list[str]) -> dict[str, int]:
    """Map bare phone token -> column index in the CTC vocab.

    POWSM vocab entries look like ``/h/``; first occurrence wins on the rare
    chance two entries strip to the same bare token.
    """
    index: dict[str, int] = {}
    for i, tok in enumerate(vocab):
        bare = tok.strip("/")
        if bare and bare not in index:
            index[bare] = i
    return index


def compute_gop(
    logprobs: np.ndarray,
    alignment: list,
    vocab: list[str],
    blank_id: int,
    frame_stride_ms: float,
    entropy_threshold: float = DEFAULT_ENTROPY_THRESHOLD,
) -> list[PhoneGOP]:
    """Per-phone GOP / entropy / margin from CTC logprobs.

    Args:
        logprobs: [T, V] CTC log-softmax (natural log), one row per frame.
        alignment: list of ``PhoneSegment`` (``.token``, ``.start_ms``, ``.end_ms``)
            giving the frame span of each recognized phone.
        vocab: CTC token list (with ``/.../`` slashes), len == V.
        blank_id: CTC blank column, excluded from the competing-phone term.
        frame_stride_ms: ms per frame (POWSM = 40 ms; read from the aligner, never
            hardcode — see doc/V2_CONTEXT.md §3).
        entropy_threshold: per-phone ``uncertain`` cutoff in nats.

    Returns:
        One ``PhoneGOP`` per input segment, in order.
    """
    if logprobs.ndim != 2:
        raise ValueError(f"logprobs must be [T, V], got shape {logprobs.shape}")
    n_frames, vocab_size = logprobs.shape
    vocab_idx = _stripped_vocab_index(vocab)

    results: list[PhoneGOP] = []
    for seg in alignment:
        start_f = int(round(seg.start_ms / frame_stride_ms))
        end_f = int(round(seg.end_ms / frame_stride_ms))
        # Clamp and guarantee at least one frame.
        start_f = max(0, min(start_f, n_frames - 1))
        end_f = max(start_f + 1, min(end_f, n_frames))
        span = logprobs[start_f:end_f]  # [F, V] natural-log probs

        probs = np.exp(span)
        # Per-frame entropy (nats): -sum p * log p. Use logprobs directly to avoid
        # recomputing log; clamp tiny probs out via the p*logp == 0 limit.
        frame_entropy = -np.sum(probs * span, axis=1)
        entropy = float(np.mean(frame_entropy))

        # Per-frame top1 - top2 probability margin.
        part = np.partition(probs, -2, axis=1)
        margin = float(np.mean(part[:, -1] - part[:, -2]))

        target_idx = vocab_idx.get(seg.token)
        if target_idx is None:
            gop = None
        else:
            target_lp = span[:, target_idx]  # [F]
            # Best competing log-prob per frame (mask out target + blank).
            competitor = span.copy()
            competitor[:, target_idx] = -np.inf
            if 0 <= blank_id < vocab_size:
                competitor[:, blank_id] = -np.inf
            best_other = np.max(competitor, axis=1)  # [F]
            gop = float(np.mean(target_lp) - np.mean(best_other))

        results.append(
            PhoneGOP(
                token=seg.token,
                gop_score=round(gop, 4) if gop is not None else None,
                entropy=round(entropy, 4),
                margin=round(margin, 4),
                uncertain=entropy > entropy_threshold,
            )
        )

    return results


def mean_entropy(gops: list[PhoneGOP]) -> float:
    """Mean per-phone entropy across a recording (0.0 when empty)."""
    if not gops:
        return 0.0
    return float(np.mean([g.entropy for g in gops]))


def mean_gop(gops: list[PhoneGOP]) -> Optional[float]:
    """Mean GOP over phones that have one (None when none are scorable)."""
    scored = [g.gop_score for g in gops if g.gop_score is not None]
    if not scored:
        return None
    return float(np.mean(scored))
