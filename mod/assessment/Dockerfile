# Assessment endpoint Dockerfile
# Build from mod/ directory: cd mod/ && docker build --platform linux/amd64 -f assessment/Dockerfile -t ucede/nonce-assessment:latest .
#
# MFA (Montreal Forced Aligner) is installed via conda using recommended approach.
# Installation order: MFA first (via conda), then CUDA/PyTorch.

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
    wget \
    bzip2 \
    && rm -rf /var/lib/apt/lists/*

# Install Miniconda3
ENV CONDA_DIR=/opt/conda
ENV PATH=$CONDA_DIR/bin:$PATH
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh && \
    bash /tmp/miniconda.sh -b -p $CONDA_DIR && \
    rm /tmp/miniconda.sh && \
    conda clean -afy && \
    find $CONDA_DIR -follow -type f -name '*.a' -delete && \
    find $CONDA_DIR -follow -type f -name '*.pyc' -delete && \
    rm -rf $CONDA_DIR/pkgs/cache

# Initialize conda and configure to use only conda-forge (MFA recommended approach)
# Accept ToS for default channels (required for newer conda versions) and configure conda-forge
RUN conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main && \
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r && \
    conda config --remove channels defaults && \
    conda config --add channels conda-forge && \
    conda config --set channel_priority strict

WORKDIR /worker

# Create conda environment for MFA (recommended approach: use conda-forge channel only)
RUN conda create -n mfa-env -y --override-channels -c conda-forge montreal-forced-aligner && \
    conda clean -afy && \
    rm -rf $CONDA_DIR/pkgs && \
    find $CONDA_DIR -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

# Add conda MFA environment to PATH
ENV PATH=/opt/conda/envs/mfa-env/bin:$PATH

# Upgrade pip first and clean up
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel && \
    python3 -m pip cache purge 2>/dev/null || true

# CUDA is already included in the base image
# Set CUDA environment variables (already set by base image, but explicit for clarity)
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64

# Install PyTorch with CUDA 11.8 (same as ipa_generation)
# Note: Using --extra-index-url instead of --index-url to allow PyPI fallback
RUN python3 -m pip install --no-cache-dir \
    torch torchaudio \
    --extra-index-url https://download.pytorch.org/whl/cu118

# Copy files
COPY shared/ /worker/shared/
COPY assessment/ /worker/assessment/

# Install dependencies
RUN python3 -m pip install --no-cache-dir -r assessment/requirements.txt && \
    python3 -m pip install --no-cache-dir textgrid librosa numpy && \
    python3 -m pip cache purge && \
    rm -rf /root/.cache/pip

ENV PYTHONPATH=/worker
# Set HuggingFace cache to network volume (if attached, otherwise uses default)
ENV HF_HOME=/runpod-volume/.cache/huggingface

CMD ["python3", "assessment/handler.py"]
