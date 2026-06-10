#!/usr/bin/env python3
"""
Batch system-scoring of the Turkish validation set (E6.4 / #33).

Runs the assessment pipeline over every (learner_recording, reference) pair and
persists one result JSON per clip, so E6.6 (#35) can correlate the system score
against the human intelligibility ratings collected via /intelligibility-score.

Runs the SAME core the RunPod endpoint runs (`mod/assessment/assess.assess_audio`)
in-process — no HTTP / RunPod creds needed. Pick the model with POWSM_ADAPTER_DIR
(point it at the deployed adapter, e.g. /workspace/exp/l2a_ppl/best) so the scores
match production. CPU-safe (set CUDA_VISIBLE_DEVICES= to avoid GPU contention).

Each learner clip (data/test_recordings/<speaker>/ref_NNN.wav) is scored against a
single fixed native reference per sentence (from data/precompute/<ref_author>/
ref_NNN.json — re-precompute with the same model first so reference phones match).

Output: data/validation/results/<speaker>/ref_NNN.json (the full assess result +
clip key). Idempotent with --skip-existing.

Usage (on the pod):
    POWSM_ADAPTER_DIR=/workspace/exp/l2a_ppl/best CUDA_VISIBLE_DEVICES= \
    python scripts/batch_assess.py --data-dir data --out data/validation/results
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "mod"))
sys.path.insert(0, str(REPO / "mod" / "assessment"))

REF_AUTHOR_PRIORITY = ["genam_katherine", "genam_jordan", "genam_teyanna", "rp_jon"]


def load_reference_phones(precompute_dir: Path, ref_id: str, authors: list[str]):
    """Return (author, phones) for the first reference author that has this sentence."""
    for a in authors:
        f = precompute_dir / a / f"{ref_id}.json"
        if f.exists():
            d = json.loads(f.read_text(encoding="utf-8"))
            phones = [p["token"] for p in d.get("phone_timings", []) if p["token"] != "▁"]
            if phones:
                return a, phones, d.get("model_version", d.get("model_tag"))
    return None, None, None


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data-dir", default="data")
    ap.add_argument("--out", default="data/validation/results")
    ap.add_argument("--reference-authors", nargs="+", default=REF_AUTHOR_PRIORITY)
    ap.add_argument("--speakers", nargs="*", default=None,
                    help="learner speaker dirs (default: all test_user authors)")
    ap.add_argument("--device", default=None)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--skip-existing", action="store_true")
    args = ap.parse_args()

    data_dir = (REPO / args.data_dir) if not os.path.isabs(args.data_dir) else Path(args.data_dir)
    out = (REPO / args.out) if not os.path.isabs(args.out) else Path(args.out)
    precompute = data_dir / "precompute"
    tr_dir = data_dir / "test_recordings"

    authors = json.loads((data_dir / "authors.json").read_text(encoding="utf-8"))["authors"]
    manifest = json.loads((data_dir / "manifest.json").read_text(encoding="utf-8"))["references"]
    ref_ids = [e["id"] for e in manifest]

    speakers = args.speakers
    if speakers is None:
        speakers = sorted(
            slug for slug, m in authors.items()
            if m.get("kind") == "test_user" and (tr_dir / slug).is_dir()
        )

    # lazy import — pulls torch/espnet + loads the model (POWSM_ADAPTER_DIR adapter)
    import librosa
    import alignment  # noqa: F401  (ensures TARGET_SR + singleton wiring)
    from assess import assess_audio

    print(f"[setup] speakers={speakers} adapter={os.environ.get('POWSM_ADAPTER_DIR') or 'base'}")

    scored = abstained = skipped = errors = 0
    rows = []
    for spk in speakers:
        spk_out = out / spk
        spk_out.mkdir(parents=True, exist_ok=True)
        for ref_id in ref_ids:
            wav = tr_dir / spk / f"{ref_id}.wav"
            if not wav.exists():
                continue
            res_path = spk_out / f"{ref_id}.json"
            if args.skip_existing and res_path.exists():
                skipped += 1
                continue
            ref_author, ref_phones, ref_model = load_reference_phones(
                precompute, ref_id, args.reference_authors
            )
            if not ref_phones:
                print(f"  [skip] {spk}/{ref_id}: no reference precompute")
                skipped += 1
                continue
            try:
                audio, _ = librosa.load(str(wav), sr=alignment.TARGET_SR, mono=True)
                result = assess_audio(
                    audio, alignment.TARGET_SR,
                    reference_id=f"{spk}/{ref_id}", reference_phones=ref_phones,
                    device=args.device,
                )
            except Exception as exc:
                print(f"  [err] {spk}/{ref_id}: {exc}")
                errors += 1
                continue

            record = {
                "clip": f"{spk}/{ref_id}",
                "speaker": spk,
                "ref_id": ref_id,
                "reference_author": ref_author,
                "reference_model": ref_model,
                "result": result,
            }
            res_path.write_text(json.dumps(record, ensure_ascii=False, indent=2),
                                encoding="utf-8")
            status = result.get("status")
            if status == "scored":
                scored += 1
            elif status == "abstained":
                abstained += 1
            rows.append({
                "clip": f"{spk}/{ref_id}", "status": status,
                "score": result.get("score"), "confidence": result.get("confidence"),
                "abstention": (result.get("abstention") or {}).get("reason"),
            })
            if (scored + abstained) % 25 == 0:
                print(f"  ... {scored + abstained} assessed")
            if args.limit and (scored + abstained) >= args.limit:
                break
        if args.limit and (scored + abstained) >= args.limit:
            break

    summary = {
        "adapter": os.environ.get("POWSM_ADAPTER_DIR") or "base",
        "speakers": speakers,
        "scored": scored, "abstained": abstained, "skipped": skipped, "errors": errors,
        "clips": rows,
    }
    out.mkdir(parents=True, exist_ok=True)
    (out / "_summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2),
                                       encoding="utf-8")
    print(f"\n[done] scored={scored} abstained={abstained} skipped={skipped} errors={errors}")
    print(f"       results in {out}/<speaker>/ref_NNN.json + _summary.json")


if __name__ == "__main__":
    main()
