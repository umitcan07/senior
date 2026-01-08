import asyncio
import os
import uuid
import json
import logging
import time
import httpx
from fastapi import FastAPI, BackgroundTasks, HTTPException, Request
from pydantic import BaseModel
from typing import Optional, Dict, Any

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("runpod-proxy")

app = FastAPI(title="RunPod Local Proxy (Robust Simulation)")

# --- In-Memory State ---
# Stores job data: {job_id: {"status": "IN_QUEUE", "input": ..., "output": ..., "webhook": ...}}
jobs: Dict[str, Dict[str, Any]] = {}

# Queues per worker to ensure sequential processing (mimics a single GPU pod)
queues: Dict[str, asyncio.Queue] = {}

# --- Configuration ---
WORKER_MAP_JSON = os.getenv("WORKER_MAP", "{}")
try:
    WORKER_MAP = json.loads(WORKER_MAP_JSON)
    for endpoint_id in WORKER_MAP.keys():
        queues[endpoint_id] = asyncio.Queue()
except json.JSONDecodeError:
    logger.error("Failed to parse WORKER_MAP env var")
    WORKER_MAP = {}

# --- Worker Loop ---
async def worker_loop(endpoint_id: str, worker_url: str):
    """
    Simulates a RunPod worker pulling from the cloud queue.
    """
    logger.info(f"Simulator: Worker loop started for {endpoint_id}")
    target_url = worker_url if "runsync" in worker_url else f"{worker_url.rstrip('/')}/runsync"
    
    while True:
        job_id = await queues[endpoint_id].get()
        job = jobs[job_id]
        
        start_time = time.time()
        job["status"] = "IN_PROGRESS"
        
        logger.info(f"Processing Job {job_id} for {endpoint_id}")
        
        try:
            async with httpx.AsyncClient(timeout=600.0) as client:
                response = await client.post(target_url, json={"input": job["input"]}, timeout=600.0)
                
                execution_time_ms = int((time.time() - start_time) * 1000)
                
                if response.status_code == 200:
                    worker_data = response.json()
                    job["status"] = "COMPLETED"
                    # RunPod results are usually nested in "output"
                    job["output"] = worker_data.get("output", worker_data)
                    job["executionTime"] = execution_time_ms
                else:
                    job["status"] = "FAILED"
                    job["error"] = f"Worker logic error: {response.text}"
                    
        except Exception as e:
            logger.error(f"Job {job_id} failed: {e}")
            job["status"] = "FAILED"
            job["error"] = str(e)
        
        # Determine delayTime (time spent in queue)
        job["delayTime"] = int((start_time - job["createdAt"]) * 1000)

        # Trigger Webhook if present
        if job.get("webhook"):
            await fire_webhook(job_id)
            
        queues[endpoint_id].task_done()

async def fire_webhook(job_id: str):
    job = jobs[job_id]
    payload = {
        "id": job_id,
        "status": job["status"],
        "output": job.get("output"),
        "error": job.get("error"),
        "executionTime": job.get("executionTime", 0),
        "delayTime": job.get("delayTime", 0)
    }
    
    logger.info(f"Firing Webhook for {job_id} to {job['webhook']}")
    try:
        async with httpx.AsyncClient() as client:
            await client.post(job["webhook"], json=payload)
    except Exception as e:
        logger.error(f"Webhook delivery failed for {job_id}: {e}")

# --- Background Loops Startup ---
@app.on_event("startup")
async def startup_event():
    for eid, url in WORKER_MAP.items():
        asyncio.create_task(worker_loop(eid, url))

# --- API Endpoints ---

@app.post("/v2/{endpoint_id}/run")
async def run_job(endpoint_id: str, request: Request):
    if endpoint_id not in WORKER_MAP:
        raise HTTPException(status_code=404, detail="Endpoint not mapped in WORKER_MAP")

    body = await request.json()
    job_id = f"job-{uuid.uuid4()}"
    
    jobs[job_id] = {
        "id": job_id,
        "status": "IN_QUEUE",
        "input": body.get("input", {}),
        "webhook": body.get("webhook"),
        "createdAt": time.time()
    }
    
    await queues[endpoint_id].put(job_id)
    
    return {"id": job_id, "status": "IN_QUEUE"}

@app.get("/v2/{endpoint_id}/status/{job_id}")
async def get_status(endpoint_id: str, job_id: str):
    if job_id not in jobs:
        raise HTTPException(status_code=404, detail="Job not found")
    
    job = jobs[job_id]
    return {
        "id": job_id,
        "status": job["status"],
        "output": job.get("output"),
        "error": job.get("error"),
        "executionTime": job.get("executionTime"),
        "delayTime": job.get("delayTime")
    }

@app.get("/health")
def health():
    return {"status": "ok", "active_queues": list(queues.keys())}
