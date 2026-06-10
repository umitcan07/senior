#!/usr/bin/env python3
"""
E6.6 (#35) — system-vs-human validation stats.

Joins, per rating clip:
  - human intelligibility ratings  (data/validation/ratings/*.csv, from
    /intelligibility-score; columns rater_name,clip_id,score,notes,rated_at)
  - the system pronunciation score (data/validation/results/<speaker>/ref_NNN.json,
    from scripts/batch_assess.py), matched via the private clip map
    sig/validation/clips.json (clip_id -> _speaker/_ref).

and reports:
  - Spearman rho (system score vs mean human rating) — the headline,
  - inter-rater agreement (pairwise Spearman) when >=2 raters,
  - the external speechocean762 rho (artifacts/speechocean) if available.

Pure stdlib for the stats (no numpy/scipy); scatter PNG only if matplotlib is
installed (degrades gracefully).

Usage:  python sig/analysis/validation.py [--out doc/figures]
"""

from __future__ import annotations

import argparse
import csv
import glob
import json
import math
import os
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent


def rankdata(xs: list[float]) -> list[float]:
    """1-based average ranks (ties averaged), like scipy.stats.rankdata."""
    order = sorted(range(len(xs)), key=lambda i: xs[i])
    ranks = [0.0] * len(xs)
    i = 0
    while i < len(xs):
        j = i
        while j + 1 < len(xs) and xs[order[j + 1]] == xs[order[i]]:
            j += 1
        avg = (i + j) / 2.0 + 1.0
        for k in range(i, j + 1):
            ranks[order[k]] = avg
        i = j + 1
    return ranks


def pearson(a: list[float], b: list[float]) -> float | None:
    n = len(a)
    if n < 2:
        return None
    ma, mb = sum(a) / n, sum(b) / n
    cov = sum((a[i] - ma) * (b[i] - mb) for i in range(n))
    va = sum((x - ma) ** 2 for x in a)
    vb = sum((x - mb) ** 2 for x in b)
    if va == 0 or vb == 0:
        return None
    return cov / math.sqrt(va * vb)


def spearman(a: list[float], b: list[float]) -> float | None:
    if len(a) < 3:
        return None
    return pearson(rankdata(a), rankdata(b))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ratings", default="data/validation/ratings")
    ap.add_argument("--results", default="data/validation/results")
    ap.add_argument("--clip-map", default="sig/validation/clips.json")
    ap.add_argument("--out", default="doc/figures")
    args = ap.parse_args()

    clip2sr = {
        c["clip_id"]: (c.get("_speaker"), c.get("_ref"))
        for c in json.loads((REPO / args.clip_map).read_text(encoding="utf-8"))["clips"]
    }

    # ratings: clip_id -> {rater: score}
    ratings: dict[str, dict[str, float]] = {}
    raters: set[str] = set()
    for f in sorted(glob.glob(str(REPO / args.ratings / "*.csv"))):
        for row in csv.DictReader(open(f, encoding="utf-8-sig")):
            cid, r = row.get("clip_id"), row.get("rater_name")
            try:
                s = float(row["score"])
            except (TypeError, ValueError, KeyError):
                continue
            if cid and r:
                ratings.setdefault(cid, {})[r] = s
                raters.add(r)

    # system score per clip (exclude abstained / no score)
    sysscore: dict[str, float] = {}
    for cid, (spk, ref) in clip2sr.items():
        if not spk or not ref:
            continue
        p = REPO / args.results / spk / f"{ref}.json"
        if p.exists():
            res = json.loads(p.read_text(encoding="utf-8")).get("result", {})
            if res.get("status") == "scored" and res.get("score") is not None:
                sysscore[cid] = float(res["score"])

    # join
    rows = []
    for cid, rmap in ratings.items():
        if cid in sysscore and rmap:
            mh = sum(rmap.values()) / len(rmap)
            rows.append({"clip_id": cid, "speaker": clip2sr[cid][0], "ref": clip2sr[cid][1],
                         "system_score": sysscore[cid], "mean_human": mh,
                         "n_raters": len(rmap)})
    rows.sort(key=lambda r: r["clip_id"])
    rho = spearman([r["system_score"] for r in rows], [r["mean_human"] for r in rows])

    # inter-rater (pairwise Spearman on commonly-rated clips), if >=2 raters
    rlist = sorted(raters)
    interrater = {}
    for i in range(len(rlist)):
        for j in range(i + 1, len(rlist)):
            ra, rb = rlist[i], rlist[j]
            common = [c for c in ratings if ra in ratings[c] and rb in ratings[c]]
            if len(common) >= 3:
                rr = spearman([ratings[c][ra] for c in common],
                              [ratings[c][rb] for c in common])
                interrater[f"{ra}~{rb}"] = {"n": len(common), "spearman": round(rr, 4) if rr else None}

    # external speechocean (if pulled locally)
    so_path = REPO / "artifacts" / "speechocean" / "summary.json"
    speechocean = None
    if so_path.exists():
        s = json.loads(so_path.read_text(encoding="utf-8"))
        speechocean = {"rho_phone": s.get("spearman_rho_phone_gop_vs_accuracy"),
                       "rho_sentence": s.get("spearman_rho_sentence_meangop_vs_total"),
                       "n_phones": s.get("n_phones")}

    summary = {
        "n_raters": len(rlist),
        "raters": rlist,
        "n_clips_rated": len(ratings),
        "n_clips_joined": len(rows),
        "spearman_system_vs_human": round(rho, 4) if rho is not None else None,
        "inter_rater": interrater or "n/a (need >=2 raters)",
        "speechocean762": speechocean or "not pulled locally (see pod artifacts/speechocean)",
    }

    out = REPO / args.out
    out.mkdir(parents=True, exist_ok=True)
    (out / "validation_stats.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    with (out.parent / "validation_pairs.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["clip_id", "speaker", "ref", "system_score",
                                          "mean_human", "n_raters"])
        w.writeheader()
        w.writerows(rows)

    print(json.dumps(summary, indent=2))
    if len(rlist) < 2:
        print("\n[note] 1 rater so far — rho is preliminary; Krippendorff/inter-rater needs >=2.")

    # scatter (optional)
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt

        fig, ax = plt.subplots(figsize=(5.5, 5))
        ax.scatter([r["system_score"] for r in rows], [r["mean_human"] for r in rows], alpha=0.7)
        ax.set_xlabel("system pronunciation score")
        ax.set_ylabel("mean human intelligibility (0-10)")
        ax.set_title(f"System vs human (n={len(rows)}, rho={summary['spearman_system_vs_human']})")
        fig.tight_layout()
        fig.savefig(out / "scatter_system_vs_human.png", dpi=140)
        plt.close(fig)
        print(f"[figs] wrote {out / 'scatter_system_vs_human.png'}")
    except Exception as e:
        print(f"[figs] scatter skipped ({e}); rho + pairs CSV still written")


if __name__ == "__main__":
    main()
