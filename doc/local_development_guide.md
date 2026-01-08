# Local Development Guide for GPU Services

Focus: **Advanced RunPod Simulation & Local GPU Acceleration**

This guide explains how to develop and test your GPU-intensive Python services (Assessment and IPA Generation) locally on a Mac using a robust simulation of RunPod's Cloud behavior.

---

## 1. Simulation Architecture (Local Cloud)

To ensure your integration works exactly like production, we use a **Stateful Proxy-Worker** architecture managed by Docker Compose.

*   **Gateway (RunPod Proxy)**: Listens on port `8008`.
    *   Manages a sequential **Job Queue** internal to the simulator.
    *   Tracks job states: `IN_QUEUE` -> `IN_PROGRESS` -> `COMPLETED`/`FAILED`.
    *   Calculates `executionTime` and `delayTime`.
*   **Workers**: Separate containers running your production `handler.py`.

---

## 2. Quick Start

### Start the Local Fleet
```bash
docker-compose -f docker-compose.dev.yml up --build
```

---

## 3. Testing the Endpoints

### A. Submit an Async Job
Mimics `POST /run`.

```bash
curl -X POST http://localhost:8008/v2/ipa-generation/run \
  -H "Content-Type: application/json" \
  -d '{ "input": { "text": "Hello world" } }'
```
**Response**: `{"id": "job-abc-123", "status": "IN_QUEUE"}`

### B. Poll for Status
Mimics `GET /status/{id}`. Use the ID from the previous step.

```bash
curl http://localhost:8008/v2/ipa-generation/status/job-abc-123
```
**Response**:
```json
{
  "id": "job-abc-123",
  "status": "COMPLETED",
  "output": { ... },
  "executionTime": 450,
  "delayTime": 10
}
```

### C. Webhook Integration
To test your fullstack app's webhook receiver:
```bash
curl -X POST http://localhost:8008/v2/ipa-generation/run \
  -H "Content-Type: application/json" \
  -d '{
    "input": { "text": "Testing production flow" },
    "webhook": "http://host.docker.internal:3000/api/webhook"
  }'
```

---

## 4. Key Differences vs Production
- **Platform**: Local images run via Rosetta 2 (AMD64 emulation).
- **GPU**: No GPU acceleration inside Docker for Mac (runs on CPU), but your actual handler code is `device = "cuda"` ready.
- **Data Persistence**: Jobs are stored in memory in the proxy; restarting the `runpod-proxy` container clears the history.
