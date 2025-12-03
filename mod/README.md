# Pronunciation Assessment - RunPod GPU Worker

Simple Python application for GPU-based pronunciation assessment deployed on RunPod serverless endpoints.

## Overview

Takes an audio file URI and target IPA pronunciation, returns pronunciation assessment with error detection and scoring.

**Input:**
```json
{
  "audio_uri": "https://...",
  "target_ipa": "hɛloʊ wɜrld"
}
```

**Output:**
```json
{
  "actual_ipa": "...",
  "target_ipa": "hɛloʊ wɜrld",
  "operations": [...],
  "score": 0.85,
  "errors": [...]
}
```

## Structure

```
mod/
├── handler.py        # RunPod handler function (entry point)
├── metrics/          # Pronunciation metrics and distance calculations
├── tests/            # Unit tests
└── requirements.txt  # Python dependencies
```

## Deployment on RunPod

1. Base directory is `/mod` in the container
2. Entry point: `handler.py` (RunPod will call the handler function)
3. Install dependencies: `pip install -r requirements.txt`

### RunPod Configuration

- **Handler**: `handler.py`
- **Container Start Command**: `python handler.py`
- **GPU**: Recommended L4/A5000 (24GB) or higher for model inference

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Test handler locally (requires RUNPOD_API_KEY)
python handler.py
```

## Usage

The handler processes jobs with:
- `audio_uri`: URI to audio file (HTTP/HTTPS or S3-compatible storage)
- `target_ipa`: Target IPA pronunciation string (space-separated phonemes)

Returns pronunciation assessment with:
- `actual_ipa`: Detected IPA from audio (from model inference)
- `operations`: Edit operations comparing actual vs target
- `score`: Pronunciation accuracy (0.0-1.0)
- `errors`: List of pronunciation errors

## Future Considerations

- **Separate endpoint for IPA generation**: When admins add new texts, generate target IPA once (not per assessment)
- **Model loading**: Load POWSM/Wav2Vec models in handler initialization for faster inference
- **Audio preprocessing**: Handle format conversion, resampling to 16kHz mono

## Running Tests

```bash
python -m unittest discover -s tests -v
```

