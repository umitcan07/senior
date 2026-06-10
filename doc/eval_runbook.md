# Adapter eval runbook

How to run `scripts/eval_adapters.py` on a RunPod GPU pod and get the results
back to the laptop. Companion: `doc/adapters.md` (what the metrics mean),
`doc/finetuning_plan.md` (the experiment design).

## What the script produces

Into `--out` (default `artifacts/eval/`):

- `summary.json` — every metric, machine-readable (the source of truth).
- `eval_report.md` — the `doc/adapters.md` §Report table, auto-filled.
- `raw/per_utterance.csv` — one row per (model, utterance): PER, S/D/I, hyp, ref.
- `raw/model_summary.csv` — one row per model.
- `raw/per_phone_<model>.csv`, `raw/confusion_<model>.csv`, `raw/native_<model>.csv`.
- `figs/*.png` — PER by model / by speaker, substitution recall (+ heatmap),
  native FPR, schwa-collapse, and the headline `cpl_vs_ppl.png`.

Metrics: **PER** (vs produced TR annotation, the gate number), **substitution
recall** on the Turkish error pairs (3-way canonical→produced→hypothesis),
**native FPR/drift** (vs committed goldens on 100 native clips), plus
**schwa-collapse rate** (the cpl symptom). See `adapters.md` for definitions and
the folding convention (both sides folded through `prep_tr_speakers.normalize_ipa`,
which also neutralizes the #85 affricate-ligature issue for eval).

**L2-ARCTIC cpl-vs-ppl arm (the side proof).** On the held-out L2-ARCTIC dev split
(the cpl/ppl/dora early-stopping hold-out — 4 speakers, ~4 L1 groups), the corpus
ships annotated canonical (CPL) *and* perceived (PPL) targets on identical audio,
so the substitution canonical is real, not a proxy. For base/cpl/ppl/dora the
script reports **PER vs PPL**, **PER vs CPL**, and **deviation recall** (every
annotated canonical→produced substitution the model reproduces). The thesis in one
table: cpl-supervision keeps PER-vs-CPL low but drives PER-vs-PPL up and deviation
recall down (it normalizes away what was produced); ppl-supervision does the
opposite. Extra outputs: `raw/l2arctic_*.csv`, `figs/l2arctic_cpl_vs_ppl.png`,
`figs/l2arctic_per_by_l1.png`. The arm runs automatically if
`l2arctic_release_v5.0/` (or `--l2arctic <root>`) and the `data/finetune/l2a_*`
manifests are present; pass `--skip-l2arctic` to turn it off.

## On the pod (repo at /workspace)

```bash
cd /workspace

# 1. deps: espnet/peft/torch/librosa/numpy ship in the worker image already.
#    matplotlib is the only extra needed for figures (raw data writes without it):
pip install matplotlib

# 2. adapters — either already extracted under artifacts/release/<name>/best,
#    or let the script extract the committed tarball:
python scripts/eval_adapters.py --tgz adapters/adapters_best.tgz --out artifacts/eval

#    (equivalently: tar xzf adapters/adapters_best.tgz -C artifacts/release
#     then python scripts/eval_adapters.py --out artifacts/eval)
```

The script auto-runs `prep_tr_speakers.py` if the TR manifests are missing, then
loads base + each of the 7 adapters once (frees GPU between models), runs the TR
held-out set + native FPR pass per model, and writes everything.

Smoke test first (3 models, no figures):

```bash
python scripts/eval_adapters.py --models base,l2a_cpl,l2a_ppl --skip-figs --out artifacts/eval_smoke
```

## Getting results back (pod is web-terminal-only — no scp/ssh)

Per `adapters.md` Pitfall #6, push out over the one exposed HTTP port:

```bash
# on the pod
cd /workspace/artifacts && tar czf eval.tgz eval && python -m http.server 8000
# then from the laptop (use the pod's mapped host:port)
curl -o eval.tgz http://<pod-host>:<port>/eval.tgz && tar xzf eval.tgz
gzip -t eval.tgz   # verify — the pod link has truncated transfers before
```

Land the extracted `eval/` under the repo's `artifacts/eval/` locally. Then fold
`eval_report.md` into `doc/adapters.md` §Report and the report/poster/slides.

## Notes / gotchas

- **Eval-set routing is automatic.** base/cpl/ppl/dora score all 4 TR speakers;
  each `l2a_ppl_tr_foldK` scores **only** its held-out speaker (the LOSO rule).
  The summary's `loso` block reports mean ± range across folds.
- **Canonical for substitution recall** is a GenAm native-reference proxy from
  `data/precompute/` (not an independent G2P). PER and the cpl-vs-ppl contrast do
  not depend on it; only the recall numbers do. Documented in `eval_report.md`.
- **Native FPR** uses the committed `*.expected.json` goldens, so base ≈ 0 by
  construction; the number is each adapter's drift from base on correct native
  speech (the must-not-regress signal).
- **`best/` vs epochs.** The script points at each adapter's `best/`. To sweep
  epochs (Pitfall #3 — best dev-loss ≠ best PER), extract the all-epochs tarball
  and run with `--adapters-root` pointing at a dir whose `<name>/best` is a
  symlink/copy of the checkpoint you want to test.
```
