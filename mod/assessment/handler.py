"""
RunPod handler for pronunciation assessment endpoint.

MOCK MODE: Returns random scores/errors for testing the RunPod simulation flow.
"""
import runpod
import random
import time


def handler(job):
    """
    Mock handler that simulates assessment results.
    
    - ~70% success with random score
    - ~20% returns error dict (handler-level error)
    - ~10% raises exception (infra failure)
    """
    # Simulate processing time (2-5 seconds)
    delay = random.uniform(2.0, 5.0)
    time.sleep(delay)
    
    roll = random.random()
    
    if roll < 0.10:
        # Simulate infrastructure failure (uncaught exception)
        raise RuntimeError("Simulated infrastructure failure")
    
    if roll < 0.30:
        # Simulate handler-level error (returns error in output)
        return {"error": "Simulated assessment failure: invalid audio format"}
    
    # Success case
    score = round(random.uniform(0.4, 1.0), 4)
    return {
        "score": score,
        "mock": True,
        "processing_time_ms": int(delay * 1000),
    }


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
