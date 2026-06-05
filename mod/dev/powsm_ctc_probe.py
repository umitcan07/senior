#!/usr/bin/env python3
"""
Epic E1 experiment: verify POWSM CTC forced alignment works locally BEFORE
stripping the V1 forced-aligner path (issue #11). Run inside the worker-assessment image:

  docker run --rm --gpus all \
    -v "$PWD/mod:/worker/mod" -v "$PWD/sig/exp/ctc_probe:/probe" \
    -e HF_HOME=/probe/hf_cache \
    senior-worker-assessment:latest python3 /worker/mod/dev/powsm_ctc_probe.py

It does NOT touch assess.py. Pure read-only probe. Goals:
  1. Confirm which forced-alignment API actually exists in espnet 202412.
  2. Confirm the real frame stride (speech_resolution) — V2_CONTEXT says 0.04.
  3. Produce phone-level timestamps for a real reference WAV + its IPA.
  4. Exercise the free-alignment / GOP path (ctc.log_softmax + argmax).
"""
import json
import sys
import numpy as np
import torch
import librosa
import torchaudio.functional as AF

PROBE_DIR = "/probe"
TARGET_SR = 16000
PAD_SECONDS = 20


def sep(title):
    print(f"\n{'=' * 70}\n{title}\n{'=' * 70}")


def main():
    sep("0. environment")
    print("torch", torch.__version__, "| cuda", torch.cuda.is_available())
    device = "cuda" if torch.cuda.is_available() else "cpu"

    sep("1. load espnet/powsm (PR task)")
    from espnet2.bin.s2t_inference import Speech2Text

    s2t = Speech2Text.from_pretrained(
        "espnet/powsm", device=device, lang_sym="<eng>", task_sym="<pr>"
    )
    model = s2t.s2t_model
    print("s2t_model type:", type(model).__name__)
    print("has s2t_model.forced_align:", hasattr(model, "forced_align"))
    print("has ctc:", hasattr(model, "ctc"),
          "| ctc.forced_align:", hasattr(getattr(model, "ctc", None), "forced_align"))
    print("ctc public methods:",
          [m for m in dir(model.ctc) if not m.startswith("_")])

    sep("2. frame stride / blank / vocab")
    frame_sec = None
    args = getattr(s2t, "s2t_train_args", None)
    pconf = getattr(args, "preprocessor_conf", None) if args else None
    print("preprocessor_conf:", pconf)
    if isinstance(pconf, dict) and "speech_resolution" in pconf:
        frame_sec = float(pconf["speech_resolution"])
    print("frame_sec (speech_resolution):", frame_sec)
    blank_id = getattr(model, "blank_id", 0)
    token_list = s2t.converter.token_list
    print("blank_id:", blank_id, "| token_list size:", len(token_list))
    print("token_list[blank_id]:", repr(token_list[blank_id]))

    sep("3. load reference clip + IPA")
    manifest = json.load(open(f"{PROBE_DIR}/manifest.json"))
    if not manifest:
        raise SystemExit("manifest.json is empty — run app/scripts/fetch-one-reference.ts first")
    # fetch-one-reference.ts orders by word_count ASC, so [0] is the shortest clip.
    ref = manifest[0]
    print("content:", ref["content"])
    print("ipa:    ", ref["ipa"])
    wav, _ = librosa.load(f"{PROBE_DIR}/{ref['wav']}", sr=TARGET_SR, mono=True)
    dur = len(wav) / TARGET_SR
    print(f"clip duration: {dur:.2f}s ({len(wav)} samples)")
    padded = np.zeros(TARGET_SR * PAD_SECONDS, dtype=np.float32)
    padded[: len(wav)] = wav
    speech = torch.from_numpy(padded).unsqueeze(0).to(device)
    speech_lengths = torch.tensor([len(padded)], device=device)

    sep("4. tokenize IPA -> ids (must contain no blank)")
    tokens = s2t.tokenizer.text2tokens(ref["ipa"])
    ids = s2t.converter.tokens2ids(tokens)
    print("tokens:", tokens)
    print("ids:   ", ids)
    has_blank = any(i == blank_id for i in ids)
    unk = [t for t, i in zip(tokens, ids) if t not in token_list]
    print("contains blank:", has_blank, "| count:", len(ids))
    if unk:
        print("WARNING unknown tokens:", unk)

    sep("5. encoder forward + CTC log-probs (free / GOP path)")
    with torch.no_grad():
        enc, enc_lens = model.encode(speech, speech_lengths)
        print("enc shape:", tuple(enc.shape), "| enc_lens:", enc_lens.tolist())
        log_probs = model.ctc.log_softmax(enc)
        argmax = model.ctc.argmax(enc)
        print("log_probs shape:", tuple(log_probs.shape))
    n_frames = int(enc_lens[0])
    if frame_sec:
        print(f"encoder frames span {n_frames * frame_sec:.2f}s "
              f"vs clip {dur:.2f}s (sanity: should be >= clip)")
    # greedy collapse of argmax path -> recognized phones
    greedy = []
    prev = None
    for f in argmax[0].tolist():
        if f != blank_id and f != prev:
            greedy.append(token_list[f])
        prev = f
    print("greedy CTC phones:", " ".join(greedy))

    sep("6. forced alignment")
    targets = torch.tensor([ids], dtype=torch.int32, device=device)
    target_lengths = torch.tensor([len(ids)], dtype=torch.int32, device=device)
    input_lengths = enc_lens.to(torch.int32)
    align_path, align_scores, spans = None, None, None
    if hasattr(model, "forced_align"):
        try:
            print("trying model.forced_align(...)")
            out = model.forced_align(speech, speech_lengths, text=targets,
                                     text_lengths=target_lengths)
            print("model.forced_align returned:", type(out))
            align_path, align_scores = out[0], out[1]
        except Exception as e:
            print("model.forced_align FAILED:", repr(e))
    if align_path is None:
        print("falling back to torchaudio.functional.forced_align on ctc log_probs")
        align_path, align_scores = AF.forced_align(
            log_probs.float(), targets, input_lengths, target_lengths,
            blank=blank_id,
        )
        print("forced_align ok | path shape:", tuple(align_path.shape))

    spans = AF.merge_tokens(align_path[0], align_scores[0].exp())
    sep("7. phone timings")
    if frame_sec is None:
        print("frame_sec unknown; reporting frame indices only")
    rows = []
    for s in spans:
        if s.token == blank_id:
            continue
        tok = token_list[s.token]
        if frame_sec:
            t0, t1 = s.start * frame_sec, s.end * frame_sec
            rows.append((tok, round(t0, 3), round(t1, 3), round(float(s.score), 3)))
        else:
            rows.append((tok, s.start, s.end, round(float(s.score), 3)))
    for r in rows:
        print(r)
    if frame_sec and rows:
        print(f"\nlast phone ends at {rows[-1][2]:.2f}s vs clip {dur:.2f}s")
    print(f"\naligned {len(rows)} phones to {len(ids)} target tokens")
    print("\nPROBE OK")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        import traceback
        traceback.print_exc()
        sys.exit(1)
