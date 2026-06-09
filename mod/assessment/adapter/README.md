# Baked assessment adapter — `l2a_ppl`

This directory holds the PEFT LoRA adapter the assessment worker loads at runtime,
via `ENV POWSM_ADAPTER_DIR=/worker/assessment/adapter` (set in the Dockerfile).

| | |
|---|---|
| Adapter | **`l2a_ppl`** (perceived-label, L2-ARCTIC PPL targets) |
| Method | LoRA, `r=32`, `alpha=64`, attention-only (`linear_q/k/v/out`) |
| Checkpoint | `best/` (epoch-30) from the `adapters-2026-06-09` release |
| Base | `espnet/powsm`, `lang_sym=<eng>`, `task_sym=<pr>` |
| Trained | 2026-06-09 (see `doc/adapters.md`) |

## Why this one

`l2a_ppl` was the best perceived-label adapter in the eval matrix (`doc/adapters.md`
§Report): it beats base on L2-ARCTIC deviation recall across all 4 L1 groups and on
Turkish PER, and `DoRA ≈ LoRA`. The promotion gate was muted (small margins, base
was the strict pick), so this is deployed as the **fine-tuned showcase / V2 model**;
set `POWSM_ADAPTER_DIR=""` on the endpoint to revert to baseline POWSM for an A/B.

## ⚠️ Reference-precompute provenance

The R2/DB reference phones were precomputed with **base** POWSM. With this adapter
live, learner phones come from `l2a_ppl` while reference phones are base — a model
mismatch that muddies the reference diff. For a clean assessment, re-run
`scripts/precompute_references.py` with this adapter and stamp `model_version`
(see `doc/finetuning_plan.md` §"Model versioning + DB"). Tracked as follow-up.

> Weights here are committed (≈21 MB, under the LFS/100 MB threshold) following the
> existing baked-adapter precedent, so the CI image build picks them up with no
> volume step. The fuller off-image version contract is #74.
