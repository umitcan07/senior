#!/bin/bash
set -e

# Check if RunPod network volume is mounted
if [ -d "/runpod-volume" ] && [ -w "/runpod-volume" ]; then
    echo "Network volume detected at /runpod-volume"
    
    # Set cache directory to network volume
    export HF_HOME=/runpod-volume/.cache/huggingface

    # Create cache directory
    mkdir -p $HF_HOME
else
    echo "No network volume detected, using local cache"
    export HF_HOME=/root/.cache/huggingface
fi

echo "HF_HOME=$HF_HOME"

# Run the handler
exec python3 assessment/handler.py "$@"
