#!/usr/bin/env python3
"""
Comprehensive adapter evaluation harness (E5/E6).

Runs the eval matrix from doc/adapters.md §Validation over base POWSM + the 7
fine-tuned adapters, on the held-out Turkish-L1 set, and emits raw numbers
(JSON/CSV) plus figures. Designed to run on the RunPod GPU pod; copy the whole
output directory back to the laptop afterwards.

----------------------------------------------------------------------------
WHAT IT MEASURES (all three are the promotion-gate / thesis metrics)
----------------------------------------------------------------------------
1. PER  -- phone error rate of the model's *free* recognition against the
   PRODUCED (perceived) Turkish annotation. This is the headline number and the
   gate metric. Ground truth = what the speaker actually said (the annotation in
   data/test_recordings/4-speakers-13-sentences.txt, via prep_tr_speakers.py).

2. Substitution recall -- on the ~15 Turkish-L1 error pairs (theta->t/s, dh->d/z,
   w->v, r->tap, ng->n, ae/eh/uh->a). 3-way alignment of
   canonical (native reference, from data/precompute) -> produced (annotation)
   -> hypothesis (model). Of the substitution events the annotator marked, how
   many does the model transcribe as the *produced* phone (caught the deviation)
   vs normalize back to the *canonical* phone (missed it)?  This is the
   clinically relevant signal and the core of the cpl-vs-ppl thesis.

3. Native FPR / drift -- on the 100 native reference clips (data/references),
   model output vs the committed *.expected.json goldens. A deployable adapter
   must not transcribe correct native speech differently from base (each change
   would surface as a false "error" to a user). base == 0 by construction; the
   metric is how far each adapter drifts.

Bonus: schwa-collapse rate (cpl's expected symptom -- normalizing full vowels to
schwa) and per-phone error rates + substitution confusion matrices.

----------------------------------------------------------------------------
PHONE FOLDING (important, read before trusting any number)
----------------------------------------------------------------------------
Training targets were built by prep_tr_speakers.normalize_ipa(), which strips
aspiration (k^h->k), drops nasalization / tie-bars (a~->a, d_tie_z->d+z), and
maps r->turn-r, g->IPA-g. We fold BOTH the model hypothesis AND every reference
through the SAME function before scoring, so PER reflects phone-identity errors,
not aspiration/diacritic/affricate-ligature differences. This also neutralizes
the #85 affricate-ligature bug for eval purposes (it is still a real bug for the
live app diff).

----------------------------------------------------------------------------
USAGE (on the pod, repo at /workspace)
----------------------------------------------------------------------------
    # extract adapters first (or pass --tgz to let this script do it):
    tar xzf adapters/adapters_best.tgz -C artifacts/release

    python scripts/eval_adapters.py \
        --adapters-root artifacts/release \
        --out artifacts/eval

    # then from the laptop:  scp -r pod:/workspace/artifacts/eval ./

Subset / smoke run:  --models base,l2a_cpl,l2a_ppl   --skip-figs
"""

from __future__ import annotations

import argparse
import csv
import gc
import json
import os
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / "mod"))
sys.path.insert(0, str(REPO / "scripts"))

# Folding convention is the single source of truth shared with training.
from prep_tr_speakers import normalize_ipa  # noqa: E402

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Non-phone tokens emitted by POWSM that must never count as a phone.
_SKIP = {"", "▁", "<blank>", "<sos/eos>", "<sos>", "<eos>", "<unk>", "<na>", "<pr>"}

# Turkish-L1 substitution pairs: canonical phone -> set of plausible produced
# realizations (post-folding). See doc/adapters.md and doc/turkish_l1_phone_inventory.md.
# Folding maps ASCII r->ɹ and g->ɡ, so 'r' never survives as a produced token;
# the Turkish tap is ɾ.
TR_ERROR_PAIRS: dict[str, set[str]] = {
    "θ": {"t", "s"},
    "ð": {"d", "z"},
    "w": {"v"},
    "ɹ": {"ɾ"},
    "ŋ": {"n"},
    "æ": {"a", "ɑ"},
    "ɛ": {"a", "ɑ"},
    "ʌ": {"a", "ɑ"},
}

VOWELS = {
    "i", "ɪ", "e", "ɛ", "æ", "a", "ɑ", "ɒ", "ʌ", "ə", "ɜ", "ɝ", "ɚ",
    "ɔ", "o", "ʊ", "u", "ɯ", "y", "ø", "œ", "ɐ", "ɵ", "ʉ", "ɨ",
}
SCHWA = {"ə", "ʌ"}

# Adapter registry. eval_set: 'all' = all 4 TR speakers; 'loso_foldK' = only that
# fold's held-out speaker (the other 3 were in its training set).
MODELS = [
    ("base", None, "all"),
    ("l2a_cpl", "l2a_cpl/best", "all"),
    ("l2a_ppl", "l2a_ppl/best", "all"),
    ("l2a_ppl_dora", "l2a_ppl_dora/best", "all"),
    # 60-epoch re-train of the core cpl-vs-ppl ablation (the 30-epoch set was
    # under-trained; release adapters-2026-06-10-long). L2-ARCTIC-only.
    ("l2a_cpl_long", "l2a_cpl_long/best", "all"),
    ("l2a_ppl_long", "l2a_ppl_long/best", "all"),
    ("l2a_ppl_tr_fold1", "l2a_ppl_tr_fold1/best", "loso_fold1"),
    ("l2a_ppl_tr_fold2", "l2a_ppl_tr_fold2/best", "loso_fold2"),
    ("l2a_ppl_tr_fold3", "l2a_ppl_tr_fold3/best", "loso_fold3"),
    ("l2a_ppl_tr_fold4", "l2a_ppl_tr_fold4/best", "loso_fold4"),
    # Full-L2-ARCTIC perceived-label run (all 6 L1s, 25ep, lang_sym <unk>;
    # see sig/fine-tune/05_finetune_l2arctic). Scored here on OUR split/metrics
    # (folded PER, deviation recall, native FPR) for a same-axis comparison with
    # l2a_ppl / l2a_ppl_long. report-v3.tex §"Scaling ... to Full L2-ARCTIC".
    ("l2a_ppl_full", "l2a_ppl_full/best", "all"),
]

# ---------------------------------------------------------------------------
# Folding + alignment
# ---------------------------------------------------------------------------


def fold(tokens: list[str]) -> list[str]:
    """Fold a raw phone sequence to the training convention (drop aspiration,
    nasalization, tie-bars; r->ɹ, g->ɡ; split affricate ligatures). Skips
    non-phone tokens. normalize_ipa() is idempotent on already-folded input."""
    out: list[str] = []
    for t in tokens:
        if t in _SKIP or t.startswith("<"):
            continue
        for p in normalize_ipa(t):
            if p and p != "▁" and p not in _SKIP:
                out.append(p)
    return out


def align(hyp: list[str], ref: list[str]) -> list[tuple]:
    """Standard unit-cost Needleman-Wunsch alignment (S=D=I=1), returns the full
    path including matches. Each entry: (tag, h_idx|None, r_idx|None, h_tok|None,
    r_tok|None) with tag in {match, sub, ins, del}. 'ins' = extra phone in hyp;
    'del' = phone in ref the model dropped. PER = (sub+ins+del)/len(ref).

    Deterministic backtrace preference: match > sub > del > ins."""
    m, n = len(hyp), len(ref)
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if hyp[i - 1] == ref[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1])

    path: list[tuple] = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and hyp[i - 1] == ref[j - 1] and dp[i][j] == dp[i - 1][j - 1]:
            path.append(("match", i - 1, j - 1, hyp[i - 1], ref[j - 1]))
            i, j = i - 1, j - 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            path.append(("sub", i - 1, j - 1, hyp[i - 1], ref[j - 1]))
            i, j = i - 1, j - 1
        elif j > 0 and dp[i][j] == dp[i][j - 1] + 1:
            path.append(("del", None, j - 1, None, ref[j - 1]))
            j -= 1
        else:
            path.append(("ins", i - 1, None, hyp[i - 1], None))
            i -= 1
    path.reverse()
    return path


def per_from_path(path: list[tuple], ref_len: int) -> dict:
    sub = sum(1 for p in path if p[0] == "sub")
    dele = sum(1 for p in path if p[0] == "del")
    ins = sum(1 for p in path if p[0] == "ins")
    err = sub + dele + ins
    return {
        "ref_len": ref_len,
        "sub": sub,
        "del": dele,
        "ins": ins,
        "errors": err,
        "per": (err / ref_len) if ref_len else 0.0,
    }


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------


def read_manifest(mdir: Path) -> list[dict]:
    """Read a kaldi-style manifest dir (wav.scp + text). Returns utt dicts with
    folded reference phones. Speaker + sentence number parsed from utt_id
    TR_<spk>_s<NN>."""
    wav_scp, text = mdir / "wav.scp", mdir / "text"
    if not wav_scp.exists() or not text.exists():
        raise FileNotFoundError(f"manifest missing: {mdir}")
    wavs = {}
    for line in wav_scp.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        utt, path = line.split(None, 1)
        wavs[utt] = path.strip()
    utts = []
    for line in text.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        parts = line.split(None, 1)
        utt = parts[0]
        raw = parts[1] if len(parts) > 1 else ""
        ref_tokens = re.findall(r"/([^/]+)/", raw)
        m = re.match(r"TR_(\w+?)_s(\d+)", utt)
        spk = m.group(1) if m else "?"
        sent = int(m.group(2)) if m else -1
        utts.append({
            "utt_id": utt,
            "wav_path": str((REPO / wavs[utt]).resolve()) if utt in wavs else None,
            "ref": fold(ref_tokens),
            "speaker": spk,
            "group": spk,        # grouping axis for aggregation (speaker for TR)
            "sentence": sent,
        })
    return [u for u in utts if u["wav_path"] and os.path.exists(u["wav_path"])]


def ensure_tr_manifests(ft_dir: Path) -> None:
    if (ft_dir / "all" / "text").exists():
        return
    print("[setup] TR manifests missing -> running prep_tr_speakers.py")
    subprocess.run([sys.executable, str(REPO / "scripts" / "prep_tr_speakers.py")],
                   check=True, cwd=str(REPO))


def load_canonical(precompute: Path) -> dict[int, list[str]]:
    """sentence number -> folded canonical phones, from a native reference's
    precompute ipa_transcription. Prefer GenAm (the teaching target)."""
    priority = ["genam_katherine", "genam_jordan", "genam_teyanna", "rp_jon"]
    authors = [precompute / a for a in priority if (precompute / a).is_dir()]
    authors += [d for d in sorted(precompute.glob("*")) if d.is_dir() and d not in authors]
    canon: dict[int, list[str]] = {}
    for n in range(1, 26):
        for adir in authors:
            f = adir / f"ref_{n:03d}.json"
            if f.exists():
                d = json.loads(f.read_text(encoding="utf-8"))
                ipa = d.get("ipa_transcription", "")
                if ipa:
                    canon[n] = fold(ipa.split())
                    break
    return canon


def _read_simple_manifest(mdir: Path) -> dict[str, tuple[str, list[str]]]:
    """utt_id -> (abs_wav_path, folded_phones) for a generic kaldi manifest dir."""
    wav_scp, text = mdir / "wav.scp", mdir / "text"
    out: dict[str, tuple[str, list[str]]] = {}
    wavs = {}
    for line in wav_scp.read_text(encoding="utf-8").splitlines():
        if line.strip():
            utt, p = line.split(None, 1)
            wavs[utt] = p.strip()
    for line in text.read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        parts = line.split(None, 1)
        utt = parts[0]
        phones = fold(re.findall(r"/([^/]+)/", parts[1] if len(parts) > 1 else ""))
        wp = str((REPO / wavs[utt]).resolve()) if utt in wavs else None
        out[utt] = (wp, phones)
    return out


def ensure_l2arctic_manifests(ft_dir: Path, l2arctic_root: str | None) -> bool:
    """True if l2a_ppl/dev + l2a_cpl/dev manifests are available."""
    have = (ft_dir / "l2a_ppl" / "dev" / "text").exists() and \
           (ft_dir / "l2a_cpl" / "dev" / "text").exists()
    if have:
        return True
    if not l2arctic_root or not os.path.isdir(l2arctic_root):
        print(f"[l2a] manifests missing and --l2arctic root not given/found; skipping L2-ARCTIC arm")
        return False
    print(f"[l2a] manifests missing -> running prep_l2arctic.py on {l2arctic_root}")
    subprocess.run([sys.executable, str(REPO / "scripts" / "prep_l2arctic.py"),
                    "--l2arctic", l2arctic_root, "--out", str(ft_dir)], check=True, cwd=str(REPO))
    return (ft_dir / "l2a_ppl" / "dev" / "text").exists()


def load_l2arctic_set(ft_dir: Path, split: str = "dev") -> list[dict]:
    """Held-out L2-ARCTIC utterances with BOTH perceived (ref) and canonical
    (canon) targets joined by utt_id, grouped by L1. cpl/ppl/dora trained on
    'train'; 'dev' is their early-stopping hold-out (note in the report)."""
    from prep_l2arctic import L1_MAP
    ppl = _read_simple_manifest(ft_dir / "l2a_ppl" / split)
    cpl = _read_simple_manifest(ft_dir / "l2a_cpl" / split)
    utts = []
    for utt, (wp, ppl_phones) in ppl.items():
        if not wp or not os.path.exists(wp):
            continue
        spk = utt.split("_", 1)[0]
        cpl_phones = cpl.get(utt, (None, []))[1]
        utts.append({
            "utt_id": utt,
            "wav_path": wp,
            "ref": ppl_phones,                  # perceived/produced = PER ground truth
            "canon": cpl_phones or None,        # canonical = annotated dictionary phones
            "speaker": spk,
            "group": L1_MAP.get(spk, spk),      # aggregate by L1
        })
    return utts


def load_native_set(references: Path) -> list[dict]:
    """Native reference clips with committed goldens, for FPR/drift."""
    out = []
    for wav in sorted(references.glob("*/ref_*.wav")):
        gold = wav.with_suffix(".expected.json")
        if not gold.exists():
            continue
        phones = json.loads(gold.read_text(encoding="utf-8")).get("phones", [])
        out.append({
            "utt_id": f"{wav.parent.name}/{wav.stem}",
            "wav_path": str(wav.resolve()),
            "ref": fold(phones),
            "author": wav.parent.name,
        })
    return out


# ---------------------------------------------------------------------------
# Model inference
# ---------------------------------------------------------------------------


def make_aligner(adapter_dir: str | None, device: str):
    import alignment  # mod/alignment.py
    # Pass "" to force base (overrides any POWSM_ADAPTER_DIR in the env).
    return alignment.POWSMAligner(adapter_dir=(adapter_dir or ""), device=device)


def free_phones(aligner, wav_path: str) -> list[str]:
    import librosa
    import alignment
    audio, _ = librosa.load(wav_path, sr=alignment.TARGET_SR, mono=True)
    segs = aligner.free_alignment(audio)
    return fold([s.token for s in segs])


def free_device():
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except Exception:
        pass
    gc.collect()


# ---------------------------------------------------------------------------
# Per-model evaluation
# ---------------------------------------------------------------------------


def eval_model_on_set(aligner, utts: list[dict], pair_filter: dict | None = None):
    """Evaluate one model on one set of utterances. Each utt has 'ref' (produced
    phones = PER ground truth) and optionally 'canon' (canonical phones, for the
    3-way substitution recall) and 'group' (aggregation axis).

    pair_filter: dict canonical->{produced} to restrict recall to specific error
    pairs (the Turkish set). Pass None to count EVERY annotated canonical->produced
    substitution (the cross-L1 'deviation recall' used for the L2-ARCTIC arm).

    Returns (per_utt_rows, confusion, per_phone, recall {canon:[tp,total]},
    schwa [collapse, vowel_total]). Rows carry 'per' (vs produced) and, when a
    canonical is present, 'per_canon' (vs canonical) for the dual-PER thesis view."""
    rows = []
    confusion: Counter = Counter()
    per_phone: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    recall: dict[str, list[int]] = defaultdict(lambda: [0, 0])  # canon -> [tp, total]
    schwa = [0, 0]  # [collapse, produced-vowel-total]

    for u in utts:
        hyp = free_phones(aligner, u["wav_path"])
        ref = u["ref"]  # produced (perceived) — the PER ground truth
        canon_seq = u.get("canon")
        path = align(hyp, ref)
        stats = per_from_path(path, len(ref))
        row = {"utt_id": u["utt_id"], "group": u.get("group", "?"),
               "speaker": u.get("speaker", u.get("group", "?")),
               "hyp_len": len(hyp), **stats,
               "hyp": " ".join(hyp), "ref": " ".join(ref)}
        if canon_seq:
            cstats = per_from_path(align(hyp, canon_seq), len(canon_seq))
            row["per_canon"] = cstats["per"]
            row["errors_canon"] = cstats["errors"]
            row["canon_len"] = cstats["ref_len"]
        rows.append(row)

        # per-phone error rate + confusion (ref=produced is the truth)
        for tag, _hi, _ri, htok, rtok in path:
            if tag in ("match", "sub", "del"):
                per_phone[rtok][1] += 1
                if tag != "match":
                    per_phone[rtok][0] += 1
                if tag == "sub":
                    confusion[(rtok, htok)] += 1
                    if htok in SCHWA and rtok in VOWELS and rtok not in SCHWA:
                        schwa[0] += 1
            if tag in ("match", "sub", "del") and rtok in VOWELS:
                schwa[1] += 1

        # substitution recall: canonical -> produced -> hyp (3-way)
        if canon_seq:
            # 1) annotated substitution events from canonical->produced
            cp = align(ref, canon_seq)  # hyp=produced, ref=canonical
            events = []  # (p_idx, canon_phone, produced_phone)
            for tag, p_idx, _ci, p_tok, c_tok in cp:
                if tag != "sub":
                    continue
                if pair_filter is None or (c_tok in pair_filter and p_tok in pair_filter[c_tok]):
                    events.append((p_idx, c_tok, p_tok))
            # 2) map produced index -> hyp phone
            ph = align(hyp, ref)  # hyp=hyp, ref=produced
            p2h: dict[int, str | None] = {}
            for tag, _hi, p_idx, h_tok, _pt in ph:
                if p_idx is not None:
                    p2h[p_idx] = h_tok if tag in ("match", "sub") else None
            for p_idx, c_tok, p_tok in events:
                recall[c_tok][1] += 1
                if p2h.get(p_idx) == p_tok:
                    recall[c_tok][0] += 1

    return rows, confusion, per_phone, recall, schwa


def eval_model_on_native(aligner, native: list[dict]):
    rows = []
    tot_err = tot_ref = 0
    for u in native:
        hyp = free_phones(aligner, u["wav_path"])
        path = align(hyp, u["ref"])
        st = per_from_path(path, len(u["ref"]))
        rows.append({"utt_id": u["utt_id"], "author": u["author"], **st})
        tot_err += st["errors"]
        tot_ref += st["ref_len"]
    micro = (tot_err / tot_ref) if tot_ref else 0.0
    return rows, micro


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


def micro_per(rows: list[dict]) -> float:
    e = sum(r["errors"] for r in rows)
    n = sum(r["ref_len"] for r in rows)
    return (e / n) if n else 0.0


def group_per(rows: list[dict]) -> dict[str, float]:
    by: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        by[r["group"]].append(r)
    return {s: round(micro_per(rs), 4) for s, rs in sorted(by.items())}


def micro_per_canon(rows: list[dict]) -> float | None:
    e = sum(r["errors_canon"] for r in rows if "errors_canon" in r)
    n = sum(r["canon_len"] for r in rows if "canon_len" in r)
    return round(e / n, 4) if n else None


def recall_summary(recall: dict[str, list[int]]) -> dict:
    per_pair = {c: {"tp": tp, "total": tot, "recall": round(tp / tot, 4) if tot else None}
                for c, (tp, tot) in sorted(recall.items())}
    tp = sum(v[0] for v in recall.values())
    tot = sum(v[1] for v in recall.values())
    return {"overall": round(tp / tot, 4) if tot else None,
            "tp": tp, "total": tot, "per_pair": per_pair}


# ---------------------------------------------------------------------------
# Output: CSV / JSON / figures / report
# ---------------------------------------------------------------------------


def write_csv(path: Path, rows: list[dict], fields: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k) for k in fields})


def save_figures(summary: dict, out: Path) -> None:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        import numpy as np
    except Exception as e:  # pragma: no cover
        print(f"[figs] matplotlib unavailable ({e}); skipping figures (raw data still written)")
        return

    figs = out / "figs"
    figs.mkdir(parents=True, exist_ok=True)
    models = [m for m in summary["models"]]
    names = [m["model"] for m in models]

    def bar(values, title, ylabel, fname, fmt="{:.3f}"):
        vals = [v if v is not None else 0 for v in values]
        fig, ax = plt.subplots(figsize=(max(6, len(names) * 1.1), 4.2))
        bars = ax.bar(names, vals, color="#3b6ea5")
        ax.set_title(title)
        ax.set_ylabel(ylabel)
        ax.set_xticklabels(names, rotation=30, ha="right")
        for b, v in zip(bars, values):
            if v is not None:
                ax.text(b.get_x() + b.get_width() / 2, b.get_height(),
                        fmt.format(v), ha="center", va="bottom", fontsize=8)
        fig.tight_layout()
        fig.savefig(figs / fname, dpi=140)
        plt.close(fig)

    bar([m["tr_per_micro"] for m in models], "Turkish held-out PER (lower=better)",
        "PER", "per_by_model.png")
    bar([m["sub_recall"]["overall"] for m in models],
        "Substitution recall on TR error pairs (higher=better)", "recall",
        "sub_recall_by_model.png")
    bar([m["native_fpr_micro"] for m in models],
        "Native drift / FPR (lower=better; base=0 by construction)", "token error rate",
        "native_fpr_by_model.png")
    bar([m["schwa_collapse_rate"] for m in models],
        "Schwa-collapse rate (cpl symptom)", "rate", "schwa_collapse_by_model.png")

    # per-speaker grouped bars
    speakers = sorted({s for m in models for s in m["tr_per_by_speaker"]})
    if speakers:
        x = np.arange(len(names))
        w = 0.8 / max(1, len(speakers))
        fig, ax = plt.subplots(figsize=(max(7, len(names) * 1.3), 4.5))
        for i, sp in enumerate(speakers):
            vals = [m["tr_per_by_speaker"].get(sp, 0) for m in models]
            ax.bar(x + i * w, vals, w, label=sp)
        ax.set_xticks(x + 0.4 - w / 2)
        ax.set_xticklabels(names, rotation=30, ha="right")
        ax.set_ylabel("PER")
        ax.set_title("Per-speaker PER by model")
        ax.legend(fontsize=8)
        fig.tight_layout()
        fig.savefig(figs / "per_by_speaker.png", dpi=140)
        plt.close(fig)

    # substitution recall heatmap (model x canonical phone)
    pairs = sorted(TR_ERROR_PAIRS.keys())
    mat = np.array([[ (m["sub_recall"]["per_pair"].get(p, {}) or {}).get("recall") or 0
                      for p in pairs] for m in models])
    fig, ax = plt.subplots(figsize=(max(6, len(pairs) * 0.9), max(4, len(names) * 0.5)))
    im = ax.imshow(mat, cmap="YlGn", vmin=0, vmax=1, aspect="auto")
    ax.set_xticks(range(len(pairs)))
    ax.set_xticklabels(pairs)
    ax.set_yticks(range(len(names)))
    ax.set_yticklabels(names)
    ax.set_title("Substitution recall by canonical phone")
    for i in range(len(names)):
        for j in range(len(pairs)):
            ax.text(j, i, f"{mat[i, j]:.2f}", ha="center", va="center", fontsize=7)
    fig.colorbar(im, ax=ax, fraction=0.046)
    fig.tight_layout()
    fig.savefig(figs / "sub_recall_heatmap.png", dpi=140)
    plt.close(fig)

    # headline cpl vs ppl (PER + recall side by side)
    core = [m for m in models if m["model"] in
            ("base", "l2a_cpl", "l2a_ppl", "l2a_ppl_dora")]
    if core:
        cn = [m["model"] for m in core]
        x = np.arange(len(cn))
        fig, ax = plt.subplots(figsize=(7, 4.5))
        ax.bar(x - 0.2, [m["tr_per_micro"] for m in core], 0.4, label="PER", color="#c0504d")
        ax.bar(x + 0.2, [m["sub_recall"]["overall"] or 0 for m in core], 0.4,
               label="sub recall", color="#4f81bd")
        ax.set_xticks(x)
        ax.set_xticklabels(cn, rotation=20, ha="right")
        ax.set_title("Headline: canonical (cpl) vs perceived (ppl) supervision")
        ax.legend()
        fig.tight_layout()
        fig.savefig(figs / "cpl_vs_ppl.png", dpi=140)
        plt.close(fig)

    # L2-ARCTIC arm: dual-PER (vs canonical / vs perceived) + deviation recall.
    # The thesis in one picture: cpl-trained model is low PER-vs-CPL but high
    # PER-vs-PPL (normalizes, misses what was produced); ppl is the opposite.
    l2a = summary.get("l2arctic")
    if l2a:
        ln = [m["model"] for m in l2a]
        x = np.arange(len(ln))
        fig, ax = plt.subplots(figsize=(max(7, len(ln) * 1.4), 4.6))
        ax.bar(x - 0.27, [m["per_vs_cpl"] or 0 for m in l2a], 0.27,
               label="PER vs canonical (CPL)", color="#9e9e9e")
        ax.bar(x, [m["per_vs_ppl"] for m in l2a], 0.27,
               label="PER vs perceived (PPL)", color="#c0504d")
        ax.bar(x + 0.27, [m["deviation_recall"] or 0 for m in l2a], 0.27,
               label="deviation recall", color="#4f81bd")
        ax.set_xticks(x)
        ax.set_xticklabels(ln, rotation=20, ha="right")
        ax.set_title("L2-ARCTIC (held-out): canonical vs perceived supervision")
        ax.legend(fontsize=8)
        fig.tight_layout()
        fig.savefig(figs / "l2arctic_cpl_vs_ppl.png", dpi=140)
        plt.close(fig)

        # per-L1 PER (vs perceived) grouped bars
        l1s = sorted({g for m in l2a for g in m["per_by_l1"]})
        if l1s:
            w = 0.8 / max(1, len(l1s))
            fig, ax = plt.subplots(figsize=(max(7, len(ln) * 1.4), 4.6))
            for i, l1 in enumerate(l1s):
                ax.bar(x + i * w, [m["per_by_l1"].get(l1, 0) for m in l2a], w, label=l1)
            ax.set_xticks(x + 0.4 - w / 2)
            ax.set_xticklabels(ln, rotation=20, ha="right")
            ax.set_ylabel("PER vs perceived")
            ax.set_title("L2-ARCTIC PER by L1 group")
            ax.legend(fontsize=8)
            fig.tight_layout()
            fig.savefig(figs / "l2arctic_per_by_l1.png", dpi=140)
            plt.close(fig)
    print(f"[figs] wrote figures to {figs}")


def write_report(summary: dict, out: Path) -> None:
    lines = ["# Adapter eval results", "",
             f"git: `{summary['git_sha']}`  ·  device: {summary['device']}  ·  "
             f"TR utts: {summary['n_tr_utts']}  ·  native clips: {summary['n_native']}  ·  "
             f"L2-ARCTIC dev: {summary.get('n_l2arctic', 0)}",
             "",
             "## Eval matrix (doc/adapters.md §Report)", "",
             "| Model | TR-PER | Sub-recall | Native FPR/drift | Schwa-collapse |",
             "|---|---|---|---|---|"]
    for m in summary["models"]:
        sr = m["sub_recall"]["overall"]
        lines.append(f"| {m['model']} | {m['tr_per_micro']:.4f} | "
                     f"{sr:.4f} | {m['native_fpr_micro']:.4f} | "
                     f"{m['schwa_collapse_rate']:.4f} |"
                     if sr is not None else
                     f"| {m['model']} | {m['tr_per_micro']:.4f} | n/a | "
                     f"{m['native_fpr_micro']:.4f} | {m['schwa_collapse_rate']:.4f} |")
    if "loso" in summary:
        lo = summary["loso"]
        lines += ["", "## LOSO (l2a_ppl_tr) — each fold scored only on its held-out speaker",
                  "",
                  f"- PER: mean {lo['per_mean']:.4f}  (range {lo['per_min']:.4f}–{lo['per_max']:.4f})",
                  f"- Sub-recall: mean {lo['recall_mean']:.4f}" if lo['recall_mean'] is not None else "",
                  "", "| fold | speaker | PER | sub-recall |", "|---|---|---|---|"]
        for f in lo["folds"]:
            rc = f"{f['recall']:.4f}" if f["recall"] is not None else "n/a"
            lines.append(f"| {f['model']} | {f['speaker']} | {f['per']:.4f} | {rc} |")
    if summary.get("l2arctic"):
        lines += ["", "## L2-ARCTIC cpl-vs-ppl (side proof, held-out dev split)", "",
                  "Annotated canonical (CPL) **and** perceived (PPL) targets on identical audio. "
                  "PER vs PPL = how much of what was actually produced the model transcribes; "
                  "PER vs CPL = how close it stays to the dictionary. The thesis: cpl-supervision "
                  "drives PER-vs-PPL up (normalizes away deviations) while keeping PER-vs-CPL low; "
                  "ppl-supervision does the opposite. Deviation recall counts every annotated "
                  "canonical→produced substitution the model reproduces.", "",
                  "| Model | PER vs PPL | PER vs CPL | Deviation recall | Schwa-collapse |",
                  "|---|---|---|---|---|"]
        for m in summary["l2arctic"]:
            pc = f"{m['per_vs_cpl']:.4f}" if m["per_vs_cpl"] is not None else "n/a"
            dr = f"{m['deviation_recall']:.4f}" if m["deviation_recall"] is not None else "n/a"
            lines.append(f"| {m['model']} | {m['per_vs_ppl']:.4f} | {pc} | {dr} | "
                         f"{m['schwa_collapse_rate']:.4f} |")
        lines += ["", "_Dev split = the cpl/ppl/dora early-stopping hold-out (4 speakers, ~4 L1 "
                  "groups); unseen by gradient training. Deviation recall here counts ALL annotated "
                  "substitutions, not only the Turkish pairs._"]
    lines += ["", "## Promotion gate",
              "Ship the best adapter iff it beats base on TR-PER **and** substitution recall, "
              "without raising native FPR. Else base ships.", "",
              "_Folding note: PER is computed on the training fold (aspiration/nasalization/"
              "tie-bars removed via prep_tr_speakers.normalize_ipa); this also neutralizes the "
              "#85 affricate-ligature issue for eval. Substitution-recall canonical is a "
              "GenAm native-reference proxy (data/precompute), not an independent G2P._"]
    (out / "eval_report.md").write_text("\n".join(l for l in lines if l is not None) + "\n",
                                        encoding="utf-8")
    print(f"[report] wrote {out / 'eval_report.md'}")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def git_sha() -> str:
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"],
                                       cwd=str(REPO)).decode().strip()
    except Exception:
        return "unknown"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--adapters-root", default="artifacts/release",
                    help="dir containing l2a_*/best/ adapter folders")
    ap.add_argument("--tgz", default=None,
                    help="optional adapters_best.tgz to extract into --adapters-root first")
    ap.add_argument("--tr-manifests", default="data/finetune/tr_speakers")
    ap.add_argument("--finetune", default="data/finetune",
                    help="root holding l2a_cpl/ and l2a_ppl/ manifests")
    ap.add_argument("--l2arctic", default="l2arctic_release_v5.0",
                    help="L2-ARCTIC corpus root (to (re)build l2a manifests if missing)")
    ap.add_argument("--references", default="data/references")
    ap.add_argument("--precompute", default="data/precompute")
    ap.add_argument("--out", default="artifacts/eval")
    ap.add_argument("--device", default=None, help="cuda|cpu (default: auto)")
    ap.add_argument("--models", default=None,
                    help="comma list to restrict (e.g. base,l2a_cpl,l2a_ppl)")
    ap.add_argument("--skip-native", action="store_true", help="skip native FPR pass")
    ap.add_argument("--skip-l2arctic", action="store_true", help="skip the L2-ARCTIC cpl-vs-ppl arm")
    ap.add_argument("--skip-figs", action="store_true")
    args = ap.parse_args()

    out = (REPO / args.out) if not os.path.isabs(args.out) else Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    adapters_root = (REPO / args.adapters_root) if not os.path.isabs(args.adapters_root) \
        else Path(args.adapters_root)

    if args.tgz:
        adapters_root.mkdir(parents=True, exist_ok=True)
        print(f"[setup] extracting {args.tgz} -> {adapters_root}")
        subprocess.run(["tar", "xzf", args.tgz, "-C", str(adapters_root)], check=True)

    device = args.device
    if device is None:
        try:
            import torch
            device = "cuda" if torch.cuda.is_available() else "cpu"
        except Exception:
            device = "cpu"
    print(f"[setup] device={device}")

    ft = (REPO / args.tr_manifests)
    ensure_tr_manifests(ft)
    all_utts = read_manifest(ft / "all")
    fold_utts = {f"loso_fold{k}": read_manifest(ft / f"loso_fold{k}_eval")
                 for k in range(1, 5) if (ft / f"loso_fold{k}_eval" / "text").exists()}
    canon = load_canonical(REPO / args.precompute)
    # attach canonical (sentence-keyed, native-reference proxy) to every TR utt
    for u in all_utts:
        u["canon"] = canon.get(u["sentence"])
    for utts in fold_utts.values():
        for u in utts:
            u["canon"] = canon.get(u["sentence"])
    native = [] if args.skip_native else load_native_set(REPO / args.references)

    # L2-ARCTIC cpl-vs-ppl arm (held-out dev split; canonical is annotated, not a proxy)
    ftune = (REPO / args.finetune)
    l2a_root = (REPO / args.l2arctic) if not os.path.isabs(args.l2arctic) else Path(args.l2arctic)
    l2a_set: list[dict] = []
    if not args.skip_l2arctic and ensure_l2arctic_manifests(ftune, str(l2a_root)):
        l2a_set = load_l2arctic_set(ftune, "dev")
    L2A_MODELS = {"base", "l2a_cpl", "l2a_ppl", "l2a_ppl_dora",
                  "l2a_cpl_long", "l2a_ppl_long",
                  "l2a_ppl_full"}  # cpl-vs-ppl + full-L2-ARCTIC run, not the TR folds

    print(f"[data] TR all={len(all_utts)} utts, LOSO folds={ {k: len(v) for k, v in fold_utts.items()} }, "
          f"canonical sentences={len(canon)}, native clips={len(native)}, "
          f"L2-ARCTIC dev={len(l2a_set)} utts")

    wanted = set(args.models.split(",")) if args.models else None
    models = [m for m in MODELS if (wanted is None or m[0] in wanted)]

    all_per_utt: list[dict] = []
    l2a_per_utt: list[dict] = []
    summaries: list[dict] = []
    l2a_summaries: list[dict] = []

    for name, rel, eval_set in models:
        adapter_dir = None if rel is None else str(adapters_root / rel)
        if adapter_dir and not os.path.isdir(adapter_dir):
            print(f"[skip] {name}: adapter dir not found ({adapter_dir})")
            continue
        utts = all_utts if eval_set == "all" else fold_utts.get(eval_set, [])
        if not utts:
            print(f"[skip] {name}: no eval utts for set {eval_set}")
            continue
        print(f"\n=== {name}  (adapter={rel or 'none'}, set={eval_set}, {len(utts)} utts) ===")
        aligner = make_aligner(adapter_dir, device)

        rows, confusion, per_phone, recall, schwa = eval_model_on_set(aligner, utts, TR_ERROR_PAIRS)
        for r in rows:
            r["model"] = name
        all_per_utt.extend(rows)

        nat_rows, nat_micro = ([], 0.0)
        if native:
            nat_rows, nat_micro = eval_model_on_native(aligner, native)

        # L2-ARCTIC cpl-vs-ppl arm (reuse the loaded model; all-substitution recall)
        l2a_summ = None
        if l2a_set and name in L2A_MODELS:
            print(f"    [l2a] scoring {len(l2a_set)} L2-ARCTIC dev utts ...")
            lrows, l2a_confusion, l2a_per_phone, lrecall, lschwa = eval_model_on_set(
                aligner, l2a_set, None)
            for r in lrows:
                r["model"] = name
            l2a_per_utt.extend(lrows)
            # Per-phone error counts + confusion on the L2-ARCTIC dev set (truth =
            # produced/PPL). Same shape as the TR dumps below; lets us build the
            # base-vs-adapter per-phone table for the full-L2-ARCTIC arm.
            write_csv(out / "raw" / f"l2a_per_phone_{name}.csv",
                      [{"phone": p, "errors": v[0], "total": v[1],
                        "error_rate": round(v[0] / v[1], 4) if v[1] else 0}
                       for p, v in sorted(l2a_per_phone.items(), key=lambda kv: -kv[1][1])],
                      ["phone", "errors", "total", "error_rate"])
            write_csv(out / "raw" / f"l2a_confusion_{name}.csv",
                      [{"ref": r, "hyp": h, "count": c}
                       for (r, h), c in l2a_confusion.most_common()],
                      ["ref", "hyp", "count"])
            lsr = recall_summary(lrecall)
            l2a_summ = {
                "model": name,
                "n_utts": len(lrows),
                "per_vs_ppl": round(micro_per(lrows), 4),
                "per_vs_cpl": micro_per_canon(lrows),
                "deviation_recall": lsr["overall"],
                "per_by_l1": group_per(lrows),
                "schwa_collapse_rate": round(lschwa[0] / lschwa[1], 4) if lschwa[1] else 0.0,
            }
            l2a_summaries.append(l2a_summ)
            print(f"    [l2a] PER_vs_PPL={l2a_summ['per_vs_ppl']}  "
                  f"PER_vs_CPL={l2a_summ['per_vs_cpl']}  dev_recall={l2a_summ['deviation_recall']}")

        # free GPU before next model
        del aligner
        free_device()

        sr = recall_summary(recall)
        summ = {
            "model": name,
            "adapter": rel,
            "eval_set": eval_set,
            "n_utts": len(utts),
            "tr_per_micro": round(micro_per(rows), 4),
            "tr_per_by_speaker": group_per(rows),
            "sub_recall": sr,
            "native_fpr_micro": round(nat_micro, 4),
            "schwa_collapse_rate": round(schwa[0] / schwa[1], 4) if schwa[1] else 0.0,
            "schwa_collapse": schwa,
        }
        summaries.append(summ)
        print(f"    PER={summ['tr_per_micro']}  recall={sr['overall']}  "
              f"nativeFPR={summ['native_fpr_micro']}  schwa={summ['schwa_collapse_rate']}")

        # per-model raw dumps
        write_csv(out / "raw" / f"per_phone_{name}.csv",
                  [{"phone": p, "errors": v[0], "total": v[1],
                    "error_rate": round(v[0] / v[1], 4) if v[1] else 0}
                   for p, v in sorted(per_phone.items(), key=lambda kv: -kv[1][1])],
                  ["phone", "errors", "total", "error_rate"])
        write_csv(out / "raw" / f"confusion_{name}.csv",
                  [{"ref": r, "hyp": h, "count": c}
                   for (r, h), c in confusion.most_common()],
                  ["ref", "hyp", "count"])
        if nat_rows:
            write_csv(out / "raw" / f"native_{name}.csv", nat_rows,
                      ["utt_id", "author", "ref_len", "sub", "del", "ins", "errors", "per"])

    # LOSO aggregate
    loso = [s for s in summaries if s["eval_set"].startswith("loso")]
    summary = {
        "git_sha": git_sha(),
        "device": device,
        "n_tr_utts": len(all_utts),
        "n_native": len(native),
        "n_l2arctic": len(l2a_set),
        "models": summaries,
    }
    if l2a_summaries:
        summary["l2arctic"] = l2a_summaries
    if loso:
        pers = [s["tr_per_micro"] for s in loso]
        recs = [s["sub_recall"]["overall"] for s in loso if s["sub_recall"]["overall"] is not None]
        # map fold -> held-out speaker name (from its eval manifest)
        fold_spk = {f"loso_fold{k}": (read_manifest(ft / f"loso_fold{k}_eval")[0]["speaker"]
                                      if (ft / f"loso_fold{k}_eval" / "text").exists() else "?")
                    for k in range(1, 5)}
        summary["loso"] = {
            "per_mean": round(sum(pers) / len(pers), 4),
            "per_min": round(min(pers), 4),
            "per_max": round(max(pers), 4),
            "recall_mean": round(sum(recs) / len(recs), 4) if recs else None,
            "folds": [{"model": s["model"], "speaker": fold_spk.get(s["eval_set"], "?"),
                       "per": s["tr_per_micro"], "recall": s["sub_recall"]["overall"]}
                      for s in loso],
        }

    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2),
                                      encoding="utf-8")
    write_csv(out / "raw" / "per_utterance.csv", all_per_utt,
              ["model", "utt_id", "speaker", "ref_len", "hyp_len", "sub", "del",
               "ins", "errors", "per", "ref", "hyp"])
    write_csv(out / "raw" / "model_summary.csv",
              [{"model": s["model"], "eval_set": s["eval_set"], "n_utts": s["n_utts"],
                "tr_per": s["tr_per_micro"], "sub_recall": s["sub_recall"]["overall"],
                "native_fpr": s["native_fpr_micro"], "schwa_collapse": s["schwa_collapse_rate"]}
               for s in summaries],
              ["model", "eval_set", "n_utts", "tr_per", "sub_recall", "native_fpr", "schwa_collapse"])

    if l2a_summaries:
        write_csv(out / "raw" / "l2arctic_per_utterance.csv", l2a_per_utt,
                  ["model", "utt_id", "group", "speaker", "ref_len", "canon_len", "hyp_len",
                   "sub", "del", "ins", "errors", "per", "per_canon", "ref", "hyp"])
        write_csv(out / "raw" / "l2arctic_model_summary.csv",
                  [{"model": s["model"], "n_utts": s["n_utts"], "per_vs_ppl": s["per_vs_ppl"],
                    "per_vs_cpl": s["per_vs_cpl"], "deviation_recall": s["deviation_recall"],
                    "schwa_collapse": s["schwa_collapse_rate"]} for s in l2a_summaries],
                  ["model", "n_utts", "per_vs_ppl", "per_vs_cpl", "deviation_recall", "schwa_collapse"])

    if not args.skip_figs:
        save_figures(summary, out)
    write_report(summary, out)
    print(f"\n[done] results in {out}")
    print(f"       summary.json · raw/*.csv · figs/*.png · eval_report.md")


if __name__ == "__main__":
    main()
