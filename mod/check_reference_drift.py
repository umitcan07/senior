#!/usr/bin/env python3
"""
Sanity check: do the reference phones stored in the DB still reflect the
*currently deployed* model's output? (issue #94)

The assess worker is stateless and diffs a learner's phones against the
reference phones read from ``reference_speeches.phone_timings_json`` /
``ipa_transcription``. If the deployed endpoint model and the stored reference
phones diverge, the diff conflates model differences with real pronunciation
errors. There is no ``model_version`` column on the table, so nothing in the DB
records which model produced the stored phones — we re-run the model and diff.

This is a one-shot drift check, not a CI gate: re-run the deployed model
(baseline POWSM + the baked LoRA adapter, gated by ``POWSM_ADAPTER_DIR`` exactly
as the endpoint loads it) over every reference recording's free_alignment and
compare the fresh bare-token sequence against the stored one. Same model + same
audio is deterministic, so any difference is genuine drift between what is
deployed and what is stored.

Run inside the worker-assessment container (so the loaded model is the deployed
one), pointing at a DB dump produced by ``app/scripts/dump-reference-phones.ts``:

  python3 /worker/check_reference_drift.py \
    --refs-json /data/ref_phones.json \
    --audio-root /data \
    --report /data/reference_drift_report.json

Storage keys in the dump look like ``references/<author>/<ref_id>.wav`` and are
resolved relative to ``--audio-root``. Exit code is non-zero if any reference
drifted (so a wrapper can fail loudly).
"""

import argparse
import json
import logging
import os
import sys

import librosa

# Make sibling modules importable whether run in-container (/worker on path) or
# standalone from this directory.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from alignment import get_aligner  # noqa: E402
from assessment.edit_distance import edit_operations  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)


def free_phones(aligner, wav_path: str) -> list[str]:
    """Deployed-model bare-token sequence for one recording (drops ▁ boundaries)."""
    audio, _ = librosa.load(wav_path, sr=16000, mono=True)
    segments = aligner.free_alignment(audio)
    return [s.token for s in segments if s.token != "▁"]


def main() -> None:
    parser = argparse.ArgumentParser(description="Reference phone drift check (#94)")
    parser.add_argument(
        "--refs-json",
        required=True,
        help="DB dump from app/scripts/dump-reference-phones.ts",
    )
    parser.add_argument(
        "--audio-root",
        default="/data",
        help="Dir that storage keys are resolved against (storage_key is "
        "references/<author>/<ref_id>.wav)",
    )
    parser.add_argument("--model", default=None, help="POWSM model tag override")
    parser.add_argument(
        "--report", default=None, help="Write a JSON drift report to this path"
    )
    args = parser.parse_args()

    with open(args.refs_json) as f:
        refs = json.load(f)

    aligner = get_aligner(model_tag=args.model)
    # Provenance: record which model produced the fresh phones we diff against,
    # the same way precompute_references.py stamps its output.
    adapter_dir = getattr(aligner, "adapter_dir", None)
    model_version = (
        os.path.basename(os.path.dirname(adapter_dir.rstrip("/")))
        if adapter_dir
        else aligner.model_tag
    )
    log.info(
        "deployed model: model_tag=%s adapter=%s model_version=%s",
        aligner.model_tag,
        adapter_dir or "none",
        model_version,
    )

    rows = []
    matched = drifted = missing = 0

    for ref in refs:
        ref_id = ref["id"]
        storage_key = ref["storageKey"]
        stored = ref.get("phones") or []
        wav_path = os.path.join(args.audio_root, storage_key)

        if not os.path.exists(wav_path):
            log.warning("MISSING wav: %s (%s)", wav_path, ref_id)
            missing += 1
            rows.append(
                {"id": ref_id, "storage_key": storage_key, "status": "missing_audio"}
            )
            continue

        fresh = free_phones(aligner, wav_path)

        if fresh == stored:
            matched += 1
            log.info("OK %s (%s, %d phones)", storage_key, ref_id, len(stored))
            continue

        drifted += 1
        ops = edit_operations(fresh, stored)  # actual=fresh, target=stored
        denom = max(len(stored), 1)
        per = round(len(ops) / denom, 4)
        log.warning(
            "DRIFT %s (%s): %d edits, PER=%.4f  stored=%d fresh=%d",
            storage_key,
            ref_id,
            len(ops),
            per,
            len(stored),
            len(fresh),
        )
        rows.append(
            {
                "id": ref_id,
                "storage_key": storage_key,
                "author": ref.get("authorSlug"),
                "dialect": ref.get("dialect"),
                "status": "drift",
                "edits": len(ops),
                "per_vs_stored": per,
                "stored_len": len(stored),
                "fresh_len": len(fresh),
                "stored_phones": " ".join(stored),
                "fresh_phones": " ".join(fresh),
            }
        )

    summary = {
        "model_tag": aligner.model_tag,
        "adapter_dir": adapter_dir,
        "model_version": model_version,
        "total": len(refs),
        "matched": matched,
        "drifted": drifted,
        "missing_audio": missing,
    }
    log.info(
        "Done. total=%d matched=%d drifted=%d missing_audio=%d",
        len(refs),
        matched,
        drifted,
        missing,
    )

    if args.report:
        with open(args.report, "w") as f:
            json.dump(
                {"summary": summary, "drift": [r for r in rows if r["status"] != "ok"]},
                f,
                ensure_ascii=False,
                indent=2,
            )
        log.info("Report written to %s", args.report)

    # Non-zero exit if anything drifted or audio was missing, so a caller notices.
    if drifted or missing:
        sys.exit(1)


if __name__ == "__main__":
    main()
