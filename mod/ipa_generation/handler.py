"""
RunPod handler for IPA generation endpoint.
"""
import runpod
import sys
import os

# Add parent directory to path to import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from generate import generate_ipa


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
        
        result = generate_ipa(text, audio_uri)
        return result
        
    except ValueError as e:
        return {"error": f"Invalid input: {str(e)}"}
    except Exception as e:
        return {"error": f"IPA generation failed: {str(e)}"}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})

