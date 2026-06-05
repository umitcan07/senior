# Pronunciation Assessment — RunPod worker

RunPod serverless worker that evaluates pronunciation by comparing a learner's
audio to a target IPA transcription, using POWSM (phone recognition + ASR).

> The V1 IPA-generation (G2P) endpoint was removed in E1 (#12); V2 references
> carry precomputed IPA. Phone-level timestamps come from POWSM CTC forced
> alignment, landing in E3 (#19) — until then `assess()` emits no timings.

## Structure

```
mod/
├── assessment/          # Pronunciation assessment endpoint
│   ├── handler.py      # RunPod handler
│   ├── assess.py       # Core assessment logic
│   ├── edit_distance.py # Edit distance for phoneme comparison
│   ├── Dockerfile      # Assessment Docker image
│   └── requirements.txt
├── shared/             # Shared utilities
│   └── audio.py        # Audio loading/preprocessing
├── dev/                # Local RunPod simulator (runpod_proxy.py)
├── tests/              # Unit tests
└── .dockerignore
```

## Assessment endpoint

**Input:**
```json
{
  "audio_uri": "https://...",
  "target_ipa": "hɛloʊ wɜrld"
}
```
`target_ipa` is required (precomputed reference IPA).

**Output:**
```json
{
  "actual_ipa": "/h//ɛ//l//o//ʊ/",
  "target_ipa": "hɛloʊ wɜrld",
  "score": 0.85,
  "errors": [
    { "type": "substitute", "position": 2, "expected": "ə", "actual": "o", "timestamp": null }
  ]
}
```
(`timestamp` is `null` until POWSM CTC alignment lands in E3.)

## Building the Docker image

Built from the `mod/` directory (build context is `mod/`, not the monorepo root):

```bash
cd mod/
docker build -f assessment/Dockerfile -t ucede/nonce-assessment:latest .
docker push ucede/nonce-assessment:latest
```

## Deployment on RunPod

See `mod/DEPLOYMENT_STEPS.md`. Quick start: build + push the image, then create the
`pronunciation-assessment` endpoint in the RunPod Console pointing at
`ucede/nonce-assessment:latest`.

## Local development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r assessment/requirements.txt
```

Or run the full local RunPod simulator (proxy + worker) via `python scripts/runpod.py`.

## Implementation status

- POWSM PR (phone recognition) + ASR run on real audio.
- Phone-level timestamps: pending POWSM CTC forced alignment (E3 / #19).

## Running tests

```bash
python -m unittest discover -s tests -v
```
