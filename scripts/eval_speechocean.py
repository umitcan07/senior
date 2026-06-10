#!/usr/bin/env python3
"""
External validation on speechocean762 (E6.7 / #96).

speechocean762 (OpenSLR SLR101) is the standard open pronunciation-assessment
benchmark: ~5000 English utts from Mandarin-L1 speakers, with expert HUMAN scores
at phoneme level (accuracy 0/1/2), word, and sentence level. We use it to validate
that our POWSM-CTC GOP tracks human judgement: per canonical phone, correlate our
GOP against the human accuracy score (Spearman rho). Higher GOP should mean higher
human accuracy.

This is GENERAL pronunciation-scoring validation (Mandarin L1), not Turkish-
specific error detection — it complements, not replaces, the Turkish study.

----------------------------------------------------------------------------
HOW
----------------------------------------------------------------------------
For each utterance:
  1. Build the canonical IPA target from the per-word ARPAbet phones via
     arpa2powsm.arpa_to_powsm (one ARPAbet phone -> >=1 IPA phones).
  2. forced_alignment(audio, canonical_ipa) -> one PhoneSegment per IPA token.
  3. compute_gop(logprobs, segments, ...) -> GOP per IPA token.
  4. Aggregate the IPA-token GOPs back to each ARPAbet phone (mean), pair with the
     human phones-accuracy for that phone.
Then Spearman rho over all (gop, accuracy) pairs (phone level) and over
(mean-utt-gop, sentence total) pairs (sentence level).

----------------------------------------------------------------------------
USAGE (on the GPU pod)
----------------------------------------------------------------------------
    # adapter chosen via POWSM_ADAPTER_DIR env or --adapter-dir; default = base
    POWSM_ADAPTER_DIR=/workspace/exp/l2a_ppl/best \
    python scripts/eval_speechocean.py \
        --speechocean-root /path/to/speechocean762 --out artifacts/speechocean

Smoke: --limit 50 --skip-figs
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "mod"))
sys.path.insert(0, str(REPO / "scripts"))

from arpa2powsm import arpa_to_powsm  # noqa: E402

# ---------------------------------------------------------------------------
# Stats (no scipy dependency)
# ---------------------------------------------------------------------------


def _rankdata(a):
    """Average ranks (1-based), ties averaged — like scipy.stats.rankdata."""
    import numpy as np

    a = np.asarray(a, dtype=float)
    order = a.argsort()
    ranks = np.empty(len(a), dtype=float)
    sa = a[order]
    i = 0
    while i < len(a):
        j = i
        while j + 1 < len(a) and sa[j + 1] == sa[i]:
            j += 1
        avg = (i + j) / 2.0 + 1.0  # 1-based average rank
        ranks[order[i : j + 1]] = avg
        i = j + 1
    return ranks


def spearman(x, y):
    import numpy as np

    if len(x) < 3:
        return None
    rx, ry = _rankdata(x), _rankdata(y)
    if np.std(rx) == 0 or np.std(ry) == 0:
        return None
    return float(np.corrcoef(rx, ry)[0, 1])


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def load_wav_scp(path: Path) -> dict[str, str]:
    out = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        utt, rest = line.split(None, 1)
        rest = rest.strip()
        if rest.endswith("|"):
            continue  # piped/command wav.scp not supported in this MVP
        out[utt] = rest
    return out


def load_scores(path: Path) -> dict:
    """speechocean762 scores keyed by utt-id. Per utt: sentence scores + a list of
    words, each with `phones` (ARPAbet), `phones-accuracy` (0/1/2)."""
    return json.loads(path.read_text(encoding="utf-8"))


# ---------------------------------------------------------------------------
# Per-utterance scoring
# ---------------------------------------------------------------------------


def score_utt(aligner, gop_scoring, audio, words):
    """Return list of (arpa_phone, human_accuracy, gop) for one utterance, plus
    the mean GOP. words: list of {phones:[ARPA], phones-accuracy:[0-2]}."""
    # Build canonical IPA + remember how many IPA tokens each (word,phone) spans.
    canonical_ipa: list[str] = []
    groups: list[tuple[str, float, int]] = []  # (arpa, accuracy, n_ipa_tokens)
    for w in words:
        phones = w.get("phones") or []
        acc = w.get("phones-accuracy") or []
        for i, ph in enumerate(phones):
            arpa = str(ph).strip()
            if not arpa or arpa in ("sil", "SIL", "sp", "SP", "<unk>"):
                continue
            ipa = arpa_to_powsm(arpa)
            if not ipa:
                continue  # OOV ARPAbet — skip this phone
            a = float(acc[i]) if i < len(acc) and acc[i] is not None else None
            if a is None:
                continue
            canonical_ipa.extend(ipa)
            groups.append((arpa, a, len(ipa)))

    if len(canonical_ipa) < 3 or not groups:
        return [], None

    enc, segs = aligner.encode_and_forced_alignment(audio, canonical_ipa)
    if len(segs) != len(canonical_ipa):
        # alignment/target length mismatch (e.g. affricate handling) — skip to stay honest
        return [], None
    gops = gop_scoring.compute_gop(
        enc.logprobs, segs, enc.vocab, enc.blank_id, enc.frame_stride_ms
    )

    import numpy as np

    rows = []
    pos = 0
    all_gops = []
    for arpa, acc, n in groups:
        seg_gops = [gops[pos + k].gop_score for k in range(n)]
        pos += n
        vals = [g for g in seg_gops if g is not None]
        if not vals:
            continue
        phone_gop = float(np.mean(vals))
        rows.append((arpa, acc, phone_gop))
        all_gops.append(phone_gop)
    mean_gop = float(np.mean(all_gops)) if all_gops else None
    return rows, mean_gop


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--speechocean-root", required=True)
    ap.add_argument("--scores", default=None, help="default <root>/resource/scores.json")
    ap.add_argument("--wav-scp", default=None, help="default <root>/test/wav.scp")
    ap.add_argument("--adapter-dir", default=None,
                    help="POWSM adapter dir; default = POWSM_ADAPTER_DIR env or base")
    ap.add_argument("--device", default=None)
    ap.add_argument("--out", default="artifacts/speechocean")
    ap.add_argument("--limit", type=int, default=0, help="0 = all utts")
    ap.add_argument("--skip-figs", action="store_true")
    args = ap.parse_args()

    root = Path(args.speechocean_root)
    scores_path = Path(args.scores) if args.scores else root / "resource" / "scores.json"
    wav_scp_path = Path(args.wav_scp) if args.wav_scp else root / "test" / "wav.scp"
    out = (REPO / args.out) if not os.path.isabs(args.out) else Path(args.out)
    out.mkdir(parents=True, exist_ok=True)

    device = args.device
    if device is None:
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"

    import librosa
    import alignment
    import gop_scoring

    adapter = args.adapter_dir if args.adapter_dir is not None else os.environ.get("POWSM_ADAPTER_DIR", "")
    aligner = alignment.POWSMAligner(adapter_dir=adapter, device=device)
    print(f"[setup] device={device} adapter={adapter or 'base'}")

    scores = load_scores(scores_path)
    wavs = load_wav_scp(wav_scp_path)
    utt_ids = [u for u in scores if u in wavs]
    if args.limit:
        utt_ids = utt_ids[: args.limit]
    print(f"[data] {len(utt_ids)} utts (scores∩wav.scp); scores={len(scores)} wav={len(wavs)}")

    phone_rows = []          # (utt, arpa, accuracy, gop)
    sent_pairs = []          # (mean_gop, sentence_total)
    done = skipped = 0
    for utt in utt_ids:
        wav_path = wavs[utt]
        if not os.path.isabs(wav_path):
            wav_path = str((root / wav_path).resolve())
        if not os.path.exists(wav_path):
            skipped += 1
            continue
        try:
            audio, _ = librosa.load(wav_path, sr=alignment.TARGET_SR, mono=True)
            rows, mean_gop = score_utt(aligner, gop_scoring, audio, scores[utt].get("words", []))
        except (OSError, ValueError, RuntimeError) as exc:
            # expected per-utt failures (bad/missing audio, OOV target tokens) → skip.
            # Anything else (real bug in score_utt/gop/aligner) propagates loudly.
            print(f"  [skip] {utt}: {type(exc).__name__}: {exc}")
            skipped += 1
            continue
        if not rows:
            skipped += 1
            continue
        for arpa, acc, gop in rows:
            phone_rows.append({"utt": utt, "arpa": arpa, "accuracy": acc, "gop": gop})
        total = scores[utt].get("total")
        if mean_gop is not None and total is not None:
            sent_pairs.append((mean_gop, float(total)))
        done += 1
        if done % 200 == 0:
            print(f"  ... {done} utts scored")

    accs = [r["accuracy"] for r in phone_rows]
    gops = [r["gop"] for r in phone_rows]
    rho_phone = spearman(gops, accs)
    rho_sent = spearman([p[0] for p in sent_pairs], [p[1] for p in sent_pairs]) if sent_pairs else None

    # per-accuracy-bucket mean GOP (0/1/2) — sanity that GOP increases with accuracy
    import numpy as np
    buckets = {}
    for r in phone_rows:
        buckets.setdefault(round(r["accuracy"]), []).append(r["gop"])
    bucket_means = {k: round(float(np.mean(v)), 4) for k, v in sorted(buckets.items())}

    summary = {
        "adapter": adapter or "base",
        "n_utts_scored": done,
        "n_utts_skipped": skipped,
        "n_phones": len(phone_rows),
        "spearman_rho_phone_gop_vs_accuracy": round(rho_phone, 4) if rho_phone is not None else None,
        "spearman_rho_sentence_meangop_vs_total": round(rho_sent, 4) if rho_sent is not None else None,
        "mean_gop_by_human_accuracy": bucket_means,
        "n_sentences": len(sent_pairs),
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")

    (out / "raw").mkdir(exist_ok=True)
    with (out / "raw" / "phone_scores.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["utt", "arpa", "accuracy", "gop"])
        w.writeheader()
        w.writerows(phone_rows)

    print(json.dumps(summary, indent=2))

    if not args.skip_figs and phone_rows:
        try:
            import matplotlib
            matplotlib.use("Agg")
            import matplotlib.pyplot as plt

            fig, ax = plt.subplots(figsize=(6, 4.5))
            data = [[r["gop"] for r in phone_rows if round(r["accuracy"]) == k]
                    for k in sorted(buckets)]
            ax.boxplot(data, labels=[str(k) for k in sorted(buckets)], showfliers=False)
            ax.set_xlabel("human phoneme accuracy (0/1/2)")
            ax.set_ylabel("POWSM GOP")
            title = f"speechocean762: GOP vs human accuracy (rho={summary['spearman_rho_phone_gop_vs_accuracy']})"
            ax.set_title(title)
            fig.tight_layout()
            (out / "figs").mkdir(exist_ok=True)
            fig.savefig(out / "figs" / "gop_vs_accuracy.png", dpi=140)
            plt.close(fig)
            print(f"[figs] wrote {out / 'figs' / 'gop_vs_accuracy.png'}")
        except Exception as e:
            print(f"[figs] skipped ({e})")

    print(f"[done] {out}")


if __name__ == "__main__":
    main()
