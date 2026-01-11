#!/bin/bash
set -e

# Check if RunPod network volume is mounted
if [ -d "/runpod-volume" ] && [ -w "/runpod-volume" ]; then
    echo "Network volume detected at /runpod-volume"
    
    # Set cache directories to network volume
    export HF_HOME=/runpod-volume/.cache/huggingface
    export MFA_ROOT_DIR=/runpod-volume/.cache/mfa
    
    # Create cache directories
    mkdir -p $HF_HOME
    mkdir -p $MFA_ROOT_DIR
    
    # Sync MFA models from image to network volume if not present
    if [ ! -d "$MFA_ROOT_DIR/pretrained_models" ]; then
        echo "Syncing MFA models to network volume..."
        cp -r /opt/mfa/* $MFA_ROOT_DIR/ 2>/dev/null || true
        echo "MFA models synced"
    else
        echo "MFA models already present on network volume"
    fi
else
    echo "No network volume detected, using local cache"
    export HF_HOME=/root/.cache/huggingface
    export MFA_ROOT_DIR=/opt/mfa
fi

echo "HF_HOME=$HF_HOME"
echo "MFA_ROOT_DIR=$MFA_ROOT_DIR"

# Run the handler
exec python3 assessment/handler.py "$@"
