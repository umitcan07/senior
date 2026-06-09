# Assessment endpoint Dockerfile
# Build from mod/ directory: cd mod/ && docker build --platform linux/amd64 -f assessment/Dockerfile -t ucede/nonce-assessment:latest .

FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-dev \
    git \
    build-essential \
    libsndfile1 \
    libsndfile1-dev \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /worker

# Upgrade pip first
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Install PyTorch with CUDA 11.8
RUN python3 -m pip install --no-cache-dir \
    torch "torchaudio<2.9" \
    --index-url https://download.pytorch.org/whl/cu118

# Copy files
COPY shared/ /worker/shared/
COPY assessment/ /worker/assessment/
COPY alignment.py /worker/alignment.py
COPY gop_scoring.py /worker/gop_scoring.py
COPY phone_diff.py /worker/phone_diff.py
COPY phone_features.py /worker/phone_features.py

# Install dependencies
RUN python3 -m pip install --no-cache-dir -r assessment/requirements.txt

RUN python3 -m pip install --no-cache-dir librosa numpy

ENV PYTHONPATH=/worker
# Set HuggingFace cache to network volume (if attached, otherwise uses default)
ENV HF_HOME=/runpod-volume/.cache/huggingface

# Load the Turkish-L1 perceived-label LoRA adapter (l2a_ppl, 2026-06-09, epoch-30)
# baked at assessment/adapter/. Set POWSM_ADAPTER_DIR="" on the endpoint to fall back
# to baseline POWSM (e.g. for an A/B). lang_sym matches training (<eng>).
ENV POWSM_ADAPTER_DIR=/worker/assessment/adapter
ENV POWSM_LANG_SYM=<eng>

CMD ["python3", "assessment/handler.py"]
