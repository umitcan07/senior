"""Shared helpers for Turkish POWSM LoRA data prep and eval (see notebooks/)."""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Tier audit (task-1 vs task-2 TextGrids differ)
PHONE_TIER_BY_TASK: dict[str, str] = {
    "task1": "phones",
    "task2": "REF-phones",
}

SILENCE_MARKS: frozenset[str] = frozenset(
    {"", "sp", "sil", "SIL", "<p:>", "SP", "SILENCE", "silence"}
)

FINETUNE_ROOT = Path(__file__).resolve().parent
DEFAULT_RAW_DATA = FINETUNE_ROOT / "data"
DEFAULT_CHUNKS_DIR = FINETUNE_ROOT / "data" / "turkish_chunks"
DEFAULT_PHONE_MAP = DEFAULT_CHUNKS_DIR / "phone_map.json"
DEFAULT_PHONE_AUDIT = DEFAULT_CHUNKS_DIR / "phone_audit.json"

DEFAULT_PHONE_ALIASES: dict[str, str] = {
    "spn": "",
    "ai": "a j",
    "g": "ɡ",
    "ı": "ɯ",
    "ö": "ø",
    "i:": "iː",
    "u:": "u",
    "ʉ:": "y",
    "ej": "e j",
    "aj": "a j",
    "aw": "a w",
    "ow": "o w",
    "ɔj": "ɔ j",
    "ɑj": "ɑ j",
    "ɑw": "ɑ w",
    "ɛj": "ɛ j",
    "aʊ": "a w",
    "eı": "e ɯ",
    "lɪ": "l ɪ",
    "əɾ": "ə ɾ",
    "ɚ": "ə ɹ",
    "ɝ": "ə ɹ",
    "ç": "t ʃ",
    "tʃ": "t ʃ",
    "ʧ": "t ʃ",
    "dʒ": "d ʒ",
    "ʤ": "d ʒ",
    "ʤə": "d ʒ ə",
}

DEFAULT_DROP_PHONES: frozenset[str] = frozenset(
    {
        "nsıd",
        "retn",
        "zing",
        "his",
        "nt",
        "pt",
        "rd",
        "rk",
        "rt",
        "st",
        "dv",
        "nə",
        "ə-",
        "t ö d",
        "ɜː d",
        "ɜːd",
        "ᴊ",
    }
)


def speaker_num(chunk_or_speaker: dict[str, Any] | str) -> int:
    s = chunk_or_speaker["speaker"] if isinstance(chunk_or_speaker, dict) else chunk_or_speaker
    m = re.search(r"S(\d+)", s, re.I)
    if not m:
        raise ValueError(f"Cannot parse speaker id from {s!r}")
    return int(m.group(1))


def load_phone_map(path: Path | None = None) -> dict[str, str]:
    path = path or DEFAULT_PHONE_MAP
    aliases = dict(DEFAULT_PHONE_ALIASES)
    if not path.is_file():
        return aliases
    data = json.loads(path.read_text(encoding="utf-8"))
    aliases.update({str(k): str(v) for k, v in (data.get("aliases") or {}).items()})
    return aliases


def apply_phone_map(phones: list[str], phone_map: dict[str, str]) -> list[str]:
    """Apply alias map. Mapping value semantics:
      - missing key → identity (keep phone as-is)
      - "" (empty)  → drop the phone
      - "a b c"     → split into multiple phones (1-to-many)
      - "x"         → single replacement
    """
    if not phone_map:
        return phones
    out: list[str] = []
    for p in phones:
        mapped = phone_map.get(p, p)
        if not mapped:
            continue                       # drop
        if " " in mapped:
            out.extend(mapped.split())     # 1-to-many
        else:
            out.append(mapped)
    return out


def normalize_phones(
    phones: list[str],
    phone_map: dict[str, str] | None = None,
    *,
    audit: dict[str, Any] | None = None,
    chunk_id: str | None = None,
) -> list[str]:
    """Normalize a phone sequence and optionally accumulate audit statistics."""
    pmap = phone_map or {}
    out: list[str] = []
    for raw in phones:
        raw = raw.strip()
        if audit is not None:
            audit["raw_counts"][raw] += 1
        if not raw or raw in DEFAULT_DROP_PHONES:
            if audit is not None:
                audit["dropped_counts"][raw] += 1
                _remember_example(audit["dropped_examples"], raw, chunk_id)
            continue
        mapped = pmap.get(raw, raw)
        if not mapped:
            if audit is not None:
                audit["dropped_counts"][raw] += 1
                _remember_example(audit["dropped_examples"], raw, chunk_id)
            continue
        toks = mapped.split() if " " in mapped else [mapped]
        if audit is not None:
            if raw != mapped:
                audit["mapped_counts"][raw] += 1
                dests = audit["mapped_to"].setdefault(raw, Counter())
                dests[mapped] += 1
                _remember_example(audit["mapped_examples"], raw, chunk_id)
        out.extend(toks)
        if audit is not None:
            for tok in toks:
                audit["final_counts"][tok] += 1
    return out


def _remember_example(examples: dict[str, list[str]], phone: str, chunk_id: str | None) -> None:
    if not chunk_id:
        return
    bucket = examples.setdefault(phone, [])
    if chunk_id not in bucket and len(bucket) < 5:
        bucket.append(chunk_id)


def _new_phone_audit() -> dict[str, Any]:
    return {
        "raw_counts": Counter(),
        "final_counts": Counter(),
        "mapped_counts": Counter(),
        "mapped_to": {},
        "dropped_counts": Counter(),
        "mapped_examples": {},
        "dropped_examples": {},
        "chunks_written": 0,
        "chunks_dropped_empty": 0,
    }


def finalize_phone_audit(audit: dict[str, Any]) -> dict[str, Any]:
    mapped_to = {
        raw: dict(sorted(dest.items(), key=lambda kv: (-kv[1], kv[0])))
        for raw, dest in sorted(audit["mapped_to"].items())
    }
    return {
        "chunks_written": int(audit["chunks_written"]),
        "chunks_dropped_empty": int(audit["chunks_dropped_empty"]),
        "raw_phone_counts": dict(audit["raw_counts"].most_common()),
        "final_phone_counts": dict(audit["final_counts"].most_common()),
        "mapped_phone_counts": dict(audit["mapped_counts"].most_common()),
        "mapped_targets": mapped_to,
        "dropped_phone_counts": dict(audit["dropped_counts"].most_common()),
        "mapped_examples": audit["mapped_examples"],
        "dropped_examples": audit["dropped_examples"],
    }


def write_phone_audit(path: Path, audit: dict[str, Any]) -> dict[str, Any]:
    payload = finalize_phone_audit(audit)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return payload


@dataclass(frozen=True)
class _Iv:
    min_time: float
    max_time: float
    mark: str


def _read_textgrid_raw(tg_path: Path) -> str:
    data = tg_path.read_bytes()
    if data.startswith(b"\xff\xfe") or data.startswith(b"\xfe\xff"):
        return data.decode("utf-16", errors="replace")
    return data.decode("utf-8", errors="replace")


def _load_interval_tier_lenient(tg_path: Path, tier_name: str) -> list[_Iv]:
    """Parse Praat long TextGrid; dedupe identical intervals (bad exports break `textgrid`)."""
    raw = _read_textgrid_raw(tg_path)
    chunks = raw.split("item [")
    intervals: list[tuple[float, float, str]] = []
    for ch in chunks:
        if f'name = "{tier_name}"' not in ch:
            continue
        for m in re.finditer(
            r"xmin\s*=\s*([\d.]+)\s*\n\s*xmax\s*=\s*([\d.]+)\s*\n\s*text\s*=\s*\"([^\"]*)\"",
            ch,
        ):
            intervals.append((float(m.group(1)), float(m.group(2)), m.group(3)))
    seen: set[tuple[float, float, str]] = set()
    out: list[_Iv] = []
    for xmin, xmax, text in sorted(intervals, key=lambda t: (t[0], t[1])):
        key = (round(xmin, 5), round(xmax, 5), text)
        if key in seen:
            continue
        seen.add(key)
        out.append(_Iv(xmin, xmax, text))
    return out


def phones_for_chunk_intervals(
    intervals: list[_Iv],
    start: float,
    end: float,
) -> list[str]:
    """Assign phones whose interval midpoint lies in [start, end)."""
    phones: list[str] = []
    for iv in intervals:
        mark = iv.mark.strip()
        if mark in SILENCE_MARKS:
            continue
        mid = 0.5 * (iv.min_time + iv.max_time)
        if start <= mid < end:
            phones.append(mark)
    return phones


def split_by_speaker(manifest: list[dict[str, Any]]) -> tuple[list, list, list]:
    train, val, test = [], [], []
    for c in manifest:
        n = speaker_num(c)
        if n <= 16:
            train.append(c)
        elif n in (17, 18):
            val.append(c)
        elif n in (19, 20):
            test.append(c)
        else:
            train.append(c)
    return train, val, test


def write_splits(out_dir: Path, manifest: list[dict[str, Any]]) -> None:
    train, val, test = split_by_speaker(manifest)
    for name, data in ("train", train), ("val", val), ("test", test):
        (out_dir / f"{name}.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )


def chunk_corpus(
    data_dirs: dict[str, Path],
    out_dir: Path,
    *,
    chunk_dur: float = 20.0,
    sr: int = 16000,
    phone_map: dict[str, str] | None = None,
    return_audit: bool = False,
) -> list[dict[str, Any]] | tuple[list[dict[str, Any]], dict[str, Any]]:
    """Chunk WAVs into fixed-duration files; write manifest entries with phone lists."""
    import librosa
    import numpy as np
    import soundfile as sf

    out_dir.mkdir(parents=True, exist_ok=True)
    pmap = phone_map or {}
    manifest: list[dict[str, Any]] = []
    target_samples = int(chunk_dur * sr)
    audit = _new_phone_audit()

    for task_key, d in data_dirs.items():
        tier_name = PHONE_TIER_BY_TASK[task_key]
        for wav in sorted(d.glob("*.wav")):
            tg_path = wav.with_suffix(".TextGrid")
            if not tg_path.is_file():
                continue
            audio, _ = librosa.load(str(wav), sr=sr, mono=True)
            tier_ivs = _load_interval_tier_lenient(tg_path, tier_name)
            if not tier_ivs:
                raise ValueError(
                    f"No intervals for tier {tier_name!r} in {tg_path} (task {task_key})"
                )

            dur_s = len(audio) / sr
            start = 0.0
            while start < dur_s:
                end = min(start + chunk_dur, dur_s)
                phones = phones_for_chunk_intervals(tier_ivs, start, end)
                chunk_id = f"{wav.stem}_{int(start):04d}"
                phones = normalize_phones(phones, pmap, audit=audit, chunk_id=chunk_id)
                if phones:
                    seg = audio[int(start * sr) : int(end * sr)]
                    seg = np.pad(seg, (0, max(0, target_samples - len(seg))))
                    sf.write(out_dir / f"{chunk_id}.wav", seg, sr, subtype="PCM_16")
                    manifest.append(
                        {
                            "id": chunk_id,
                            "speaker": wav.stem,
                            "task": task_key,
                            "phones": phones,
                        }
                    )
                    audit["chunks_written"] += 1
                else:
                    audit["chunks_dropped_empty"] += 1
                start += chunk_dur

    if return_audit:
        return manifest, audit
    return manifest


def patch_speech2text_lora(s2t: Any, adapter_dir: str | Path) -> Any:
    """Attach a PEFT adapter to `Speech2Text.s2t_model` and refresh beam-search scorers.

    ESPnet's `BeamSearch` holds `nn.Module` references from the initial model; after
    wrapping with `PeftModel`, decoder/CTC scorers must point at the new modules.
    """
    from peft import PeftModel

    adapter_dir = Path(adapter_dir)
    base = s2t.s2t_model
    s2t.s2t_model = PeftModel.from_pretrained(base, str(adapter_dir))
    m = s2t.s2t_model
    bs = s2t.beam_search

    # Update scorer references in-place — avoids importing CTCPrefixScorer
    # (module path changed across ESPnet versions; in-place update is version-agnostic)
    for d in (bs.nn_dict, bs.scorers, bs.full_scorers):
        if "decoder" in d:
            d["decoder"] = m.decoder
        if "ctc" in d:
            d["ctc"].ctc = m.ctc   # update internal CTC reference without recreating scorer

    return s2t
