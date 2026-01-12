# Assessment endpoint Dockerfile
# Build from mod/ directory: cd mod/ && docker build --platform linux/amd64 -f assessment/Dockerfile -t ucede/nonce-assessment:latest .
#
# INNOVATIVE SOLUTION: Build MFA and PyTorch in completely separate stages
# This allows Docker to build them in parallel and reduces peak disk usage
# Each stage is independent and can be cached separately

# ============================================================================
# Stage 1: MFA Builder - MINIMAL installation (only conda + MFA)
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS mfa-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install ONLY wget and bzip2 (nothing else!)
RUN apt-get update && apt-get install -y --no-install-recommends \
    wget \
    bzip2 \
    && rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    rm -rf /tmp/* /var/tmp/*

# Install Miniconda3 (smallest possible installation)
ENV CONDA_DIR=/opt/conda
ENV PATH=$CONDA_DIR/bin:$PATH
RUN wget --quiet https://repo.anaconda.com/miniconda/Miniconda3-latest-Linux-x86_64.sh -O /tmp/miniconda.sh && \
    bash /tmp/miniconda.sh -b -p $CONDA_DIR && \
    rm /tmp/miniconda.sh && \
    conda clean -afy && \
    find $CONDA_DIR -follow -type f -name '*.a' -delete && \
    find $CONDA_DIR -follow -type f -name '*.pyc' -delete && \
    rm -rf $CONDA_DIR/pkgs/cache /tmp/*

# Initialize conda (minimal config)
RUN conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/main && \
    conda tos accept --override-channels --channel https://repo.anaconda.com/pkgs/r && \
    conda config --remove channels defaults && \
    conda config --add channels conda-forge && \
    conda config --set channel_priority strict && \
    rm -rf /tmp/*

# Create MFA environment and clean up IMMEDIATELY after each step
RUN conda create -n mfa-env -y --override-channels -c conda-forge montreal-forced-aligner && \
    conda clean -afy && \
    rm -rf $CONDA_DIR/pkgs && \
    find $CONDA_DIR -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null || true && \
    rm -rf /tmp/* /var/tmp/* && \
    # Final cleanup
    find $CONDA_DIR -name '*.pyc' -delete 2>/dev/null || true && \
    find $CONDA_DIR -name '*.pyo' -delete 2>/dev/null || true

# ============================================================================
# Stage 2: PyTorch Builder - Install PyTorch and Python dependencies
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04 AS pytorch-builder

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install ONLY essential packages (no git, no build tools, no ffmpeg)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-dev \
    libsndfile1 \
    libsndfile1-dev \
    && rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    rm -rf /tmp/* /var/tmp/*

WORKDIR /worker

# Upgrade pip
RUN python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel && \
    python3 -m pip cache purge 2>/dev/null || true && \
    rm -rf /tmp/* /var/tmp/* /root/.cache 2>/dev/null || true

# Copy requirements
COPY assessment/requirements.txt /tmp/requirements.txt

# Create target directory
RUN mkdir -p /opt/python-packages

# Install PyTorch (torch only, no torchaudio yet)
RUN python3 -m pip install --no-cache-dir \
    --target /opt/python-packages \
    torch \
    --extra-index-url https://download.pytorch.org/whl/cu118 && \
    python3 -m pip cache purge 2>/dev/null || true && \
    rm -rf /var/tmp/* /root/.cache/pip /tmp/* 2>/dev/null || true

# Install torchaudio separately
RUN python3 -m pip install --no-cache-dir \
    --target /opt/python-packages \
    torchaudio \
    --extra-index-url https://download.pytorch.org/whl/cu118 && \
    python3 -m pip cache purge 2>/dev/null || true && \
    rm -rf /var/tmp/* /root/.cache/pip /tmp/* 2>/dev/null || true

# Install other dependencies
RUN python3 -m pip install --no-cache-dir \
    --target /opt/python-packages \
    -r /tmp/requirements.txt && \
    python3 -m pip cache purge 2>/dev/null || true && \
    rm -rf /var/tmp/* /root/.cache/pip /tmp/* 2>/dev/null || true

# Install additional packages
RUN python3 -m pip install --no-cache-dir \
    --target /opt/python-packages \
    textgrid librosa numpy && \
    python3 -m pip cache purge 2>/dev/null || true && \
    rm -rf /root/.cache/pip /tmp/requirements.txt /tmp/* /var/tmp/* 2>/dev/null || true

# ============================================================================
# Stage 3: Final Image - Combine MFA and PyTorch
# ============================================================================
FROM nvidia/cuda:11.8.0-cudnn8-runtime-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1

# Install runtime dependencies only
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/* && \
    apt-get clean && \
    python3 -m pip install --no-cache-dir --upgrade pip setuptools wheel && \
    rm -rf /tmp/* /var/tmp/*

# Copy conda installation from mfa-builder
COPY --from=mfa-builder /opt/conda /opt/conda

# Copy Python packages from pytorch-builder
COPY --from=pytorch-builder /opt/python-packages /opt/python-packages

# Set environment variables
ENV CONDA_DIR=/opt/conda
ENV PATH=/opt/conda/bin:/opt/conda/envs/mfa-env/bin:/usr/local/bin:$PATH
ENV CUDA_HOME=/usr/local/cuda
ENV PATH=${CUDA_HOME}/bin:${PATH}
ENV LD_LIBRARY_PATH=${CUDA_HOME}/lib64
ENV PYTHONPATH=/opt/python-packages

WORKDIR /worker

# Copy application files
COPY shared/ /worker/shared/
COPY assessment/ /worker/assessment/

# Set Python path
ENV PYTHONPATH=/opt/python-packages:/worker
ENV HF_HOME=/runpod-volume/.cache/huggingface

CMD ["python3", "assessment/handler.py"]
