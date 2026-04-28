"""Shared helpers for Turkish POWSM LoRA data prep and eval (see notebooks/)."""

from __future__ import annotations

import json
import re
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


def speaker_num(chunk_or_speaker: dict[str, Any] | str) -> int:
    s = chunk_or_speaker["speaker"] if isinstance(chunk_or_speaker, dict) else chunk_or_speaker
    m = re.search(r"S(\d+)", s, re.I)
    if not m:
        raise ValueError(f"Cannot parse speaker id from {s!r}")
    return int(m.group(1))


def load_phone_map(path: Path | None = None) -> dict[str, str]:
    path = path or DEFAULT_PHONE_MAP
    if not path.is_file():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    aliases = data.get("aliases") or {}
    return {str(k): str(v) for k, v in aliases.items()}


def apply_phone_map(phones: list[str], phone_map: dict[str, str]) -> list[str]:
    if not phone_map:
        return phones
    return [phone_map.get(p, p) for p in phones]


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
) -> list[dict[str, Any]]:
    """Chunk WAVs into fixed-duration files; write manifest entries with phone lists."""
    import librosa
    import numpy as np
    import soundfile as sf

    out_dir.mkdir(parents=True, exist_ok=True)
    pmap = phone_map or {}
    manifest: list[dict[str, Any]] = []
    target_samples = int(chunk_dur * sr)

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
                phones = apply_phone_map(phones, pmap)
                if phones:
                    seg = audio[int(start * sr) : int(end * sr)]
                    seg = np.pad(seg, (0, max(0, target_samples - len(seg))))
                    chunk_id = f"{wav.stem}_{int(start):04d}"
                    sf.write(out_dir / f"{chunk_id}.wav", seg, sr, subtype="PCM_16")
                    manifest.append(
                        {
                            "id": chunk_id,
                            "speaker": wav.stem,
                            "task": task_key,
                            "phones": phones,
                        }
                    )
                start += chunk_dur

    return manifest


def patch_speech2text_lora(s2t: Any, adapter_dir: str | Path) -> Any:
    """Attach a PEFT adapter to `Speech2Text.s2t_model` and refresh beam-search scorers.

    ESPnet's `BeamSearch` holds `nn.Module` references from the initial model; after
    wrapping with `PeftModel`, decoder/CTC scorers must point at the new modules.
    """
    from peft import PeftModel
    from espnet2.legacy.nets.scorers.ctc import CTCPrefixScorer

    adapter_dir = Path(adapter_dir)
    base = s2t.s2t_model
    s2t.s2t_model = PeftModel.from_pretrained(base, str(adapter_dir))
    m = s2t.s2t_model
    bs = s2t.beam_search
    new_ctc = CTCPrefixScorer(ctc=m.ctc, eos=m.eos)
    if "decoder" in bs.nn_dict:
        bs.nn_dict["decoder"] = m.decoder
    if "ctc" in bs.nn_dict:
        bs.nn_dict["ctc"] = new_ctc
    for d in (bs.scorers, bs.full_scorers):
        if "decoder" in d:
            d["decoder"] = m.decoder
        if "ctc" in d:
            d["ctc"] = new_ctc
    return s2t
