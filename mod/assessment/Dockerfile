# Assessment endpoint Dockerfile
# Build from mod/ directory: cd mod/ && docker build --platform linux/amd64 -f assessment/Dockerfile -t ucede/nonce-assessment:latest .
# Note: Use --platform linux/amd64 flag when building on Apple Silicon (M1/M2/M3) for RunPod compatibility

FROM runpod/pytorch:2.0.1-py3.10-cuda11.8.0-devel

# Set working directory inside container (changed from /app to avoid confusion)
WORKDIR /worker

# Install system dependencies for audio processing
# librosa uses soundfile (requires libsndfile1) and audioread (can use ffmpeg)
RUN apt-get update && apt-get install -y \
    libsndfile1 \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Copy shared modules first (for better caching)
COPY shared/ /worker/shared/

# Copy assessment-specific files
COPY assessment/ /worker/assessment/

# Install Python dependencies
RUN pip install --no-cache-dir -r assessment/requirements.txt

# Set Python path so imports work correctly in container
ENV PYTHONPATH=/worker

# Run assessment handler
WORKDIR /worker
CMD ["python", "assessment/handler.py"]

