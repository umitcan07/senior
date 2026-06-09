# Training image for POWSM DoRA adapter fine-tuning.
# Identical dependency stack to mod/assessment/Dockerfile so the saved adapter
# is compatible with the production inference environment.
#
# Build (from repo root):
#   docker build --platform linux/amd64 -f mod/train/Dockerfile -t nounce-train:latest .
#
# Local smoke test (GPU passthrough via Docker Desktop / WSL2):
#   docker run --rm --gpus all \
#     -v "$PWD/data:/workspace/data" \
#     -v "$PWD/scripts:/workspace/scripts" \
#     -v "$PWD/exp:/workspace/exp" \
#     -e HF_HOME=/workspace/.hf_cache \
#     nounce-train:latest \
#     python /workspace/scripts/train_adapter.py \
#       --train-wav  /workspace/data/finetune/tr_speakers/all/wav.scp \
#       --train-text /workspace/data/finetune/tr_speakers/all/text \
#       --dev-wav    /workspace/data/finetune/tr_speakers/all/wav.scp \
#       --dev-text   /workspace/data/finetune/tr_speakers/all/text \
#       --output-dir /workspace/exp/smoke_adapter \
#       --epochs 2 --batch-size 2 --accum-grad 4

FROM nvidia/cuda:11.8.0-cudnn8-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-dev \
    git build-essential \
    libsndfile1 libsndfile1-dev \
    ffmpeg sox \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Exact same torch/torchaudio as the assessment image
RUN python3 -m pip install --no-cache-dir \
    torch "torchaudio<2.9" \
    --index-url https://download.pytorch.org/whl/cu118

# Exact same PEFT/ESPnet stack as assessment image
RUN python3 -m pip install --no-cache-dir \
    espnet==202412 \
    espnet-model-zoo==0.1.7 \
    "transformers==4.46.3" \
    "peft==0.13.2"

# Training extras (not needed in inference image)
RUN python3 -m pip install --no-cache-dir \
    librosa \
    soundfile \
    numpy"<2" \
    tqdm

ENV PYTHONPATH=/workspace/scripts
