import asyncio
import os
import uuid
import json
import logging
import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("runpod-proxy")

app = FastAPI(title="RunPod Local Proxy")

# Configuration from Environment Variables
# Format: {"endpoint-id": "http://worker-host:port/runsync"}
# Example: '{"pronunciation-assessment": "http://worker-assessment:8000/runsync"}'
WORKER_MAP_JSON = os.getenv("WORKER_MAP", "{}")
try:
    WORKER_MAP = json.loads(WORKER_MAP_JSON)
except json.JSONDecodeError:
    logger.error("Failed to parse WORKER_MAP env var")
    WORKER_MAP = {}

class RunPodInput(BaseModel):
    input: Dict[str, Any]
    webhook: Optional[str] = None

async def process_job(job_id: str, worker_url: str, payload: RunPodInput):
    """
    Background task:
    1. Call worker /runsync
    2. Post result to webhook
    """
    logger.info(f"Job {job_id}: Sending to worker {worker_url}")
    
    # 1. Call Worker
    result_payload = {"id": job_id, "status": "FAILED", "output": None}
    try:
        async with httpx.AsyncClient(timeout=600.0) as client:
            # RunPod Workers expect wrapped input: {"input": {...}}
            response = await client.post(worker_url, json={"input": payload.input})
            
            if response.status_code == 200:
                worker_data = response.json()
                # Determine "output" based on worker response structure
                # Typically RunPod workers return specific JSON. We'll pass it through.
                # If the worker returns {"output": ...}, use that. Else use whole body.
                result_payload["status"] = "COMPLETED"
                result_payload["output"] = worker_data.get("output", worker_data)
            else:
                logger.error(f"Job {job_id}: Worker returned {response.status_code}")
                result_payload["error"] = f"Worker Status: {response.status_code}"
                
    except Exception as e:
        logger.error(f"Job {job_id}: Worker call failed: {e}")
        result_payload["error"] = str(e)

    # 2. Fire Webhook
    if payload.webhook:
        logger.info(f"Job {job_id}: Firing webhook to {payload.webhook}")
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                await client.post(payload.webhook, json=result_payload)
        except Exception as e:
            logger.error(f"Job {job_id}: Webhook failed: {e}")
    else:
        logger.info(f"Job {job_id}: No webhook provided")


@app.post("/v2/{endpoint_id}/run")
async def run_job(endpoint_id: str, request: Request, background_tasks: BackgroundTasks):
    """
    Simulate RunPod Async Endpoint: POST /v2/{id}/run
    """
    # 1. Resolve Worker
    # Check simple ID match first
    worker_url = WORKER_MAP.get(endpoint_id)
    
    # Optional: Allow mapping "friendly" IDs to container URLs if not exact match
    if not worker_url:
        logger.warning(f"Endpoint ID {endpoint_id} not found in WORKER_MAP: {WORKER_MAP.keys()}")
        raise HTTPException(status_code=404, detail=f"Endpoint {endpoint_id} not found locally")

    # 2. Parse Body
    try:
        body = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    rp_input = RunPodInput(
        input=body.get("input", {}),
        webhook=body.get("webhook")
    )

    # 3. Generate Job ID
    job_id = f"{endpoint_id}-{uuid.uuid4()}"

    # 4. Schedule Background Work
    # Append /runsync if not present in the config URL, assuming standard RunPod worker
    target_url = worker_url if "runsync" in worker_url else f"{worker_url.rstrip('/')}/runsync"
    
    background_tasks.add_task(process_job, job_id, target_url, rp_input)

    # 5. Return Async Response
    return {
        "id": job_id,
        "status": "IN_QUEUE"
    }

@app.get("/health")
def health():
    return {"status": "ok", "workers_configured": list(WORKER_MAP.keys())}
