"""
RunPod handler for IPA generation endpoint.
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

from generate import generate_ipa, get_models

# Pre-load model on worker startup (not on first request)
print("DEBUG: Pre-loading G2P model on worker startup...")
start_time = time.time()
get_models()  # This will load and cache the model
load_time = time.time() - start_time
print(f"DEBUG: Model pre-loaded in {load_time:.2f} seconds")


def handler(job):
    """
    RunPod job handler for IPA generation.
    
    Input:
        {
            "text": str,           # English text string
            "audio_uri": str?      # Optional URI to audio file for audio-guided G2P
        }
    
    Output:
        {
            "ipa_phonemes": str,   # POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
            "phonemes": List[str]  # Individual phonemes
        }
    """
    try:
        input_data = job.get("input", {})
        text = input_data.get("text")
        audio_uri = input_data.get("audio_uri")
        
        if not text:
            return {"error": "Missing 'text' in input"}
            
        if not audio_uri:
            return {"error": "Missing 'audio_uri' in input"}
        
        result = generate_ipa(text, audio_uri)
        return result
        
    except ValueError as e:
        return {"error": f"Invalid input: {str(e)}"}
    except Exception as e:
        print(f"ERROR: Unexpected exception in handler: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"IPA generation failed: {str(e)}"}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})

