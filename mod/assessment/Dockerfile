# Assessment endpoint Dockerfile
# Build from mod/ directory: cd mod/ && docker build --platform linux/amd64 -f assessment/Dockerfile -t ucede/nonce-assessment:latest .
#
# Multi-stage build to reduce disk usage:
# Stage 1: Install conda and MFA
# Stage 2: Install PyTorch and Python dependencies
# Stage 3: Final image with only necessary components

# ============================================================================
# Stage 1: MFA Builder - Install conda and MFA
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS mfa-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install system dependencies needed for conda
RUN apt-get update && apt-get install -y \
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

# Initialize conda and configure to use only conda-forge
RUN conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main && \
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r && \
    conda config --remove channels defaults && \
    conda config --add channels conda-forge && \
    conda config --set channel_priority strict

# Create conda environment for MFA
RUN conda create -n mfa-env -y --override-channels -c conda-forge montreal-forced-aligner && \
    conda clean -afy && \
    rm -rf $CONDA_DIR/pkgs && \
    find $CONDA_DIR -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true

# ============================================================================
# Stage 2: PyTorch Builder - Install PyTorch and Python dependencies
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS pytorch-builder

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
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel && \
    python3 -m pip cache purge 2>/dev/null || true

# Copy requirements first for better caching
COPY assessment/requirements.txt /tmp/requirements.txt

# Install PyTorch with CUDA 11.8 to a specific location
RUN python3 -m pip install --no-cache-dir \
    --target /opt/python-packages \
    torch torchaudio \
    --extra-index-url https://download.pytorch.org/whl/cu118 && \
    python3 -m pip cache purge 2>/dev/null || true && \
    rm -rf /var/tmp/* /root/.cache/pip 2>/dev/null || true

# Install Python dependencies to the same location
RUN python3 -m pip install --no-cache-dir \
    --target /opt/python-packages \
    -r /tmp/requirements.txt && \
    python3 -m pip install --no-cache-dir \
    --target /opt/python-packages \
    textgrid librosa numpy && \
    python3 -m pip cache purge && \
    rm -rf /root/.cache/pip /tmp/requirements.txt /tmp/* 2>/dev/null || true

# ============================================================================
# Stage 3: Final Image - Combine MFA and PyTorch
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install runtime dependencies only
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* && \
    python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel

# Copy conda installation from mfa-builder
COPY --from=mfa-builder /opt/conda /opt/conda

# Copy Python packages from pytorch-builder
COPY --from=pytorch-builder /opt/python-packages /opt/python-packages

# Add Python packages to Python path
ENV PYTHONPATH=/opt/python-packages

# Set environment variables
ENV CONDA_DIR=/opt/conda
ENV PATH=/opt/conda/bin:/opt/conda/envs/mfa-env/bin:/usr/local/bin:$PATH
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64

WORKDIR /worker

# Copy application files
COPY shared/ /worker/shared/
COPY assessment/ /worker/assessment/

# Set Python path (packages from pytorch-builder + worker directory)
ENV PYTHONPATH=/opt/python-packages:/worker
ENV HF_HOME=/runpod-volume/.cache/huggingface

CMD ["python3", "assessment/handler.py"]
