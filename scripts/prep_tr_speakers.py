"""
Prepare Turkish-speaker manifests from data/test_recordings/.

Parses 4-speakers-13-sentences.txt (realized IPA per speaker) and matches each
annotation line to its wav file (ref_001.wav = sentence 1, etc.).

Writes data/finetune/tr_speakers/ manifests used for:
  - LOSO fold construction (l2a_ppl+tr adapter, 4 folds)
  - Baseline eval on all 4 speakers (unseen during l2a_ppl training)

Usage:
    python scripts/prep_tr_speakers.py [--data-dir data/test_recordings]
                                        [--out data/finetune/tr_speakers]
"""

import argparse
import os
import re
import sys
import unicodedata

sys.path.insert(0, os.path.dirname(__file__))

# IPA aliases: map realized IPA symbols from the annotation file to POWSM's
# native output convention.  Based on finetuning_failure_analysis.md and the
# Turkish re-annotation convention memory.
TR_ALIAS_MAP = {
    # ɯ (U+026F) IS in POWSM's 40k vocabulary — do NOT remap.
    # Near-zero posterior in base model (English-only training); fine-tuning here fixes that.
    #
    # œ IS in POWSM's vocabulary — keep as is.
    #
    # Aspiration: kʰ tʰ pʰ → k t p (POWSM doesn't encode aspiration)
    "ʰ": "",
    # Tie bars (U+0361 ͡ and U+035C ͜ ) are Unicode category Mn and are ALREADY
    # dropped by the Mn filter before this alias map is checked.  These entries are
    # kept as documentation of intent but are never actually reached at runtime.
    "͜": "",  # combining double breve below
    "͡": "",  # combining double inverted breve
    # ɒ (British English open-back-rounded, U+0252) is not in POWSM's American-English
    # vocab.  Map to ɑ (nearest POWSM monophthong, also open back).
    "ɒ": "ɑ",
    # Plain ASCII r (alveolar trill) → ɹ (English approximant, confirmed in POWSM vocab)
    "r": "ɹ",
    # ˞ (U+02DE, rhotic modifier letter, category Lm) as a bare codepoint is not a
    # POWSM token.  Suppress it; ɜ˞/ə˞ sequences from arpa2powsm use it internally
    # but the TR annotators write e.g. "ɜɾ" (two phones) not "ɜ˞".
    "˞": "",
    # ASCII g (U+0067) is NOT in POWSM vocab; IPA ɡ (U+0261) is.
    # Annotators used ASCII g; remap to U+0261.
    "g": "ɡ",
    # Tapped r ɾ → in-vocab, keep.
    # Diphthongs: annotators used eɪ/oʊ/aɪ/aʊ offglide notation → two separate phones,
    # which char-by-char decomposition handles automatically.
}

# Silence/pause tokens to skip
_SKIP_TOKENS = {"", " "}

SPEAKERS = {
    "Erem":     "erem",
    "Ömer":     "omer",
    "Ümit":     "umit",
    "İbrahim":  "ibrahim",
}

WAV_DIRS = {
    "erem":    "data/test_recordings/erem",
    "omer":    "data/test_recordings/omer",
    "umit":    "data/test_recordings/umit",
    "ibrahim": "data/test_recordings/ibrahim",
}


def normalize_ipa(raw: str) -> list[str]:
    """
    Convert a raw IPA transcription string (one sentence) to a flat list of
    POWSM-compatible phone strings:
      1. NFD normalize — decomposes combining chars (tie bars ͡/͜, nasalization ̃) into
         separate codepoints so phones like kʰit͡ʃɯn are split correctly
      2. Drop Unicode category Mn (combining diacritics): ñ→n, æ̃→æ, ͡ dropped, etc.
      3. Apply alias map: aspiration ʰ (U+02B0, category Lm) → "" stripped;
         everything else passes through unchanged
      4. Drop whitespace (word boundaries are not phones)
      5. Each remaining codepoint is one phone
    This correctly splits concatenated-phone words like kʰit͡ʃɯn into
    ['k', 'i', 't', 'ʃ', 'ɯ', 'n'] rather than treating the whole word as one token.
    """
    s = unicodedata.normalize("NFD", raw.strip())
    phones = []
    for ch in s:
        if unicodedata.category(ch) == "Mn":
            continue
        if ch.isspace():
            continue
        replacement = TR_ALIAS_MAP.get(ch, ch)
        if replacement:
            phones.append(replacement)
    return phones


def phones_to_espnet_text(phones: list[str]) -> str:
    return "".join(f"/{p}/" for p in phones if p)


def parse_annotation_file(path: str) -> dict[str, dict[int, list[str]]]:
    """
    Parse 4-speakers-13-sentences.txt.
    Returns {speaker_key: {sentence_num: phone_list}}.
    """
    with open(path, "r", encoding="utf-8-sig") as f:
        content = f.read()

    result: dict[str, dict[int, list[str]]] = {}
    current_speaker = None

    for line in content.splitlines():
        line_stripped = line.strip()
        if not line_stripped:
            continue

        # Detect speaker header (name-only lines)
        if line_stripped in SPEAKERS:
            current_speaker = SPEAKERS[line_stripped]
            result[current_speaker] = {}
            continue

        # Detect sentence lines: "N. IPA text"
        m = re.match(r"^(\d+)\.\s+(.+)$", line_stripped)
        if m and current_speaker:
            num = int(m.group(1))
            ipa_raw = m.group(2)
            phones = normalize_ipa(ipa_raw)
            if len(phones) >= 3:
                result[current_speaker][num] = phones

    return result


def write_manifests(entries: list[dict], out_dir: str, name: str) -> None:
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "wav.scp"),  "w", encoding="utf-8") as ws, \
         open(os.path.join(out_dir, "text"),     "w", encoding="utf-8") as tf, \
         open(os.path.join(out_dir, "utt2spk"), "w", encoding="utf-8") as us:
        for e in sorted(entries, key=lambda x: x["utt_id"]):
            ws.write(f"{e['utt_id']} {e['wav_path']}\n")
            tf.write(f"{e['utt_id']} {e['text']}\n")
            us.write(f"{e['utt_id']} {e['speaker']}\n")
    print(f"  {name}: {len(entries)} entries -> {out_dir}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--annotation",
                    default="data/test_recordings/4-speakers-13-sentences.txt")
    ap.add_argument("--out", default="data/finetune/tr_speakers")
    args = ap.parse_args()

    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    annotations = parse_annotation_file(
        os.path.join(repo_root, args.annotation)
    )

    all_entries: list[dict] = []
    per_speaker: dict[str, list[dict]] = {}

    for spk, sentences in annotations.items():
        wav_dir = os.path.join(repo_root, WAV_DIRS[spk])
        per_speaker[spk] = []

        for sent_num, phones in sentences.items():
            wav_fname = f"ref_{sent_num:03d}.wav"
            abs_path = os.path.join(wav_dir, wav_fname)
            if not os.path.exists(abs_path):
                print(f"  WARN: {abs_path} not found, skipping")
                continue

            # Store repo-root-relative POSIX path so manifests resolve both on the
            # host (cwd=repo root) and inside the training container (cwd=/workspace
            # with the repo mounted there).  Never absolute host paths.
            wav_path = os.path.relpath(abs_path, repo_root).replace(os.sep, "/")

            utt_id = f"TR_{spk}_s{sent_num:02d}"
            text = phones_to_espnet_text(phones)
            entry = {"utt_id": utt_id, "wav_path": wav_path,
                     "text": text, "speaker": f"TR_{spk}"}
            all_entries.append(entry)
            per_speaker[spk].append(entry)

    print(f"\nTotal TR entries: {len(all_entries)}")
    for spk, entries in per_speaker.items():
        print(f"  {spk}: {len(entries)} utterances")

    # Write full set (for eval against l2a_ppl baseline — all 4 speakers unseen)
    out_root = os.path.join(repo_root, args.out)
    write_manifests(all_entries, os.path.join(out_root, "all"), "all")

    # Write per-speaker (for LOSO fold construction)
    for spk, entries in per_speaker.items():
        write_manifests(entries, os.path.join(out_root, spk), spk)

    # Write LOSO fold manifests: fold-k eval = speaker k, train = other 3
    speakers = list(per_speaker.keys())
    print("\nLOSO folds:")
    for k, held_out in enumerate(speakers):
        train_entries = []
        for spk, entries in per_speaker.items():
            if spk != held_out:
                train_entries.extend(entries)
        fold_train_dir = os.path.join(out_root, f"loso_fold{k+1}_train_tr")
        fold_eval_dir  = os.path.join(out_root, f"loso_fold{k+1}_eval")
        write_manifests(train_entries,           fold_train_dir, f"fold{k+1}-train-TR")
        write_manifests(per_speaker[held_out],   fold_eval_dir,  f"fold{k+1}-eval ({held_out})")

    print("\nDone.")


if __name__ == "__main__":
    main()
