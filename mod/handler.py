import runpod
from assessment.edit_distance import edit_operations


def assess(audio_uri: str, target_ipa: str) -> dict:
    actual_ipa = ""
    
    target_phonemes = list(target_ipa.replace(" ", ""))
    actual_phonemes = list(actual_ipa.replace(" ", "")) if actual_ipa else []
    
    operations = edit_operations(actual_phonemes, target_phonemes)
    
    total_phonemes = len(target_phonemes)
    if total_phonemes == 0:
        score = 1.0 if len(actual_phonemes) == 0 else 0.0
    else:
        error_cost = sum(
            1 if op[0] == "delete" else
            1 if op[0] == "insert" else
            2 if op[0] == "substitute" else 0
            for op in operations
        )
        max_cost = total_phonemes * 2
        score = max(0.0, 1.0 - (error_cost / max_cost))
    
    return {
        "actual_ipa": actual_ipa,
        "target_ipa": target_ipa,
        "operations": operations,
        "score": score,
        "errors": operations
    }


def handler(job):
    try:
        input_data = job.get("input", {})
        audio_uri = input_data.get("audio_uri")
        target_ipa = input_data.get("target_ipa")
        
        if not audio_uri:
            return {"error": "Missing 'audio_uri' in input"}
        if not target_ipa:
            return {"error": "Missing 'target_ipa' in input"}
        
        return assess(audio_uri, target_ipa)
        
    except Exception as e:
        return {"error": str(e)}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})

