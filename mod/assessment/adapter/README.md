# Baked assessment adapter — `l2a_ppl_long`

This directory holds the PEFT LoRA adapter the assessment worker loads at runtime,
via `ENV POWSM_ADAPTER_DIR=/worker/assessment/adapter` (set in the Dockerfile).

| | |
|---|---|
| Adapter | **`l2a_ppl_long`** (perceived-label, L2-ARCTIC PPL targets) |
| Method | LoRA, `r=32`, `alpha=64`, attention-only (`linear_q/k/v/out`) |
| Checkpoint | `best/` (epoch-60) from the `adapters-2026-06-10-long` release |
| Base | `espnet/powsm`, `lang_sym=<eng>`, `task_sym=<pr>` |
| Trained | 2026-06-10, 60-epoch re-train (see `doc/adapters.md`) |

## Why this one

`l2a_ppl_long` is the strongest perceived-label adapter in the eval matrix
(`doc/adapters.md` §Report): at 60 epochs it beats base on **TR-PER (0.392),
TR sub-recall (0.057 vs 0.033), and L2-ARCTIC deviation recall (0.213 vs 0.173)** —
the sharpened thesis result (canonical `l2a_cpl_long` drops *below* base; perceived
clearly helps). The trade-off vs the 30-epoch `l2a_ppl` is higher native-speech
drift (FPR ~0.024 vs ~0.008); we accept it for the stronger learner-deviation
detection. Set `POWSM_ADAPTER_DIR=""` on the endpoint to revert to baseline POWSM
for an A/B.

## ⚠️ Reference-precompute provenance

The R2/DB reference phones were precomputed with **base** POWSM. With this adapter
live, learner phones come from `l2a_ppl` while reference phones are base — a model
mismatch that muddies the reference diff. For a clean assessment, re-run
`scripts/precompute_references.py` with this adapter and stamp `model_version`
(see `doc/finetuning_plan.md` §"Model versioning + DB"). Tracked as follow-up.

> Weights here are committed (≈21 MB, under the LFS/100 MB threshold) following the
> existing baked-adapter precedent, so the CI image build picks them up with no
> volume step. The fuller off-image version contract is #74.
