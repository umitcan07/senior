#!/usr/bin/env python3
"""
Precompute free_alignment for all native reference audio files and write JSON.

Run inside the worker-assessment container:
  docker compose -f docker-compose.dev.yml exec worker-assessment \
    python3 /worker/precompute_references.py --data-dir /data

Output: data/precompute/<author>/ref_NNN.json
  { author, dialect, id, text, ipa_transcription, phone_timings, model_tag }

Known exclusion: genam_jordan/ref_019 (recording says "morning", text says
"evening" — re-record pending). Hardcoded here; remove when re-recorded.
"""

import argparse
import json
import logging
import os
import sys

import librosa

# alignment.py is mounted at /worker/alignment.py when run in the container.
from alignment import get_aligner

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

EXCLUDE = {("genam_jordan", "ref_019")}


def main() -> None:
    parser = argparse.ArgumentParser(description="Precompute reference alignments")
    parser.add_argument("--data-dir", default="/data")
    parser.add_argument("--authors-json", default=None)
    parser.add_argument("--manifest", default=None)
    parser.add_argument("--model", default=None, help="POWSM model tag override")
    parser.add_argument(
        "--skip-existing",
        action="store_true",
        help="Skip (author, ref_id) pairs where output JSON already exists",
    )
    args = parser.parse_args()

    data_dir = args.data_dir
    authors_path = args.authors_json or os.path.join(data_dir, "authors.json")
    manifest_path = args.manifest or os.path.join(data_dir, "manifest.json")

    with open(authors_path) as f:
        authors_data = json.load(f)["authors"]

    reference_authors = {
        slug: meta
        for slug, meta in authors_data.items()
        if meta.get("kind") == "reference"
    }

    with open(manifest_path) as f:
        manifest = json.load(f)["references"]
    ref_text: dict[str, str] = {entry["id"]: entry["text"] for entry in manifest}

    aligner = get_aligner(model_tag=args.model)
    model_tag = aligner.model_tag

    total = skipped = errors = written = 0

    for author_slug, author_meta in reference_authors.items():
        dialect = author_meta["dialect"]
        ref_dir = os.path.join(data_dir, "references", author_slug)
        out_dir = os.path.join(data_dir, "precompute", author_slug)
        os.makedirs(out_dir, exist_ok=True)

        for ref_id, text in sorted(ref_text.items()):
            total += 1
            key = (author_slug, ref_id)

            if key in EXCLUDE:
                log.info("SKIP (excluded): %s/%s", author_slug, ref_id)
                skipped += 1
                continue

            out_path = os.path.join(out_dir, f"{ref_id}.json")
            if args.skip_existing and os.path.exists(out_path):
                log.info("SKIP (exists): %s/%s", author_slug, ref_id)
                skipped += 1
                continue

            wav_path = os.path.join(ref_dir, f"{ref_id}.wav")
            if not os.path.exists(wav_path):
                log.warning("MISSING wav: %s", wav_path)
                errors += 1
                continue

            try:
                audio, _ = librosa.load(wav_path, sr=16000, mono=True)
                segments = aligner.free_alignment(audio)
            except Exception as exc:
                log.error("ERROR aligning %s/%s: %s", author_slug, ref_id, exc)
                errors += 1
                continue

            # ipa_transcription: join non-▁ tokens (▁ marks silence/word boundary)
            ipa_parts = [seg.token for seg in segments if seg.token != "▁"]
            ipa_transcription = " ".join(ipa_parts)

            phone_timings = [seg.to_dict() for seg in segments]

            result = {
                "author": author_slug,
                "dialect": dialect,
                "id": ref_id,
                "text": text,
                "ipa_transcription": ipa_transcription,
                "phone_timings": phone_timings,
                "model_tag": model_tag,
            }

            with open(out_path, "w") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            log.info("OK: %s/%s → %d phones", author_slug, ref_id, len(segments))
            written += 1

    log.info(
        "Done. total=%d written=%d skipped=%d errors=%d",
        total,
        written,
        skipped,
        errors,
    )
    if errors:
        sys.exit(1)


if __name__ == "__main__":
    main()
