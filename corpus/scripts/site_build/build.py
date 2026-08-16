"""Build the static-site data tree from the EXMARaLDA corpus drop.

Pipeline:

    for each speaker/task file:
        read TextGrid (phones, REF-phones, words, REF-words-matched)
        read .exb    (speaker metadata, annotation tiers)
        chunk into utterances (<= max_s, on word boundaries)
        for each utterance:
            align phones vs REF-phones  -> per-token error records
            compute rhythm metrics
            extract F0 contour (if parselmouth available)
            cut a short clip per token (optional; needs ffmpeg)
            emit utterance JSON + accumulate token shards + phone stats
    write manifest + area stats + shards

Run:

    python -m corpus.scripts.site_build.build \
        --raw "$CORPUS_RAW_DIR" --out corpus/processed/site

Without `--raw` it uses the same resolution as the other corpus scripts
(`CORPUS_RAW_DIR` env / `corpus/raw` symlink / ~/Downloads/Corpus Files).

Design notes:

* Correct/incorrect comes from aligning the learner tier against the reference
  tier — i.e. it reflects the corpus annotation, not any model output.
* Which tier is which per task follows corpus/finetune_qc.md Gate 0:
  TASK1 -> phones/words, TASK2 -> REF-phones/REF-words-matched. Where only one
  phone tier exists, that file contributes inventory counts but no
  correct/incorrect (there is nothing to align against) and is reported.
* Clip cutting is opt-in (`--clips`) and needs ffmpeg. Without it, utterance
  JSON still points at a clip path the site can 404 gracefully on, so the data
  shape does not change whether or not audio was cut.
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

# Support both `python -m corpus.scripts.site_build.build` and a direct-path run.
if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from site_build import align, clips, emit, exb, intonation, inventory, rhythm, textgrid
    from site_build.textgrid import Interval, TextGrid
else:
    from . import align, clips, emit, exb, intonation, inventory, rhythm, textgrid
    from .textgrid import Interval, TextGrid


# KWIC context shown either side of the hit in the concordance: how many
# realised phones to display, and how far to scan for them (deletions are
# skipped, so the scan window has to be wider than the display window).
KWIC_WINDOW = 4
KWIC_LOOKBEHIND = 12

# Dropped in the raw dir by demo_corpus.py. Its presence means every number
# downstream is fabricated, so the site can say so instead of passing synthetic
# counts off as the corpus. Keep in sync with demo_corpus.SYNTHETIC_MARKER.
SYNTHETIC_MARKER = ".synthetic"

# Per-task tier wiring (corpus/finetune_qc.md Gate 0/3).
TASK_TIERS = {
    "T1": {"phones": ("phones",), "ref": ("REF-phones",), "words": ("words", "REF-words", "REF_words", "REF")},
    "T2": {
        "phones": ("phones",),
        "ref": ("REF-phones",),
        "words": ("REF-words-matched", "REF-words", "words", "REF"),
    },
}


@dataclass
class Utterance:
    id: str
    speaker: str
    task: str
    t0: float
    t1: float
    text: str
    ref_phones: list[Interval]
    act_phones: list[Interval]
    words: list[Interval]


def chunk_utterances(
    words: list[Interval], max_s: float = 18.0
) -> list[tuple[float, float, str]]:
    """Split the word tier into utterance windows (<= max_s, on sentence marks).

    Mirrors `analyze_corpus_chunks.py::sentence_chunks` so utterance counts line
    up with the QC gate estimates, but returns spans + text instead of lengths.
    """
    if not words:
        return []
    chunks: list[tuple[float, float, str]] = []
    start = words[0].t0
    end = words[0].t1
    buf = [words[0].text]
    for w in words[1:]:
        if w.t1 - start > max_s or buf[-1].rstrip().endswith((".", "?", "!")):
            chunks.append((start, end, " ".join(buf).strip()))
            start = w.t0
            buf = []
        end = w.t1
        buf.append(w.text)
    chunks.append((start, end, " ".join(buf).strip()))
    return chunks


def _slice(intervals: list[Interval], t0: float, t1: float) -> list[Interval]:
    """Intervals whose midpoint falls inside [t0, t1]."""
    out = []
    for iv in intervals:
        mid = (iv.t0 + iv.t1) / 2
        if t0 - 1e-6 <= mid < t1 + 1e-6 and iv.text.strip():
            out.append(iv)
    return out


def speaker_task(stem: str) -> tuple[str, str]:
    """`S12T1` -> ('S12', 'T1'). Falls back gracefully on odd names."""
    import re

    m = re.match(r"(S\d+)\s*[_-]?\s*(T[12])", stem, re.IGNORECASE)
    if m:
        return m.group(1).upper(), m.group(2).upper()
    return stem, "T1"


def load_utterances(tg: TextGrid, speaker: str, task: str) -> tuple[list[Utterance], list[str]]:
    """Build utterances for one file; return (utterances, warnings)."""
    wiring = TASK_TIERS.get(task, TASK_TIERS["T1"])
    warnings: list[str] = []

    ref_tier = tg.tier(*wiring["ref"])
    act_tier = tg.tier(*wiring["phones"])
    word_tier = tg.tier(*wiring["words"])

    if word_tier is None:
        warnings.append(f"{tg.path.name}: no word tier {wiring['words']} — skipped")
        return [], warnings
    if ref_tier is None and act_tier is None:
        warnings.append(f"{tg.path.name}: no phone tier — skipped")
        return [], warnings

    ref_iv = ref_tier.labelled() if ref_tier else []
    act_iv = act_tier.labelled() if act_tier else []
    if not ref_iv or not act_iv:
        warnings.append(
            f"{tg.path.name}: only one phone tier present "
            f"(ref={len(ref_iv)}, act={len(act_iv)}) — inventory only, no correct/incorrect"
        )

    utterances: list[Utterance] = []
    for i, (t0, t1, text) in enumerate(chunk_utterances(word_tier.labelled())):
        uid = f"{speaker}{task}_{i:03d}"
        utterances.append(
            Utterance(
                id=uid,
                speaker=speaker,
                task=task,
                t0=t0,
                t1=t1,
                text=text,
                ref_phones=_slice(ref_iv, t0, t1) if ref_iv else [],
                act_phones=_slice(act_iv, t0, t1) if act_iv else [],
                words=_slice(word_tier.labelled(), t0, t1),
            )
        )
    return utterances, warnings


def build(
    raw_dir: Path,
    out_dir: Path,
    *,
    cut_clips: bool = False,
    limit: int | None = None,
    clean: bool = True,
    skip_pitch: bool = False,
) -> int:
    if clean:
        for child in (out_dir / "data", out_dir / "clips"):
            shutil.rmtree(child, ignore_errors=True)
    writer = emit.SiteWriter(out_dir)
    all_warnings: list[str] = []
    speakers_meta: dict[str, dict] = {}
    n_files = 0
    n_utts = 0
    source_audio_files = 0
    missing_source_audio: list[str] = []

    task_folders = [
        ("T1", raw_dir / "TASK1 audio&textgrids"),
        ("T2", raw_dir / "TASK2 audio&textgrids"),
    ]

    for task, folder in task_folders:
        if not folder.is_dir():
            all_warnings.append(f"missing task folder: {folder}")
            continue

        for tg_path in sorted(folder.glob("*.TextGrid")):
            if limit and n_files >= limit:
                break
            n_files += 1
            speaker, tsk = speaker_task(tg_path.stem)
            tsk = task  # folder is authoritative over filename
            wav_path = tg_path.with_suffix(".wav")
            if wav_path.exists():
                source_audio_files += 1
            else:
                missing_source_audio.append(tg_path.stem)

            tg = textgrid.read_textgrid(tg_path)

            # Speaker metadata from the sibling .exb, if present.
            exb_path = _find_exb(tg_path, raw_dir)
            transcription = None
            if exb_path and speaker not in speakers_meta:
                meta = _speaker_meta(exb_path, speaker)
                if meta:
                    speakers_meta[speaker] = meta
            if exb_path:
                try:
                    transcription = exb.parse_exb(exb_path)
                except Exception as error:
                    all_warnings.append(f"{exb_path.name}: parse failed ({error})")

            utterances, warnings = load_utterances(tg, speaker, tsk)
            all_warnings.extend(warnings)

            published_clips: set[str] = set()
            if cut_clips and wav_path.is_file():
                published_clips = clips.cut_recording(
                    wav_path,
                    [clips.Clip(utt.id, utt.t0, utt.t1) for utt in utterances],
                    out_dir / "clips",
                )
            for utt in utterances:
                n_utts += 1
                _emit_utterance(
                    writer,
                    utt,
                    wav_path,
                    utt.id in published_clips,
                    transcription,
                    skip_pitch,
                )

    manifest = {
        "build": {
            "corpusId": "corptes-v1",
            "files": n_files,
            "utterances": n_utts,
            "pitchBackend": "none" if skip_pitch else intonation.backend(),
            "clips": cut_clips,
            "clipFormat": "mp3" if cut_clips else None,
            "sourceAudioFiles": source_audio_files,
            "clipsPublished": len(list((out_dir / "clips").glob("*.mp3"))),
            "missingSourceAudio": missing_source_audio,
            "synthetic": (raw_dir / SYNTHETIC_MARKER).exists(),
        },
        "areas": ["vowels", "consonants", "lexical-stress", "linking", "rhythm", "intonation"],
        "filterTree": inventory.filter_tree(),
        "speakers": speakers_meta,
        "warnings": all_warnings,
    }

    writer.flush_shards()
    for area in ("vowels", "consonants"):
        phones = [p.token for p in inventory.INVENTORY.values() if p.area == area]
        writer.write_area_stats(area, phones)
    writer.write_stress_stats()
    for area in ("linking", "intonation"):
        writer.write_annotation_stats(area)
    writer.write_manifest(manifest)

    print(f"Built {n_utts} utterances from {n_files} files -> {out_dir}")
    if all_warnings:
        print(f"\n{len(all_warnings)} warning(s):")
        for w in all_warnings[:40]:
            print(f"  - {w}")
    return 0


def _annotation_events(
    transcription: exb.Transcription | None, category: str, t0: float, t1: float
) -> list[tuple[float, float, str, str | None]]:
    """Resolve EXB annotation events that overlap an utterance."""
    if transcription is None:
        return []
    out: list[tuple[float, float, str, str | None]] = []
    # ``event_times`` recomputes interpolation each call. A real transcription
    # has thousands of timeline items, so resolve it once per utterance.
    timeline = transcription.anchored_timeline()
    for tier in transcription.tiers(category=category):
        for event in tier.events:
            start = timeline.get(event.start)
            end = timeline.get(event.end)
            if start is None or end is None:
                continue
            if min(t1, end) <= max(t0, start):
                continue
            outcome = event.text.strip().lower()
            if outcome not in ("correct", "incorrect"):
                continue
            out.append((start, end, outcome, tier.display_name))
    return out


def _matching_judgment(
    events: list[tuple[float, float, str, str | None]], t0: float, t1: float
) -> str | None:
    mid = (t0 + t1) / 2
    matches = [event for event in events if event[0] <= mid <= event[1]]
    if not matches:
        return None
    return matches[0][2]


def _emit_utterance(
    writer: emit.SiteWriter,
    utt: Utterance,
    wav_path: Path,
    clip_available: bool,
    transcription: exb.Transcription | None = None,
    skip_pitch: bool = False,
) -> None:
    native_phone_acc = _annotation_events(transcription, "phoneAcc", utt.t0, utt.t1)
    have_both = bool(utt.ref_phones and utt.act_phones)
    if native_phone_acc:
        # CORPTES records the production tier and an independent hand judgement;
        # do not fabricate a reference tier or infer substitutions.
        present = utt.act_phones or utt.ref_phones
        tokens = []
        for i, iv in enumerate(present):
            judgment = _matching_judgment(native_phone_acc, iv.t0, iv.t1)
            if judgment is None:
                continue
            tokens.append(
                align.Token(
                    index=i,
                    error="correct" if judgment == "correct" else "substitute",
                    target=inventory.parse_phone(iv.text).token,
                    actual=inventory.parse_phone(iv.text).token,
                    t0=iv.t0,
                    t1=iv.t1,
                )
            )
    elif have_both:
        tokens = align.align_intervals(utt.ref_phones, utt.act_phones, utt.words)
    else:
        # Inventory-only: emit the phones present (as "correct") so the token is
        # inspectable, but they don't feed accuracy — flagged via error="correct"
        # with target==actual from whichever tier exists.
        present = utt.act_phones or utt.ref_phones
        tokens = [
            align.Token(
                index=i,
                error="correct",
                target=inventory.parse_phone(iv.text).token,
                actual=inventory.parse_phone(iv.text).token,
                t0=iv.t0,
                t1=iv.t1,
            )
            for i, iv in enumerate(present)
        ]

    rhythm_metrics = rhythm.compute_rhythm(utt.act_phones or utt.ref_phones)

    contour = None
    if not skip_pitch and intonation.available() and wav_path.exists():
        contour = intonation.extract_contour(wav_path, utt.t0, utt.t1)

    clip_rel = f"clips/{utt.id}.mp3"

    # KWIC context: the phones the speaker actually produced either side of each
    # token. Deletions contribute nothing, since nothing was audible there.
    produced = [t.actual for t in tokens]

    def _context(i: int) -> tuple[str, str]:
        left = [p for p in produced[max(0, i - KWIC_LOOKBEHIND) : i] if p]
        right = [p for p in produced[i + 1 : i + 1 + KWIC_LOOKBEHIND] if p]
        return (
            " ".join(left[-KWIC_WINDOW:]),
            " ".join(right[:KWIC_WINDOW]),
        )

    token_payload = []
    for i, tok in enumerate(tokens):
        gid = f"{utt.id}_{tok.index:03d}"
        phone = tok.actual or tok.target
        area = inventory.parse_phone(phone or "").area
        # Resolve the containing word for the concordance's Word column.
        word = None
        if tok.word_index is not None and 0 <= tok.word_index < len(utt.words):
            word = utt.words[tok.word_index].text.rstrip(".?!")
        left_ctx, right_ctx = _context(i)
        row = emit.TokenRow(
            id=gid,
            utterance=utt.id,
            speaker=utt.speaker,
            phone=phone,
            outcome="correct" if tok.error == "correct" else "incorrect",
            t0=tok.t0 - utt.t0,  # relative to clip start
            t1=tok.t1 - utt.t0,
            stress_error=tok.stress_error,
            length_error=tok.length_error,
            word=word,
            left_context=left_ctx,
            right_context=right_ctx,
        )
        if have_both or native_phone_acc:
            writer.add_token(area if area != "other" else "consonants", row)
            # Feed lexical stress: only vowels can bear stress, and a slot is
            # evidence only where a stress mark was actually present.
            if area == "vowels":
                defined = bool(tok.target_stress or tok.actual_stress)
                writer.add_stress(
                    phone,
                    defined=defined,
                    mismatch=tok.stress_error,
                    marks_seen=defined,
                    row=row,
                )
        token_payload.append(
            {
                **row.as_dict(),
                "st": tok.target_stress,
                "sa": tok.actual_stress,
            }
        )

    # These are corpus-native hand judgements, not acoustic-model decisions.
    for area, category in (
        ("lexical-stress", "Stress_accuracy"),
        ("linking", "linkingAcc_accuracy"),
        ("intonation", "Intonation_accuracy"),
    ):
        for idx, event in enumerate(_annotation_events(transcription, category, utt.t0, utt.t1)):
            t0, t1, outcome, label = event
            writer.add_annotation(
                area,
                {
                    "id": f"{utt.id}_{area}_{idx:03d}",
                    "u": utt.id,
                    "spk": utt.speaker,
                    "ph": label,
                    "e": "correct" if outcome == "correct" else "incorrect",
                    "t0": round(t0 - utt.t0, 3),
                    "t1": round(t1 - utt.t0, 3),
                    "w": label,
                },
            )

    writer.add_utterance(
        {
            "id": utt.id,
            "spk": utt.speaker,
            "task": utt.task,
            "text": utt.text,
            "dur": round(utt.t1 - utt.t0, 3),
            "clip": clip_rel,
            "audioAvailable": clip_available,
            "judged": have_both or bool(native_phone_acc),
            "tokens": token_payload,
            "rhythm": rhythm_metrics.as_dict(),
            "pitch": contour.as_dict() if contour else None,
        }
    )


def _find_exb(tg_path: Path, raw_dir: Path) -> Path | None:
    """Locate the .exb for a TextGrid: sibling, then `exb files/` folder."""
    sibling = tg_path.with_suffix(".exb")
    if sibling.exists():
        return sibling
    for cand in raw_dir.rglob("exb files"):
        hit = cand / f"{tg_path.stem}.exb"
        if hit.exists():
            return hit
    matches = list(raw_dir.rglob(f"{tg_path.stem}.exb"))
    return matches[0] if matches else None


def _speaker_meta(exb_path: Path, speaker: str) -> dict | None:
    try:
        tr = exb.parse_exb(exb_path)
    except Exception as e:  # malformed .exb shouldn't kill the build
        return {"error": f"exb parse failed: {e}"}
    # Match by speaker abbreviation or fall back to the first speaker.
    for sp in tr.speakers.values():
        if sp.abbreviation.upper() == speaker or sp.id.upper() == speaker:
            return {"sex": sp.sex, "l1": sp.l1, "l2": sp.l2, **sp.ud}
    if tr.speakers:
        sp = next(iter(tr.speakers.values()))
        return {"sex": sp.sex, "l1": sp.l1, "l2": sp.l2, **sp.ud}
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=None, help="corpus raw dir")
    parser.add_argument(
        "--out", type=Path, default=Path("corpus/processed/site"), help="output dir"
    )
    parser.add_argument("--clips", action="store_true", help="cut clips (needs ffmpeg)")
    parser.add_argument("--limit", type=int, default=None, help="max files (debug)")
    parser.add_argument("--no-clean", action="store_true", help="preserve old generated artifacts")
    parser.add_argument("--skip-pitch", action="store_true", help="skip slow F0 extraction")
    args = parser.parse_args(argv)

    if args.raw is None:
        # Reuse the shared resolver from the sibling scripts.
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from paths import corpus_raw_dir

        raw = corpus_raw_dir()
    else:
        raw = args.raw

    if not raw.is_dir():
        print(f"ERROR: raw corpus not found at {raw}", file=sys.stderr)
        print("Set CORPUS_RAW_DIR or pass --raw.", file=sys.stderr)
        return 1

    return build(
        raw, args.out, cut_clips=args.clips, limit=args.limit,
        clean=not args.no_clean, skip_pitch=args.skip_pitch,
    )


if __name__ == "__main__":
    raise SystemExit(main())
