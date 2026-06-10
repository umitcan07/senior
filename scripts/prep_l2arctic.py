"""
Prepare L2-ARCTIC manifests for DoRA fine-tuning.

Reads annotation/ TextGrids (150 per speaker, ~3600 total) that have CPL/PPL error
tags and writes two sets of ESPnet-style manifests under data/finetune/:

  l2a_cpl/  — canonical (dictionary) phone targets → control condition
  l2a_ppl/  — perceived (produced) phone targets   → corrected condition

The CPL vs PPL ablation on identical audio is the core thesis experiment.

Usage:
    python scripts/prep_l2arctic.py --l2arctic /path/to/l2arctic_release_v5.0 \
                                    --out data/finetune \
                                    [--validate-vocab]  # loads POWSM to check OOVs
"""

import argparse
import os
import re
import sys
from collections import defaultdict
from typing import Dict, List, Tuple, Optional
import random

sys.path.insert(0, os.path.dirname(__file__))
from arpa2powsm import arpa_to_powsm, phones_to_espnet_text, validate_phones, _SKIP_LABELS

# 4 speakers held out as dev set (one per L1 group, chosen for annotation completeness)
DEV_SPEAKERS = {"YDCK", "NCC", "SVBI", "TXHC"}

# L1 mapping (for metadata only)
L1_MAP = {
    "ABA": "Arabic",  "RRBI": "Arabic",  "SKA": "Arabic",   "MBMPS": "Arabic",
    "YBAA": "Hindi",  "ERMS": "Hindi",   "TNI": "Hindi",    "NCC": "Hindi",
    "HJK": "Korean",  "HKK": "Korean",   "YKWK": "Korean",  "YDCK": "Korean",
    "TXHC": "Mandarin","LXC": "Mandarin","BWC": "Mandarin", "ZHAA": "Mandarin",
    "EBVS": "Spanish","HQTV": "Spanish", "NJS": "Spanish",  "SVBI": "Spanish",
    "PNV": "Vietnamese","TLV": "Vietnamese","THV": "Vietnamese","YDCK": "Vietnamese",
}


# ---------------------------------------------------------------------------
# TextGrid parser
# ---------------------------------------------------------------------------

def parse_textgrid_phones(path: str) -> List[Tuple[float, float, str]]:
    """
    Parse a Praat TextGrid and return the phones-tier intervals as
    [(xmin, xmax, text), ...].  Raises ValueError if no phones tier found.
    """
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    # Split into items (tiers)
    items = re.split(r'\s+item\s*\[\d+\]\s*:', content)

    phones_tier = None
    for item in items:
        name_match = re.search(r'name\s*=\s*"([^"]*)"', item)
        if name_match and name_match.group(1).strip().lower() == "phones":
            phones_tier = item
            break

    if phones_tier is None:
        raise ValueError(f"No phones tier in {path}")

    intervals = re.findall(
        r'xmin\s*=\s*([\d.e+-]+)\s+xmax\s*=\s*([\d.e+-]+)\s+text\s*=\s*"([^"]*)"',
        phones_tier,
    )
    return [(float(xmin), float(xmax), text) for xmin, xmax, text in intervals]


def parse_error_label(text: str) -> Tuple[Optional[str], Optional[str]]:
    """
    Parse a phone interval label into (cpl, ppl).

    Regular phone:  "AH1"     → cpl="AH1",  ppl="AH1"
    Substitution:   "TH,T,s"  → cpl="TH",   ppl="T"
    Addition:       "sil,K,a" → cpl=None,   ppl="K"   (phone added, not in CPL)
    Deletion:       "AH0,,d"  → cpl="AH0",  ppl=None  (phone deleted, not in PPL)

    Strips trailing whitespace from labels (observed in corpus: "Z,S,s ").
    """
    text = text.strip()

    if "," not in text:
        # Regular phone label
        upper = text.upper()
        if upper in _SKIP_LABELS or upper in {"SIL", "SP", ""}:
            return None, None
        return upper, upper

    parts = text.split(",", 2)
    if len(parts) < 2:
        return None, None

    cpl_raw = parts[0].strip().upper()
    ppl_raw = parts[1].strip().upper()

    cpl = cpl_raw if cpl_raw and cpl_raw not in _SKIP_LABELS else None
    ppl = ppl_raw if ppl_raw and ppl_raw not in _SKIP_LABELS else None

    return cpl, ppl


def extract_phone_sequences(
    textgrid_path: str,
) -> Tuple[List[str], List[str]]:
    """
    Return (cpl_arpa_phones, ppl_arpa_phones) for one annotated TextGrid.
    Silences and deletions/additions are handled per label type.
    """
    intervals = parse_textgrid_phones(textgrid_path)
    cpl_phones, ppl_phones = [], []

    for _, _, text in intervals:
        cpl, ppl = parse_error_label(text)
        if cpl is not None:
            cpl_phones.append(cpl)
        if ppl is not None:
            ppl_phones.append(ppl)

    return cpl_phones, ppl_phones


# ---------------------------------------------------------------------------
# Manifest writer
# ---------------------------------------------------------------------------

def write_manifest(out_dir: str, split: str, entries: List[dict]) -> None:
    """Write wav.scp, text, utt2spk for one split."""
    split_dir = os.path.join(out_dir, split)
    os.makedirs(split_dir, exist_ok=True)

    # newline="\n" forces LF even on Windows (Linux consumers must not see CR bytes).
    wav_scp   = open(os.path.join(split_dir, "wav.scp"),   "w", encoding="utf-8", newline="\n")
    text_file = open(os.path.join(split_dir, "text"),      "w", encoding="utf-8", newline="\n")
    utt2spk   = open(os.path.join(split_dir, "utt2spk"),   "w", encoding="utf-8", newline="\n")

    for e in sorted(entries, key=lambda x: x["utt_id"]):
        wav_scp.write(f"{e['utt_id']} {e['wav_path']}\n")
        text_file.write(f"{e['utt_id']} {e['text']}\n")
        utt2spk.write(f"{e['utt_id']} {e['speaker']}\n")

    wav_scp.close(); text_file.close(); utt2spk.close()
    print(f"  wrote {len(entries)} entries -> {split_dir}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--l2arctic", required=True,
                    help="Root of l2arctic_release_v5.0/")
    ap.add_argument("--out", default="data/finetune",
                    help="Output directory (data/finetune)")
    ap.add_argument("--validate-vocab", action="store_true",
                    help="Load POWSM and check all phones are in-vocab (needs GPU env)")
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()

    random.seed(args.seed)

    # Repo root — used to store wav paths relative to it (POSIX), so manifests
    # resolve both on the host (cwd=repo root) and in the container (cwd=/workspace,
    # repo mounted there).  Never absolute host paths.
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    root = args.l2arctic
    speakers = [
        d for d in os.listdir(root)
        if os.path.isdir(os.path.join(root, d, d, "annotation"))
    ]
    print(f"Found {len(speakers)} speakers with annotation/: {sorted(speakers)}")

    cpl_train, cpl_dev = [], []
    ppl_train, ppl_dev = [], []
    oov_report: Dict[str, int] = defaultdict(int)
    skipped = 0

    for spk in sorted(speakers):
        ann_dir = os.path.join(root, spk, spk, "annotation")
        wav_dir = os.path.join(root, spk, spk, "wav")
        split = "dev" if spk in DEV_SPEAKERS else "train"

        tg_files = sorted(f for f in os.listdir(ann_dir) if f.endswith(".TextGrid"))

        for tg_fname in tg_files:
            utt_id = f"{spk}_{tg_fname.replace('.TextGrid', '')}"
            wav_path = os.path.join(wav_dir, tg_fname.replace(".TextGrid", ".wav"))

            if not os.path.exists(wav_path):
                skipped += 1
                continue

            # Store repo-root-relative POSIX path (see repo_root note above)
            wav_path = os.path.relpath(os.path.abspath(wav_path), repo_root).replace(os.sep, "/")

            tg_path = os.path.join(ann_dir, tg_fname)
            try:
                cpl_arpa, ppl_arpa = extract_phone_sequences(tg_path)
            except Exception as exc:
                print(f"  WARN: skipping {tg_path}: {exc}")
                skipped += 1
                continue

            # Convert to POWSM IPA phone lists
            cpl_phones, ppl_phones = [], []
            for a in cpl_arpa:
                phones = arpa_to_powsm(a)
                if not phones:
                    oov_report[f"CPL-UNKNOWN:{a}"] += 1
                cpl_phones.extend(phones)
            for a in ppl_arpa:
                phones = arpa_to_powsm(a)
                if not phones:
                    oov_report[f"PPL-UNKNOWN:{a}"] += 1
                ppl_phones.extend(phones)

            if len(cpl_phones) < 3 or len(ppl_phones) < 3:
                skipped += 1
                continue

            cpl_text = phones_to_espnet_text(cpl_phones)
            ppl_text = phones_to_espnet_text(ppl_phones)

            entry_cpl = {"utt_id": utt_id, "wav_path": wav_path,
                         "text": cpl_text, "speaker": spk}
            entry_ppl = {"utt_id": utt_id, "wav_path": wav_path,
                         "text": ppl_text, "speaker": spk}

            if split == "dev":
                cpl_dev.append(entry_cpl)
                ppl_dev.append(entry_ppl)
            else:
                cpl_train.append(entry_cpl)
                ppl_train.append(entry_ppl)

    print(f"\nParsed: {len(cpl_train)} train, {len(cpl_dev)} dev utterances ({skipped} skipped)")

    if oov_report:
        print(f"\nUnknown ARPAbet labels (not in arpa2powsm map):")
        for label, count in sorted(oov_report.items(), key=lambda x: -x[1])[:20]:
            print(f"  {label}: {count}")
        print("  -> extend arpa2powsm._BASE_MAP if these are real phones")

    print("\nWriting l2a_cpl manifests...")
    cpl_out = os.path.join(args.out, "l2a_cpl")
    write_manifest(cpl_out, "train", cpl_train)
    write_manifest(cpl_out, "dev",   cpl_dev)

    print("\nWriting l2a_ppl manifests...")
    ppl_out = os.path.join(args.out, "l2a_ppl")
    write_manifest(ppl_out, "train", ppl_train)
    write_manifest(ppl_out, "dev",   ppl_dev)

    # Optional: validate phone vocab against live POWSM token list
    if args.validate_vocab:
        print("\nValidating vocab against POWSM token_list (loading model)...")
        import sys; sys.path.insert(0, "mod")
        from alignment import POWSMAligner
        aligner = POWSMAligner()
        token_list = aligner.token_list

        all_phones = set()
        for e in cpl_train + cpl_dev + ppl_train + ppl_dev:
            phones = [p for p in e["text"].split("/") if p]
            all_phones.update(phones)

        oovs = validate_phones(list(all_phones), token_list)
        if oovs:
            print(f"  OOV phones (NOT in POWSM token_list): {oovs}")
            print("  → add aliases in arpa2powsm.py before training")
        else:
            print(f"  All {len(all_phones)} phones are in-vocab.")

    print("\nDone.")


if __name__ == "__main__":
    main()
