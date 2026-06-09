#!/usr/bin/env bash
# Train all thesis adapters sequentially inside the nounce-train container.
#
# Runs (all paths relative to /workspace, repo mounted there):
#   1. l2a_cpl            LoRA   canonical labels (control condition)
#   2. l2a_ppl            LoRA   perceived labels (corrected condition)
#   3. l2a_ppl_dora       DoRA   perceived labels (LoRA-vs-DoRA ablation, same data as #2)
#   4-7. l2a_ppl_tr_foldN LoRA   perceived + 3 TR speakers, leave-one-TR-speaker-out
#
# The core thesis result is #1 vs #2 (CPL vs PPL on identical audio).
# #3 isolates adapter method (LoRA vs DoRA) holding data constant.
# #4-7 add the 4 Turkish speakers via LOSO; the held-out speaker
# (loso_foldN_eval) is evaluated post-hoc, NOT used for early stopping.
#
# Usage (from repo root on host):
#   docker run --rm --gpus all \
#     -v "${PWD}/data:/workspace/data" \
#     -v "${PWD}/scripts:/workspace/scripts" \
#     -v "${PWD}/exp:/workspace/exp" \
#     -v "${PWD}/l2arctic_release_v5.0:/workspace/l2arctic_release_v5.0" \
#     -v "${PWD}/.hf_cache:/workspace/.hf_cache" \
#     -e HF_HOME=/workspace/.hf_cache \
#     nounce-train:latest bash /workspace/scripts/train_all.sh
#
# Override defaults via env: EPOCHS, BATCH_SIZE, ACCUM_GRAD, LR.

set -euo pipefail

# Always run from the repo root so relative manifest paths resolve.
cd "$(dirname "$0")/.."

EPOCHS="${EPOCHS:-30}"
BATCH_SIZE="${BATCH_SIZE:-4}"
ACCUM_GRAD="${ACCUM_GRAD:-4}"
LR="${LR:-2e-5}"

# Overridable so the same script works locally (repo mounted at /workspace) and on
# a RunPod pod (repo at /root/senior, outputs to the network volume via EXP=...).
FT="${FT:-data/finetune}"
EXP="${EXP:-exp}"
PY="${PY:-scripts/train_adapter.py}"
mkdir -p "$EXP"

run() {
  local name="$1"; shift
  echo "=================================================================="
  echo "=== ADAPTER: ${name}"
  echo "=================================================================="
  python3 "$PY" \
    --output-dir "${EXP}/${name}" \
    --epochs "$EPOCHS" --batch-size "$BATCH_SIZE" --accum-grad "$ACCUM_GRAD" --lr "$LR" \
    "$@"
}

# 1. CPL control (LoRA)
run l2a_cpl --no-use-dora \
  --train-wav  "${FT}/l2a_cpl/train/wav.scp" \
  --train-text "${FT}/l2a_cpl/train/text" \
  --dev-wav    "${FT}/l2a_cpl/dev/wav.scp" \
  --dev-text   "${FT}/l2a_cpl/dev/text"

# 2. PPL corrected (LoRA) — the other half of the core ablation
run l2a_ppl --no-use-dora \
  --train-wav  "${FT}/l2a_ppl/train/wav.scp" \
  --train-text "${FT}/l2a_ppl/train/text" \
  --dev-wav    "${FT}/l2a_ppl/dev/wav.scp" \
  --dev-text   "${FT}/l2a_ppl/dev/text"

# 3. PPL with DoRA — adapter-method ablation, identical data to #2
run l2a_ppl_dora --use-dora \
  --train-wav  "${FT}/l2a_ppl/train/wav.scp" \
  --train-text "${FT}/l2a_ppl/train/text" \
  --dev-wav    "${FT}/l2a_ppl/dev/wav.scp" \
  --dev-text   "${FT}/l2a_ppl/dev/text"

# 4-7. PPL + TR speakers, leave-one-speaker-out (LoRA)
for k in 1 2 3 4; do
  run "l2a_ppl_tr_fold${k}" --no-use-dora \
    --train-wav  "${FT}/l2a_ppl/train/wav.scp" \
                 "${FT}/tr_speakers/loso_fold${k}_train_tr/wav.scp" \
    --train-text "${FT}/l2a_ppl/train/text" \
                 "${FT}/tr_speakers/loso_fold${k}_train_tr/text" \
    --dev-wav    "${FT}/l2a_ppl/dev/wav.scp" \
    --dev-text   "${FT}/l2a_ppl/dev/text"
done

echo "=================================================================="
echo "=== ALL ADAPTERS COMPLETE"
echo "=================================================================="
ls -la "${EXP}"
