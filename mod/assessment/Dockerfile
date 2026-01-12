# Assessment endpoint Dockerfile
# Build from mod/ directory: cd mod/ && docker build --platform linux/amd64 -f assessment/Dockerfile -t ucede/nonce-assessment:latest .
#
# MFA (Montreal Forced Aligner) is installed via conda using recommended approach.
# Installation order: MFA first (via conda), then CUDA/PyTorch.

FROM ubuntu:22.04

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
    find $CONDA_DIR -follow -type f -name '*.pyc' -delete

# Initialize conda and add conda-forge channel (MFA recommended approach)
RUN conda config --add channels conda-forge && \
    conda config --set channel_priority strict

WORKDIR /worker

# Create conda environment for MFA (recommended approach: use conda-forge channel)
RUN conda create -n mfa-env -y -c conda-forge montreal-forced-aligner && \
    conda clean -afy

# Add conda MFA environment to PATH
ENV PATH=/opt/conda/envs/mfa-env/bin:$PATH

# Upgrade pip first
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Install CUDA toolkit and cuDNN (required for PyTorch CUDA support)
RUN apt-get update && apt-get install -y \
    cuda-toolkit-11-8 \
    libcudnn8 \
    && rm -rf /var/lib/apt/lists/*

# Set CUDA environment variables
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64

# Install PyTorch with CUDA 11.8 (same as ipa_generation)
RUN python3 -m pip install --no-cache-dir \
    torch torchaudio \
    --index-url https://download.pytorch.org/whl/cu118

# Copy files
COPY shared/ /worker/shared/
COPY assessment/ /worker/assessment/

# Install dependencies
RUN python3 -m pip install --no-cache-dir -r assessment/requirements.txt

# Add textgrid for parsing MFA output (even if MFA not installed)
RUN python3 -m pip install --no-cache-dir textgrid librosa numpy

ENV PYTHONPATH=/worker
# Set HuggingFace cache to network volume (if attached, otherwise uses default)
ENV HF_HOME=/runpod-volume/.cache/huggingface

CMD ["python3", "assessment/handler.py"]
