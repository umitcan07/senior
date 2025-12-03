"""
RunPod handler for pronunciation assessment endpoint.
"""
import runpod
import sys
import os

# Add parent directory to path to import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from assess import assess


def handler(job):
    """
    RunPod job handler for pronunciation assessment.
    
    Input:
        {
            "audio_uri": str,  # URI to audio file
            "target_ipa": str  # Target IPA pronunciation
        }
    
    Output:
        {
            "actual_ipa": str,
            "target_ipa": str,
            "score": float,
            "errors": List[Dict]
        }
    """
    try:
        input_data = job.get("input", {})
        audio_uri = input_data.get("audio_uri")
        target_ipa = input_data.get("target_ipa")
        
        if not audio_uri:
            return {"error": "Missing 'audio_uri' in input"}
        if not target_ipa:
            return {"error": "Missing 'target_ipa' in input"}
        
        result = assess(audio_uri, target_ipa)
        return result
        
    except ValueError as e:
        return {"error": f"Invalid input: {str(e)}"}
    except Exception as e:
        return {"error": f"Assessment failed: {str(e)}"}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})

