#!/usr/bin/env python3
"""
Upload /learn word recordings from data/learn/<author>/word_NN.wav to R2.

R2 destination: ipa/words/<author_id>/<dest_filename>
  e.g. data/learn/genam_jordan/word_01.wav -> ipa/words/genam_jordan/see.wav

Reads data/manifest.json for word_NN -> dest mapping.
Reads data/authors.json for author metadata.
Reads R2 credentials from app/.env.

Usage:
    python scripts/upload_learn_audio.py [--dry-run] [--author <id>]
"""

import argparse
import json
import os
import sys
from pathlib import Path

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).parent.parent
DATA_DIR = REPO_ROOT / "data"
MANIFEST_PATH = DATA_DIR / "manifest.json"
AUTHORS_PATH = DATA_DIR / "authors.json"

# .env is gitignored so it won't be in a worktree; walk up to find it
def _find_env() -> Path:
    candidates = [
        REPO_ROOT / "app" / ".env",
        Path.cwd() / "app" / ".env",
    ]
    for p in candidates:
        if p.exists():
            return p
    return candidates[0]  # let load_dotenv silently fail

ENV_PATH = _find_env()


def load_env():
    load_dotenv(ENV_PATH)
    required = [
        "R2_ACCOUNT_ID",
        "R2_ACCESS_KEY_ID",
        "R2_SECRET_ACCESS_KEY",
        "R2_BUCKET_NAME",
        "R2_ENDPOINT",
    ]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        sys.exit(f"Missing env vars: {missing}")


def r2_client():
    return boto3.client(
        "s3",
        region_name="auto",
        endpoint_url=os.getenv("R2_ENDPOINT"),
        aws_access_key_id=os.getenv("R2_ACCESS_KEY_ID"),
        aws_secret_access_key=os.getenv("R2_SECRET_ACCESS_KEY"),
    )


def load_word_map():
    """Return {word_id: dest_filename} from manifest.json."""
    try:
        with open(MANIFEST_PATH, encoding="utf-8") as f:
            data = json.load(f)
    except FileNotFoundError:
        raise ValueError(f"Manifest not found: {MANIFEST_PATH}") from None
    except json.JSONDecodeError as exc:
        raise ValueError(f"Malformed JSON in {MANIFEST_PATH}: {exc}") from exc

    if not isinstance(data, (dict, list)):
        raise ValueError(f"Unexpected top-level type in {MANIFEST_PATH}: {type(data)}")

    # manifest.json is {"_note": ..., "references": [...], "learn_words": [...]}
    entries = data.get("learn_words", data) if isinstance(data, dict) else data
    if isinstance(entries, list):
        result = {}
        for e in entries:
            if not isinstance(e, dict):
                continue
            if "id" not in e or "dest" not in e:
                continue
            result[e["id"]] = Path(e["dest"]).name
        return result
    # fallback: flat dict of id -> dest
    return {k: Path(v).name for k, v in entries.items()}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--author", help="Upload only this author id")
    parser.add_argument("--force", action="store_true", help="Re-upload even if key exists")
    args = parser.parse_args()

    load_env()
    s3 = r2_client()
    bucket = os.getenv("R2_BUCKET_NAME")

    word_map = load_word_map()  # {word_01: see.wav, ...}
    print(f"Manifest: {len(word_map)} words")

    try:
        with open(AUTHORS_PATH, encoding="utf-8") as f:
            authors_data = json.load(f)
    except FileNotFoundError:
        sys.exit(f"Authors file not found: {AUTHORS_PATH}")
    except json.JSONDecodeError as exc:
        sys.exit(f"Malformed JSON in {AUTHORS_PATH}: {exc}")

    if "authors" not in authors_data:
        sys.exit(f"Missing 'authors' key in {AUTHORS_PATH}")

    authors = {
        k: v
        for k, v in authors_data["authors"].items()
        if v.get("kind") == "reference"
    }

    if args.author:
        if args.author not in authors:
            sys.exit(f"Unknown author: {args.author}")
        authors = {args.author: authors[args.author]}

    total_uploaded = 0
    total_skipped = 0
    total_missing = 0

    for author_id, meta in authors.items():
        learn_dir = DATA_DIR / "learn" / author_id
        if not learn_dir.exists():
            print(f"  [WARN] {author_id}: directory not found, skipping")
            continue

        print(f"\n{author_id} ({meta.get('accent', '')})")

        for word_id, dest_name in sorted(word_map.items()):
            src_path = learn_dir / f"{word_id}.wav"
            r2_key = f"ipa/words/{author_id}/{dest_name}"

            if not src_path.exists():
                print(f"  [MISS] {word_id} -> {r2_key} (source not found)")
                total_missing += 1
                continue

            # Check if already uploaded
            if not args.force:
                try:
                    s3.head_object(Bucket=bucket, Key=r2_key)
                    print(f"  [SKIP] {r2_key}")
                    total_skipped += 1
                    continue
                except ClientError as e:
                    if e.response["Error"]["Code"] not in ("404", "NoSuchKey"):
                        raise

            if args.dry_run:
                print(f"  [DRY]  {src_path.name} -> {r2_key}")
                total_uploaded += 1
                continue

            with open(src_path, "rb") as f:
                data = f.read()

            s3.put_object(
                Bucket=bucket,
                Key=r2_key,
                Body=data,
                ContentType="audio/wav",
                CacheControl="public, max-age=31536000, immutable",
            )
            print(f"  [OK]   {src_path.name} -> {r2_key}")
            total_uploaded += 1

    print(
        f"\nDone: {total_uploaded} uploaded, {total_skipped} skipped, {total_missing} missing"
    )


if __name__ == "__main__":
    main()
