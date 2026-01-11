"""
RunPod handler for pronunciation assessment endpoint.
"""
import runpod
import sys
import os
import subprocess
import time

print(f"DEBUG: sys.path: {sys.path}")
try:
    print("DEBUG: pip freeze:")
    subprocess.run([sys.executable, "-m", "pip", "freeze"], check=False)
except Exception as e:
    print(f"DEBUG: Failed to run pip freeze: {e}")

from typing import Any, Dict, List

# Add parent directory to path to import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from assess import assess, get_models

# Pre-load models on worker startup (not on first request)
print("DEBUG: Pre-loading POWSM models on worker startup...")
start_time = time.time()
get_models()  # This will load and cache the models
load_time = time.time() - start_time
print(f"DEBUG: Models pre-loaded in {load_time:.2f} seconds")


def handler(job):
    """
    RunPod job handler for pronunciation assessment.
    
    Input:
        {
            "audio_uri": str,        # URI to audio file
            "target_text": str,      # Target text (ground truth transcript)
            "target_ipa": str?       # Optional target IPA (if not provided, will generate with G2P)
        }
    
    Output:
        {
            "actual_ipa": str,       # Detected IPA from PR
            "target_ipa": str,       # Target IPA from G2P
            "score": float,          # Pronunciation score (0.0-1.0)
            "errors": List[Dict]     # List of errors with timestamps
        }
    """
    try:
        input_data = job.get("input", {})
        audio_uri = input_data.get("audio_uri")
        target_text = input_data.get("target_text")
        target_ipa = input_data.get("target_ipa")
        
        if not audio_uri:
            return {"error": "Missing 'audio_uri' in input"}
            
        if not target_text:
            return {"error": "Missing 'target_text' in input"}
        
        result = assess(audio_uri, target_text, target_ipa)
        return result
        
    except ValueError as e:
        return {"error": f"Invalid input: {str(e)}"}
    except Exception as e:
        print(f"ERROR: Unexpected exception in handler: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"Assessment failed: {str(e)}"}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
