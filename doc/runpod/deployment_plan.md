# RunPod Endpoint Structure, Dockerization, and Timestamp Integration

## Overview

Restructure `/mod` into separate endpoints for pronunciation assessment and IPA generation using **2 separate Docker containers** from a **single monorepo**, and integrate MFA alignment to provide sample-point timestamps for pronunciation errors.

## Architecture Decision: Separate Endpoints, Separate Docker Containers, Monorepo

**Why separate endpoints:**

- Independent scaling (assessment needs more workers, IPA generation less frequent)
- Different timeout requirements (assessment longer, IPA generation shorter)
- Different resource optimization (can use different GPU types if needed)
- Cleaner separation of concerns

**Why separate Docker containers:**

- Optimized image sizes (assessment includes MFA, IPA generation doesn't)
- Different dependency sets (assessment needs audio processing + MFA; IPA generation needs POWSM G2P, optional audio processing)
- Independent deployment and versioning
- Better resource isolation

**Why monorepo:**

- Shared code (alignment, utilities) in one place
- Single source of truth
- Easier code sharing between endpoints
- Unified versioning and CI/CD
- Build both Docker images from the same repository

## Monorepo Directory Structure

```
mod/
├── assessment/
│   ├── handler.py          # Assessment endpoint handler
│   ├── assess.py           # Core assessment logic
│   ├── Dockerfile           # Assessment-specific Dockerfile
│   ├── requirements.txt     # Assessment-specific dependencies
│   └── __init__.py
├── ipa_generation/
│   ├── handler.py          # IPA generation endpoint handler
│   ├── generate.py         # Core IPA generation logic
│   ├── Dockerfile           # IPA generation-specific Dockerfile
│   ├── requirements.txt     # IPA generation-specific dependencies
│   └── __init__.py
├── alignment/
│   ├── edit_distance.py    # Shared edit operations
│   ├── mfa.py              # MFA integration (used by assessment)
│   └── __init__.py
├── shared/
│   ├── audio.py            # Audio loading/preprocessing (used by assessment)
│   └── __init__.py
├── .dockerignore
└── README.md
```

## Docker Configuration

### Assessment Dockerfile (`mod/assessment/Dockerfile`)

### IPA Generation Dockerfile (`mod/ipa_generation/Dockerfile`)

### Building Docker Images from Monorepo

Both Docker images are built from the same monorepo root (`mod/`):

```bash
# Build assessment image
cd mod/
docker build -f assessment/Dockerfile -t ucede/nonce-assessment:latest .

# Build IPA generation image
docker build -f ipa_generation/Dockerfile -t ucede/nonce-generation:latest .

# Push both images
docker push ucede/nonce-assessment:latest
docker push ucede/nonce-generation:latest
```

**Note:** Both Dockerfiles use the monorepo root as build context (`.`), allowing them to access shared directories (`alignment/`, `shared/`) while only copying what's needed for each endpoint.

## RunPod Deployment

### Assessment Endpoint Configuration

- **Endpoint Name**: `pronunciation-assessment`
- **Endpoint Type**: Queue-based
- **Docker Image**: `ucede/nonce-assessment:latest`
- **Container Start Command**: `python assessment/handler.py` (or use default CMD)
- **Model Caching**: Optional - specify `espnet/powsm` model URL for faster cold starts

### IPA Generation Endpoint Configuration

- **Endpoint Name**: `ipa-generation`
- **Endpoint Type**: Queue-based
- **Docker Image**: `ucede/nonce-generation:latest`
- **Container Start Command**: `python ipa_generation/handler.py` (or use default CMD)
- **Model Caching**: Optional - specify `espnet/powsm` model URL for faster cold starts

## Implementation Details

### 1. Assessment Endpoint (`mod/assessment/`)

**Handler** (`handler.py`):

- Input: `{audio_uri, target_ipa}`
- Output: `{actual_ipa, target_ipa, score, errors}`
- Errors include sample-point timestamps from MFA alignment

**Core Logic** (`assess.py`):

- Load audio from URI using `shared.audio.load_audio()`
- Run phonetic transcription using POWSM model (`espnet/powsm`)
- Extract IPA from POWSM output (`ipa_phonemes` format)
- Parse `ipa_phonemes` to extract individual phonemes for comparison
- Run MFA forced alignment via `alignment.mfa.align_phonemes()`
- Compare actual vs target IPA using `alignment.edit_distance.edit_operations()`
- Map edit operations to MFA timestamps via `alignment.mfa.map_errors_to_timestamps()`
- Calculate score

**Timestamp Mapping**:

- MFA provides phone-level alignment: `{phoneme, start_sample, end_sample}`
- Map each error operation to corresponding phone timestamps
- Format: `{"start": 20000, "end": 24000}` (sample points at 16kHz)

### 2. IPA Generation Endpoint (`mod/ipa_generation/`)

**Handler** (`handler.py`):

- Input: `{text, audio_uri?}` (English text string, optional audio URI for audio-guided G2P)
- Output: `{ipa_phonemes, phonemes}` (POWSM G2P output format)
- Used by admin when adding new texts (run once, not per assessment)
- Model: `espnet/powsm` with "Audio-guided Grapheme-to-Phoneme (G2P)" task

**Core Logic** (`generate.py`):

- Load POWSM model (`espnet/powsm`) with G2P task
- If `audio_uri` provided: Use audio-guided G2P (more accurate, uses audio context)
- If `audio_uri` not provided: Use text-only G2P (fallback mode)
- Return IPA transcription in POWSM format:
  - `ipa_phonemes`: IPA phonemes separated by slashes (e.g., `/ð//ə//w//ɛ//ð//ɜ˞/...`) - preserves multi-character phonemes like `ɜ˞`, `tʰ`, `l̴`
  - `phonemes`: List of individual phonemes extracted from `ipa_phonemes` format

### 3. Dependencies and Requirements

**Assessment** (`mod/assessment/requirements.txt`):
- `runpod>=1.0.0`
- `torch>=2.0.0` (with CUDA support)
- Audio processing: `librosa>=0.10.0`, `soundfile>=0.12.0`
- `numpy>=1.24.0`
- `requests>=2.31.0`

**IPA Generation** (`mod/ipa_generation/requirements.txt`):
- `runpod>=1.0.0`
- `torch>=2.0.0` (with CUDA support)
- `numpy>=1.24.0`
- `requests>=2.31.0` (for downloading audio if audio_uri provided)
- Audio processing (optional, for audio-guided G2P): `librosa>=0.10.0`, `soundfile>=0.12.0`

## API Response Format

### Assessment Endpoint Response:

```json
{
  "actual_ipa": "hɛloʊ",
  "target_ipa": "hɛləʊ",
  "score": 0.85,
  "errors": [
    {
      "type": "substitute",
      "position": 2,
      "expected": "ə",
      "actual": "o",
      "timestamp": {
        "start": 32000,
        "end": 40000
      }
    }
  ]
}
```

### IPA Generation Endpoint Response:

```json
{
  "ipa_phonemes": "/h//ɛ//l//o//ʊ// //w//ɜ//r//l//d/",
  "phonemes": ["h", "ɛ", "l", "o", "ʊ", " ", "w", "ɜ", "r", "l", "d"]
}
```

**Note**: The response format matches POWSM G2P output:
- `ipa_phonemes`: Phonemes separated by slashes (e.g., `/ð//ə//w//ɛ//ð//ɜ˞/...`) - preserves multi-character phonemes like `ɜ˞`, `tʰ`, `l̴`, `ɪ̃`
- `phonemes`: Array of individual phonemes extracted from `ipa_phonemes` (for easier parsing and comparison)

## Deployment Strategy

### 1. Build Docker Images from Monorepo

```bash
# Navigate to mod directory
cd mod/

# Build assessment image
docker build -f assessment/Dockerfile -t ucede/nonce-assessment:latest .

# Build IPA generation image
docker build -f ipa_generation/Dockerfile -t ucede/nonce-generation:latest .

# Tag with version (optional)
docker tag ucede/nonce-assessment:latest ucede/nonce-assessment:v1.0.0
docker tag ucede/nonce-generation:latest ucede/nonce-generation:v1.0.0

# Push to registry
docker push ucede/nonce-assessment:latest
docker push ucede/nonce-assessment:v1.0.0
docker push ucede/nonce-generation:latest
docker push ucede/nonce-generation:v1.0.0
```

### 2. Deploy Assessment Endpoint (RunPod Console)

1. Navigate to [Serverless section](https://www.console.runpod.io/serverless)
2. Click **New Endpoint**
3. Select **Import from Docker Registry**
4. Enter Docker image: `ucede/nonce-assessment:latest`
5. Configure endpoint:
   - **Endpoint Name**: `pronunciation-assessment`
   - **Endpoint Type**: Queue
   - **Container Start Command**: `python assessment/handler.py`
   - **GPU Configuration**: L4/A5000/3090 (24GB) as primary, 4090 PRO as fallback
   - **Active Workers**: 1-2
   - **Max Workers**: 5-10
   - **Execution Timeout**: 600s
   - **Auto-scaling**: Queue delay, threshold 4s
   - **FlashBoot**: Enabled
6. Click **Create Endpoint**

### 3. Deploy IPA Generation Endpoint (RunPod Console)

1. Navigate to [Serverless section](https://www.console.runpod.io/serverless)
2. Click **New Endpoint**
3. Select **Import from Docker Registry**
4. Enter Docker image: `ucede/nonce-generation:latest`
5. Configure endpoint:
   - **Endpoint Name**: `ipa-generation`
   - **Endpoint Type**: Queue
   - **Container Start Command**: `python ipa_generation/handler.py`
   - **GPU Configuration**: A4000/A4500/RTX 4000 (16GB) as primary, L4/A5000 as fallback
   - **Active Workers**: 0-1
   - **Max Workers**: 2-3
   - **Execution Timeout**: 120s
   - **Auto-scaling**: Request count, scaler value 2-3
   - **FlashBoot**: Optional (disable if traffic is infrequent)
6. Click **Create Endpoint**




## Files to Create/Modify

1. **Create** `mod/assessment/Dockerfile`
2. **Create** `mod/assessment/handler.py`
3. **Create** `mod/assessment/assess.py`
4. **Create** `mod/assessment/requirements.txt`
5. **Create** `mod/assessment/__init__.py`
6. **Create** `mod/ipa_generation/Dockerfile`
7. **Create** `mod/ipa_generation/handler.py`
8. **Create** `mod/ipa_generation/generate.py`
9. **Create** `mod/ipa_generation/requirements.txt`
10. **Create** `mod/ipa_generation/__init__.py`
11. **Create** `mod/alignment/mfa.py`
12. **Create** `mod/shared/audio.py`
13. **Create** `mod/shared/__init__.py`
14. **Create** `mod/.dockerignore`
15. **Update** `mod/README.md` with deployment instructions
16. **Remove/Move** `mod/handler.py` (replaced by assessment handler)

## Monorepo Benefits

- **Single source of truth**: All code in one repository
- **Shared code reuse**: `alignment/` and `shared/` used by both endpoints
- **Unified versioning**: Both endpoints versioned together
- **Easier testing**: Test shared components once
- **Simplified CI/CD**: Build and push both images in one pipeline
- **Consistent dependencies**: Shared utilities ensure compatibility

## Cost Optimization Tips

1. **Assessment Endpoint**: Use active workers (1-2) to reduce cold starts for frequent requests
2. **IPA Generation Endpoint**: Keep active workers at 0-1 since it's less frequent
3. **GPU Selection**: Use cheaper GPUs (A4000) for IPA generation, higher-end (L4/A5000) for assessment
4. **Timeout Tuning**: Set execution timeouts close to actual processing time to prevent runaway jobs
5. **Scaling Strategy**: Use queue delay for assessment (longer tasks), request count for IPA (shorter tasks)
6. **FlashBoot**: Enable for assessment endpoint, disable for IPA if traffic is sparse

