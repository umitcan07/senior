"""
RunPod handler for pronunciation assessment (contract #22).
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

# Add parent directory to path to import shared + sibling modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import alignment
import vad
from assess import assess

# Pre-load models on worker startup (not on first request): the POWSM CTC
# aligner (GPU) and the small Silero VAD (CPU).
print("DEBUG: Pre-loading POWSM aligner + Silero VAD on worker startup...")
start_time = time.time()
alignment.get_aligner()
try:
    vad.get_model()
except Exception as e:
    print(f"DEBUG: VAD warm-up skipped: {e}")
load_time = time.time() - start_time
print(f"DEBUG: Models pre-loaded in {load_time:.2f} seconds")


def handler(job):
    """
    RunPod job handler for pronunciation assessment.

    Input:
        {
            "audio_uri": str,              # URI to the learner's audio
            "reference_id": str,           # reference id (traceability)
            "reference_phones": [str],     # precomputed reference phones (bare tokens)
            "reference_ipa": str?          # POWSM-format reference IPA (fallback)
        }

    Output: either an abstention payload
        { "status": "abstained", "abstention": {reason, detail}, "signal_quality": {...} }
    or a scored payload
        { "status": "scored", "score", "confidence", "errors": [...], "phones": [...],
          "signal_quality": {...} }
    """
    try:
        input_data = job.get("input", {})
        audio_uri = input_data.get("audio_uri")
        reference_id = input_data.get("reference_id")
        reference_phones = input_data.get("reference_phones")
        reference_ipa = input_data.get("reference_ipa")

        if not audio_uri:
            return {"error": "Missing 'audio_uri' in input"}
        if not reference_phones and not reference_ipa:
            return {"error": "Missing 'reference_phones'/'reference_ipa' in input"}

        return assess(
            audio_uri,
            reference_id=reference_id,
            reference_phones=reference_phones,
            reference_ipa=reference_ipa,
        )

    except ValueError as e:
        return {"error": f"Invalid input: {str(e)}"}
    except Exception as e:
        print(f"ERROR: Unexpected exception in handler: {str(e)}")
        import traceback
        traceback.print_exc()
        return {"error": f"Assessment failed: {str(e)}"}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
