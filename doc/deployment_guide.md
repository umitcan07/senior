# GPU Production Deployment Guide

This document outlines the production strategy for the Python services using **RunPod Serverless**.

---

## 1. Provider Assessment Summary

| Provider | Verdict | Why? |
| :--- | :--- | :--- |
| **RunPod** | **Recommended** | Best balance of cost and custom Docker support. Handles async queues + webhooks natively. |
| **Modal** | Alternative | Excellent Python-native experience, but higher lock-in. |
| **Fly.io** | Limited | Slower cold starts for GPUs and less optimized for short-burst inference. |

---

## 2. Infrastructure Design

We use a **Monorepo Architecture** for the Python services located in the `/mod` directory.

### Two-Endpoint Strategy
Instead of one giant container, we deploy two focused endpoints:

1.  **`pronunciation-assessment`**
    *   **GPU**: L4 / RTX 3090 (24GB VRAM)
    *   **Features**: Whisper/POWSM Transcription + MFA Forced Alignment.
2.  **`ipa-generation`**
    *   **GPU**: A4000 / RTX 4000 (16GB VRAM)
    *   **Features**: POWSM G2P (Text-to-IPA).

---

## 3. Deployment Workflow

### Build & Push
Images are built from the `/mod` root to include shared modules.

```bash
cd mod/

# Build Assessment
docker build -f assessment/Dockerfile -t ucede/nonce-assessment:v0.1.0 .

# Build IPA Generation
docker build -f ipa_generation/Dockerfile -t ucede/nonce-generation:v0.1.0 .

# Push
docker push ucede/nonce-assessment:v0.1.0
docker push ucede/nonce-generation:v0.1.0
```

### RunPod Configuration
1.  **Endpoint Type**: Queue (Serverless).
2.  **Image**: Use your pushed registry image.
3.  **Command**: `python [service]/handler.py`.
4.  **Scaling**: Start with 1-2 active workers for assessment to avoid cold starts for users.

---

## 4. Maintenance

- **Monitoring**: RunPod console provides logs and request metrics. Use these to adjust your Scaling Policy (Queue Delay vs Request Count).

---

## 5. Network Volume Strategy

To eliminate cold-start latency caused by model downloads, we use a **Network Volume**.

### Storage Estimates

| Component | Estimate | Details |
| :--- | :--- | :--- |
| **MFA** | ~1 GB | Acoustic models, dictionaries, and temporary alignment corpora. |
| **ESPnet / POWSM** | ~3 GB | G2P and ASR model weights (cached from HuggingFace/Zenodo). |
| **Whisper** | ~3 GB | `large-v3` weights (if used for transcription). |
| **System / Logs** | ~3 GB | Persistent logs, pip cache, and debugging artifacts. |
| **Buffer** | ~10 GB | Safety margin for future larger models. |
| **Total Recommended** | **20 GB** | **~$1.40 / month** |

### Implications

1.  **Region Locking**: The generic "Anywhere" deployment cannot be used. You must pin your Template/Endpoint to the specific data center where the volume exists (e.g., `US-NV-1`).
2.  **Environment Configuration**:
    *   Mount Path: `/runpod-volume`
    *   Env Var for MFA: `MFA_ROOT_DIRECTORY=/runpod-volume/mfa`
    *   Env Var for ESPnet: `ESPNET_MODEL_ZOO_CACHE_DIR=/runpod-volume/espnet`
    *   Env Var for HF: `HF_HOME=/runpod-volume/huggingface`
3.  **Initialization**: The volume starts empty. The first worker to launch will spend time downloading. All subsequent workers (even after scaling to 0 and back) will be instant.
