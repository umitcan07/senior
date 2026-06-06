#!/usr/bin/env python3
"""
upload_learn_audio.py — upload normalized audio recordings to R2.

Modes:
  learn (default) — reads data/manifest.json, maps word_NN slots to ipa/words/<word>.wav keys.
  references      — uploads all ref_NNN.wav files to references/<author>/ref_NNN.wav keys.

Author for 'learn' mode is selected via --dialect (us|uk, default: us).
  us -> genam_jordan (GenAm)
  uk -> rp_jon (RP)

For 'references' mode all four authors are uploaded unless --dialect is given.

Usage:
    python3 scripts/upload_learn_audio.py [--mode learn|references] [--dialect us|uk] [--force] [--dry-run]

Requires environment variables (loaded from app/.env):
    R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME
"""

import argparse
import json
import os
import pathlib
import sys

import boto3
from botocore.exceptions import ClientError
from dotenv import load_dotenv


DIALECT_AUTHOR = {
    "us": "genam_jordan",
    "uk": "rp_jon",
}

ALL_AUTHORS = ["genam_jordan", "genam_katherine", "genam_teyanna", "rp_jon"]


def load_env():
    script_dir = pathlib.Path(__file__).parent
    env_file = script_dir.parent / "app" / ".env"
    if env_file.exists():
        load_dotenv(env_file)
    for var in ("R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"):
        if not os.environ.get(var):
            sys.exit(f"Missing env var: {var}. Add to app/.env or export it.")


def make_s3():
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
    )


def key_exists(s3, bucket: str, key: str) -> bool:
    try:
        s3.head_object(Bucket=bucket, Key=key)
        return True
    except ClientError as e:
        if e.response["Error"]["Code"] == "404":
            return False
        raise


def upload_one(s3, bucket, src, dest_key, force, dry_run, uploaded, skipped, errors):
    if not src.exists():
        errors.append(f"MISSING: {src}  ->  {dest_key}")
        print(f"  MISSING  {src}")
        return

    if not force and not dry_run:
        if key_exists(s3, bucket, dest_key):
            print(f"  skip     {dest_key}  (exists, use --force to overwrite)")
            skipped[0] += 1
            return

    if dry_run:
        print(f"  would upload  {src.parent.name}/{src.name}  ->  {dest_key}")
    else:
        s3.put_object(Bucket=bucket, Key=dest_key, Body=src.read_bytes(), ContentType="audio/wav")
        print(f"  uploaded  {src.parent.name}/{src.name}  ->  {dest_key}")
    uploaded[0] += 1


def run_learn(args, data_root, s3, bucket):
    manifest_path = data_root / "manifest.json"
    if not manifest_path.exists():
        sys.exit(f"manifest.json not found: {manifest_path}")

    learn_words = json.loads(manifest_path.read_text(encoding="utf-8"))["learn_words"]
    author = DIALECT_AUTHOR[args.dialect]
    learn_dir = data_root / "learn" / author

    if not learn_dir.exists():
        sys.exit(f"learn dir not found: {learn_dir}")

    uploaded, skipped, errors = [0], [0], []
    for i, word in enumerate(learn_words, start=1):
        src = learn_dir / f"word_{i:02d}.wav"
        upload_one(s3, bucket, src, word["dest"], args.force, args.dry_run, uploaded, skipped, errors)

    return uploaded[0], skipped[0], errors


def run_references(args, data_root, s3, bucket):
    if args.dialect:
        authors = [DIALECT_AUTHOR[args.dialect]]
    else:
        authors = ALL_AUTHORS

    uploaded, skipped, errors = [0], [0], []
    for author in authors:
        ref_dir = data_root / "references" / author
        if not ref_dir.exists():
            errors.append(f"MISSING dir: {ref_dir}")
            continue
        for wav in sorted(ref_dir.glob("ref_*.wav")):
            dest_key = f"references/{author}/{wav.name}"
            upload_one(s3, bucket, wav, dest_key, args.force, args.dry_run, uploaded, skipped, errors)

    return uploaded[0], skipped[0], errors


def main():
    parser = argparse.ArgumentParser(description="Upload normalized audio recordings to R2.")
    parser.add_argument("--mode", choices=["learn", "references"], default="learn",
                        help="Which asset set to upload (default: learn)")
    parser.add_argument("--dialect", choices=["us", "uk"], default=None,
                        help="Speaker dialect filter. learn default: us. references default: all speakers")
    parser.add_argument("--force", action="store_true", help="Re-upload even if key exists")
    parser.add_argument("--dry-run", action="store_true", help="Print actions without uploading")
    args = parser.parse_args()

    if args.mode == "learn" and args.dialect is None:
        args.dialect = "us"

    load_env()
    s3 = make_s3()
    bucket = os.environ["R2_BUCKET_NAME"]
    data_root = pathlib.Path(__file__).parent.parent / "data"

    if args.mode == "learn":
        uploaded, skipped, errors = run_learn(args, data_root, s3, bucket)
    else:
        uploaded, skipped, errors = run_references(args, data_root, s3, bucket)

    verb = "Would upload" if args.dry_run else "Uploaded"
    print(f"\n{verb} {uploaded} file(s). Skipped {skipped}. Errors: {len(errors)}.")
    for e in errors:
        print(f"  {e}")


if __name__ == "__main__":
    main()
