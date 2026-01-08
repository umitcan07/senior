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
docker build -f assessment/Dockerfile -t ucede/nonce-assessment:latest .

# Build IPA Generation
docker build -f ipa_generation/Dockerfile -t ucede/nonce-generation:latest .

# Push
docker push ucede/nonce-assessment:latest
docker push ucede/nonce-generation:latest
```

### RunPod Configuration
1.  **Endpoint Type**: Queue (Serverless).
2.  **Image**: Use your pushed registry image.
3.  **Command**: `python [service]/handler.py`.
4.  **Scaling**: Start with 1-2 active workers for assessment to avoid cold starts for users.

---

## 4. Maintenance

- **Caching**: Large model weights (POWSM/ESPnet) are ideally cached in a Network Volume to reduce container start times.
- **Monitoring**: RunPod console provides logs and request metrics. Use these to adjust your Scaling Policy (Queue Delay vs Request Count).
