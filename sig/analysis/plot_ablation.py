#!/usr/bin/env python3
"""
Render the fine-tuning ablation figures for the report from the committed
Table:ftAblation / Table:l2aFullShared numbers (doc/report/report-v3.tex).

Numbers are hard-coded here to stay in lock-step with the report tables (the
source eval ran on the GPU pod; the per-model summaries live in artifacts/eval*
but cpl_long's L2A row is only in the report table). Keep these in sync if the
table changes. Outputs to doc/report/figures/ (so the report's
\\graphicspath{figures/} picks them up) and doc/figures/.

    python sig/analysis/plot_ablation.py
"""

from __future__ import annotations

from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402

REPO = Path(__file__).resolve().parent.parent.parent
OUTS = [REPO / "doc" / "report" / "figures", REPO / "doc" / "figures"]

# (label, L2A PER vs CPL, L2A PER vs PPL, L2A deviation recall) — Table:ftAblation
# (60-epoch core ablation) + base. dev recall is the thesis metric.
CPL_VS_PPL = [
    ("base",            0.240, 0.240, 0.173),  # base has no cpl/ppl split; PER vs PPL only
    ("l2a_cpl_long",    0.217, 0.217, 0.163),
    ("l2a_ppl_long",    0.205, 0.205, 0.213),
]

# Deviation recall across the budget (30 vs 60 epochs) — shows the contrast widening.
RECALL_BUDGET = [
    ("base",         0.173, 0.173),   # (30-equiv, 60-equiv) — base is budget-independent
    ("l2a_cpl",      0.173, 0.163),   # cpl: no-op at 30ep, harms at 60ep
    ("l2a_ppl",      0.186, 0.213),   # ppl: helps at 30ep, more at 60ep
]


def fig_cpl_vs_ppl_recall() -> None:
    """Deviation recall: base vs canonical-long vs perceived-long (the headline)."""
    labels = [r[0] for r in CPL_VS_PPL]
    recall = [r[3] for r in CPL_VS_PPL]
    colors = ["#888888", "#c0504d", "#4f81bd"]  # grey / canonical-red / perceived-blue
    fig, ax = plt.subplots(figsize=(6, 4))
    bars = ax.bar(labels, recall, color=colors)
    ax.axhline(0.173, ls="--", lw=1, color="#444", alpha=0.7)
    ax.text(2.45, 0.176, "base", fontsize=8, color="#444", ha="right")
    for b, v in zip(bars, recall):
        ax.text(b.get_x() + b.get_width() / 2, v + 0.003, f"{v:.3f}", ha="center", fontsize=9)
    ax.set_ylabel("L2-ARCTIC deviation recall")
    ax.set_ylim(0, 0.26)
    ax.set_title("Canonical vs perceived supervision (60 epochs)")
    fig.tight_layout()
    for d in OUTS:
        d.mkdir(parents=True, exist_ok=True)
        fig.savefig(d / "l2arctic_cpl_vs_ppl_long.png", dpi=140)
    plt.close(fig)


def fig_recall_budget() -> None:
    """Deviation recall at 30 vs 60 epochs — the contrast widening with budget."""
    labels = [r[0] for r in RECALL_BUDGET]
    e30 = [r[1] for r in RECALL_BUDGET]
    e60 = [r[2] for r in RECALL_BUDGET]
    x = range(len(labels))
    w = 0.38
    fig, ax = plt.subplots(figsize=(6, 4))
    ax.bar([i - w / 2 for i in x], e30, w, label="30 epochs", color="#9bbb59")
    ax.bar([i + w / 2 for i in x], e60, w, label="60 epochs", color="#4f81bd")
    ax.axhline(0.173, ls="--", lw=1, color="#444", alpha=0.6)
    ax.set_xticks(list(x))
    ax.set_xticklabels(labels)
    ax.set_ylabel("L2-ARCTIC deviation recall")
    ax.set_ylim(0, 0.24)
    ax.set_title("Deviation recall by training budget")
    ax.legend()
    fig.tight_layout()
    for d in OUTS:
        d.mkdir(parents=True, exist_ok=True)
        fig.savefig(d / "deviation_recall_by_budget.png", dpi=140)
    plt.close(fig)


if __name__ == "__main__":
    fig_cpl_vs_ppl_recall()
    fig_recall_budget()
    print("wrote l2arctic_cpl_vs_ppl_long.png + deviation_recall_by_budget.png to", [str(d) for d in OUTS])
