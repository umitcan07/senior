"""Shared helpers for L2-ARCTIC POWSM LoRA data prep and eval (see notebooks/).

Mirrors ``turkish_lora_util`` but for the L2-ARCTIC corpus. Key differences:

* We only use the manually annotated ``annotation/`` TextGrids (~150 utterances per
  speaker), never the canonical ``textgrid/`` forced alignment — those carry dictionary
  pronunciations, which is exactly the mistake that sank the Turkish fine-tune.
* The annotated ``phones`` tier encodes L2 errors with the templates
  ``CPL,PPL,s`` (substitution), ``sil,PPL,a`` (addition) and ``CPL,sil,d`` (deletion),
  where **PPL = perceived label = the L2 surface we want to train on**. We resolve those
  to the sequence a listener actually heard.
* Labels are ARPABET, so we map them to POWSM IPA via ``arpabet_to_ipa.json``.

Low-level TextGrid parsing and the PEFT patch are reused from ``turkish_lora_util`` so
there is a single source of truth. Upload BOTH util files when running on Colab.
"""

from __future__ import annotations

import csv
import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

from turkish_lora_util import (  # reuse stable, shared helpers
    _Iv,
    _load_interval_tier_lenient,
    patch_speech2text_lora,  # re-exported for the eval notebook
)

__all__ = [
    "L2ARCTIC_SPEAKER_L1",
    "DEFAULT_VAL_SPEAKERS",
    "DEFAULT_TEST_SPEAKERS",
    "DEFAULT_CHUNKS_DIR",
    "DEFAULT_ARPABET_MAP",
    "PHONE_TIER",
    "load_arpabet_map",
    "arpabet_token_to_ipa",
    "resolve_perceived_phones",
    "map_arpabet_seq",
    "build_l2arctic_manifest",
    "split_by_l1",
    "write_splits",
    "write_oov_report",
    "new_audit",
    "finalize_audit",
    "patch_speech2text_lora",
]

FINETUNE_ROOT = Path(__file__).resolve().parent
DEFAULT_CHUNKS_DIR = FINETUNE_ROOT / "data" / "l2arctic_chunks"
DEFAULT_ARPABET_MAP = FINETUNE_ROOT / "arpabet_to_ipa.json"

# L2-ARCTIC annotation TextGrids name the phone tier "phones" (same tier carries the
# CPL,PPL,tag error templates on annotated intervals).
PHONE_TIER = "phones"

# Speaker -> L1 (L2-ARCTIC v5: 6 L1s x 4 speakers). Used for L1-balanced, speaker-disjoint
# splits and per-L1 reporting. Trim this dict if you only downloaded a subset.
L2ARCTIC_SPEAKER_L1: dict[str, str] = {
    # Arabic
    "ABA": "arabic", "SKA": "arabic", "YBAA": "arabic", "ZHAA": "arabic",
    # Mandarin
    "BWC": "mandarin", "LXC": "mandarin", "NCC": "mandarin", "TXHC": "mandarin",
    # Hindi
    "ASI": "hindi", "RRBI": "hindi", "SVBI": "hindi", "TNI": "hindi",
    # Korean
    "HJK": "korean", "HKK": "korean", "YDCK": "korean", "YKWK": "korean",
    # Spanish
    "EBVS": "spanish", "ERMS": "spanish", "MBMPS": "spanish", "NJS": "spanish",
    # Vietnamese
    "HQTV": "vietnamese", "PNV": "vietnamese", "THV": "vietnamese", "TLV": "vietnamese",
}

# Default speaker-disjoint split: one held-out speaker per L1 for val and one for test
# (12 train / 6 val / 6 test). Keeps every L1 represented in train and in eval. Override
# in the prep notebook if you downloaded a different subset.
DEFAULT_VAL_SPEAKERS: frozenset[str] = frozenset(
    {"YBAA", "NCC", "SVBI", "YDCK", "MBMPS", "THV"}
)
DEFAULT_TEST_SPEAKERS: frozenset[str] = frozenset(
    {"ZHAA", "TXHC", "TNI", "YKWK", "NJS", "TLV"}
)


# --------------------------------------------------------------------------------------
# ARPABET -> IPA
# --------------------------------------------------------------------------------------
def load_arpabet_map(path: Path | None = None) -> tuple[dict[str, str], frozenset[str]]:
    """Load ``arpabet_to_ipa.json``. Returns (mapping, silence_marks)."""
    path = path or DEFAULT_ARPABET_MAP
    data = json.loads(path.read_text(encoding="utf-8"))
    mapping = {str(k): str(v) for k, v in data["map"].items()}
    silence = frozenset(str(s) for s in data.get("silence", []))
    return mapping, silence


_STRESS_RE = re.compile(r"\d+$")


def arpabet_token_to_ipa(tok: str, mapping: dict[str, str]) -> list[str] | None:
    """Map one ARPABET token to a list of POWSM IPA tokens, or ``None`` if out-of-vocab.

    Tries the full token first (so ``AH0`` -> schwa), then strips a trailing stress digit.
    """
    t = tok.strip()
    if not t:
        return []
    up = t.upper()
    val = mapping.get(up)
    if val is None:
        base = _STRESS_RE.sub("", up)
        val = mapping.get(base)
    if val is None:
        return None
    return val.split() if " " in val else [val]


# --------------------------------------------------------------------------------------
# Perceived-surface resolution
# --------------------------------------------------------------------------------------
def _parse_error_template(mark: str) -> tuple[str, str, str] | None:
    """Parse a ``CPL,PPL,tag`` interval label. Returns (cpl, ppl, tag) or None."""
    parts = [p.strip() for p in mark.split(",")]
    if len(parts) >= 3:
        return parts[0], parts[1], parts[2].lower()
    if len(parts) == 2:
        # Defensive: a 2-field label — assume substitution (CPL,PPL).
        return parts[0], parts[1], "s"
    return None


def resolve_perceived_phones(
    intervals: list[_Iv],
    silence: frozenset[str],
    *,
    audit: dict[str, Any] | None = None,
) -> list[str]:
    """Resolve an annotated ``phones`` tier into the perceived ARPABET sequence.

    * plain phone           -> kept (correctly pronounced; perceived == canonical)
    * ``CPL,PPL,s`` (sub)   -> PPL (what the listener heard instead)
    * ``sil,PPL,a`` (add)   -> PPL (an inserted sound)
    * ``CPL,sil,d`` (del)   -> dropped (nothing was heard)
    """
    out: list[str] = []
    for iv in intervals:
        mark = iv.mark.strip()
        if mark in silence:
            continue
        if "," in mark:
            parsed = _parse_error_template(mark)
            if parsed is None:
                if audit is not None:
                    audit["malformed"][mark] += 1
                continue
            _cpl, ppl, tag = parsed
            if tag.startswith("d"):
                if audit is not None:
                    audit["err_counts"]["deletion"] += 1
                continue
            kind = "addition" if tag.startswith("a") else "substitution"
            if audit is not None:
                audit["err_counts"][kind] += 1
            if ppl and ppl not in silence:
                out.append(ppl)
        else:
            if audit is not None:
                audit["err_counts"]["plain"] += 1
            out.append(mark)
    return out


def map_arpabet_seq(
    arpa: list[str],
    mapping: dict[str, str],
    *,
    audit: dict[str, Any] | None = None,
) -> list[str]:
    """Map a perceived ARPABET sequence to flat POWSM IPA tokens; record OOV in audit."""
    out: list[str] = []
    for tok in arpa:
        if audit is not None:
            audit["raw_arpabet"][tok.upper()] += 1
        ipa = arpabet_token_to_ipa(tok, mapping)
        if ipa is None:
            if audit is not None:
                audit["oov"][tok.upper()] += 1
            continue
        out.extend(ipa)
        if audit is not None:
            for p in ipa:
                audit["final_ipa"][p] += 1
    return out


# --------------------------------------------------------------------------------------
# Audit
# --------------------------------------------------------------------------------------
def new_audit() -> dict[str, Any]:
    return {
        "raw_arpabet": Counter(),
        "final_ipa": Counter(),
        "oov": Counter(),
        "malformed": Counter(),
        "err_counts": Counter(),  # plain / substitution / addition / deletion
        "chunks_written": 0,
        "chunks_dropped_empty": 0,
        "utts_truncated": 0,
    }


def finalize_audit(audit: dict[str, Any]) -> dict[str, Any]:
    raw_total = sum(audit["raw_arpabet"].values())
    oov_total = sum(audit["oov"].values())
    return {
        "chunks_written": int(audit["chunks_written"]),
        "chunks_dropped_empty": int(audit["chunks_dropped_empty"]),
        "utts_truncated": int(audit["utts_truncated"]),
        "error_type_counts": dict(audit["err_counts"].most_common()),
        "oov_rate": (oov_total / raw_total) if raw_total else 0.0,
        "oov_token_counts": dict(audit["oov"].most_common()),
        "malformed_label_counts": dict(audit["malformed"].most_common()),
        "raw_arpabet_counts": dict(audit["raw_arpabet"].most_common()),
        "final_ipa_counts": dict(audit["final_ipa"].most_common()),
    }


def write_oov_report(path: Path, audit: dict[str, Any]) -> None:
    """Write a CSV of out-of-vocab ARPABET tokens (Gate-4 style discipline)."""
    rows = sorted(audit["oov"].items(), key=lambda kv: (-kv[1], kv[0]))
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["arpabet_token", "count"])
        w.writerows(rows)


# --------------------------------------------------------------------------------------
# Corpus -> chunks + manifest
# --------------------------------------------------------------------------------------
def _speaker_dirs(raw_dir: Path) -> list[Path]:
    return [
        d
        for d in sorted(raw_dir.iterdir())
        if d.is_dir() and d.name.upper() in L2ARCTIC_SPEAKER_L1
    ]


def _find_annotation_dir(spk_dir: Path) -> Path | None:
    for name in ("annotation", "Annotation", "annotations"):
        d = spk_dir / name
        if d.is_dir():
            return d
    return None


def _find_wav(spk_dir: Path, stem: str) -> Path | None:
    for name in ("wav", "WAV", "audio"):
        cand = spk_dir / name / f"{stem}.wav"
        if cand.is_file():
            return cand
    return None


def build_l2arctic_manifest(
    raw_dir: Path,
    out_dir: Path,
    mapping: dict[str, str],
    silence: frozenset[str],
    *,
    chunk_dur: float = 20.0,
    sr: int = 16000,
    audit: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Write one fixed-length 16 kHz WAV per annotated utterance + return manifest rows.

    Each manifest row: ``{"id", "speaker", "l1", "utt", "phones"}`` where ``phones`` is the
    perceived IPA sequence. Mirrors the Turkish manifest schema so the training dataset and
    eval code work unchanged.
    """
    import librosa
    import numpy as np
    import soundfile as sf

    out_dir.mkdir(parents=True, exist_ok=True)
    target_samples = int(chunk_dur * sr)
    manifest: list[dict[str, Any]] = []

    for spk_dir in _speaker_dirs(raw_dir):
        speaker = spk_dir.name.upper()
        l1 = L2ARCTIC_SPEAKER_L1[speaker]
        ann_dir = _find_annotation_dir(spk_dir)
        if ann_dir is None:
            continue
        for tg_path in sorted(ann_dir.glob("*.TextGrid")):
            wav = _find_wav(spk_dir, tg_path.stem)
            if wav is None:
                continue
            intervals = _load_interval_tier_lenient(tg_path, PHONE_TIER)
            if not intervals:
                continue
            arpa = resolve_perceived_phones(intervals, silence, audit=audit)
            phones = map_arpabet_seq(arpa, mapping, audit=audit)
            if not phones:
                if audit is not None:
                    audit["chunks_dropped_empty"] += 1
                continue

            audio, _ = librosa.load(str(wav), sr=sr, mono=True)
            if len(audio) > target_samples:
                audio = audio[:target_samples]
                if audit is not None:
                    audit["utts_truncated"] += 1
            seg = np.pad(audio, (0, max(0, target_samples - len(audio))))
            chunk_id = f"{speaker}_{tg_path.stem}"
            sf.write(out_dir / f"{chunk_id}.wav", seg, sr, subtype="PCM_16")
            manifest.append(
                {
                    "id": chunk_id,
                    "speaker": speaker,
                    "l1": l1,
                    "utt": tg_path.stem,
                    "phones": phones,
                }
            )
            if audit is not None:
                audit["chunks_written"] += 1

    return manifest


# --------------------------------------------------------------------------------------
# Splits
# --------------------------------------------------------------------------------------
def split_by_l1(
    manifest: list[dict[str, Any]],
    val_speakers: frozenset[str] = DEFAULT_VAL_SPEAKERS,
    test_speakers: frozenset[str] = DEFAULT_TEST_SPEAKERS,
) -> tuple[list, list, list]:
    """Speaker-disjoint split. Everything not in val/test goes to train."""
    train, val, test = [], [], []
    for c in manifest:
        spk = c["speaker"].upper()
        if spk in test_speakers:
            test.append(c)
        elif spk in val_speakers:
            val.append(c)
        else:
            train.append(c)
    return train, val, test


def write_splits(
    out_dir: Path,
    manifest: list[dict[str, Any]],
    val_speakers: frozenset[str] = DEFAULT_VAL_SPEAKERS,
    test_speakers: frozenset[str] = DEFAULT_TEST_SPEAKERS,
) -> tuple[int, int, int]:
    train, val, test = split_by_l1(manifest, val_speakers, test_speakers)
    for name, data in ("train", train), ("val", val), ("test", test):
        (out_dir / f"{name}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
    return len(train), len(val), len(test)
