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

# Install PyTorch with CUDA 11.8 (latest available)
RUN python3 -m pip install --no-cache-dir \
    torch torchaudio \
    --index-url https://download.pytorch.org/whl/cu118

# Copy files
COPY shared/ /worker/shared/
COPY assessment/ /worker/assessment/
COPY requirements-pinned.txt /worker/assessment/requirements.txt

# Install dependencies
RUN python3 -m pip install --no-cache-dir -r assessment/requirements.txt

ENV PYTHONPATH=/worker
# Set HuggingFace cache to network volume (if attached, otherwise uses default)
ENV HF_HOME=/runpod-volume/.cache/huggingface

CMD ["python3", "assessment/handler.py"]
