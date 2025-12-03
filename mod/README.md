# Pronunciation Assessment & IPA Generation - RunPod Monorepo

Monorepo containing two separate RunPod serverless endpoints for pronunciation assessment and IPA generation.

## Overview

This monorepo contains:
1. **Assessment Endpoint**: Evaluates pronunciation by comparing audio to target IPA
2. **IPA Generation Endpoint**: Generates IPA transcription from English text (with optional audio)

Both endpoints are deployed as separate Docker containers from this single repository.

## Structure

```
mod/
├── assessment/          # Pronunciation assessment endpoint
│   ├── handler.py      # RunPod handler
│   ├── assess.py       # Core assessment logic
│   ├── edit_distance.py # Edit distance for phoneme comparison
│   ├── Dockerfile      # Assessment Docker image
│   └── requirements.txt
├── ipa_generation/      # IPA generation endpoint
│   ├── handler.py      # RunPod handler
│   ├── generate.py     # Core IPA generation logic
│   ├── Dockerfile      # IPA generation Docker image
│   └── requirements.txt
├── shared/             # Shared utilities
│   └── audio.py        # Audio loading/preprocessing
├── tests/              # Unit tests
└── .dockerignore
```

## Endpoints

### Assessment Endpoint

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
  "actual_ipa": "/h//ɛ//l//o//ʊ/",
  "target_ipa": "hɛloʊ wɜrld",
  "score": 0.85,
  "errors": [
    {
      "type": "substitute",
      "position": 2,
      "expected": "ə",
      "actual": "o",
      "timestamp": {"start": 32000, "end": 40000}
    }
  ]
}
```

### IPA Generation Endpoint

**Input:**
```json
{
  "text": "hello world",
  "audio_uri": "https://..."  // optional
}
```

**Output:**
```json
{
  "ipa_phonemes": "/h//ɛ//l//o//ʊ// //w//ɜ//r//l//d/",
  "phonemes": ["h", "ɛ", "l", "o", "ʊ", " ", "w", "ɜ", "r", "l", "d"]
}
```

## Building Docker Images

Both images are built from the `mod/` directory (build context is `mod/`, not the monorepo root):

```bash
cd mod/

# Build assessment image (build context is mod/ directory)
docker build -f assessment/Dockerfile -t ucede/nonce-assessment:latest .

# Build IPA generation image (build context is mod/ directory)
docker build -f ipa_generation/Dockerfile -t ucede/nonce-generation:latest .

# Push to registry
docker push ucede/nonce-assessment:latest
docker push ucede/nonce-generation:latest
```

## Deployment on RunPod

See `doc/runpod/deployment_plan.md` for detailed deployment instructions.

### Quick Start

1. Build and push Docker images (see above)
2. Create endpoints in RunPod Console:
   - **Assessment**: `ucede/nonce-assessment:latest`
   - **IPA Generation**: `ucede/nonce-generation:latest`
3. Configure endpoints as described in deployment plan

## Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies for assessment
pip install -r assessment/requirements.txt

# Or for IPA generation
pip install -r ipa_generation/requirements.txt

# Test handler locally (requires RUNPOD_API_KEY)
python assessment/handler.py
# or
python ipa_generation/handler.py
```

## Implementation Status

⚠️ **Current Implementation**: Dummy/placeholder results
- IPA transcription returns placeholder values
- Timestamps are evenly distributed (dummy implementation)
- Replace `extract_ipa_from_audio()` and `generate_ipa_*()` functions with actual POWSM model inference
- Replace dummy timestamp generation with actual MFA alignment if needed

## Running Tests

```bash
python -m unittest discover -s tests -v
```

