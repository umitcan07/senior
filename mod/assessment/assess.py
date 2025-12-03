"""
Core assessment logic for pronunciation evaluation.
Uses dummy IPA transcription - replace with actual POWSM model inference.
"""
import sys
import os

# Add parent directory to path to import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.audio import load_audio
from edit_distance import edit_operations
from typing import Dict, List


def parse_ipa_phonemes(ipa_phonemes: str) -> List[str]:
    """
    Parse IPA phonemes from POWSM format (e.g., "/h//ɛ//l//o//ʊ/").
    
    Args:
        ipa_phonemes: IPA string in POWSM format with slashes
    
    Returns:
        List of individual phonemes
    """
    # Remove leading/trailing slashes and split
    cleaned = ipa_phonemes.strip().strip('/')
    if not cleaned:
        return []
    
    # Split by '//' to get individual phonemes
    phonemes = [p.strip('/') for p in cleaned.split('//') if p.strip('/')]
    return phonemes


def extract_ipa_from_audio(audio_uri: str) -> str:
    """
    Extract IPA transcription from audio using POWSM model.
    
    DUMMY IMPLEMENTATION: Returns placeholder IPA.
    Replace with actual POWSM model inference.
    
    Args:
        audio_uri: URI to audio file
    
    Returns:
        IPA phonemes string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
    """
    # TODO: Replace with actual POWSM model inference
    # Load audio
    # audio, sr = load_audio(audio_uri)
    # Run POWSM model inference
    # Extract ipa_phonemes from model output
    
    # Dummy: return placeholder
    return "/h//ɛ//l//o//ʊ/"


def assess(audio_uri: str, target_ipa: str) -> Dict:
    """
    Assess pronunciation by comparing actual vs target IPA.
    
    Args:
        audio_uri: URI to audio file
        target_ipa: Target IPA pronunciation (can be space-separated or POWSM format)
    
    Returns:
        Dictionary with:
        - actual_ipa: str (detected IPA)
        - target_ipa: str
        - score: float (0.0-1.0)
        - errors: List[Dict] (errors with timestamps)
    """
    # Load audio (for MFA alignment)
    audio, sr = load_audio(audio_uri)
    
    # Extract IPA from audio (DUMMY - replace with POWSM)
    actual_ipa_phonemes = extract_ipa_from_audio(audio_uri)
    actual_phonemes = parse_ipa_phonemes(actual_ipa_phonemes)
    
    # Parse target IPA (handle both space-separated and POWSM format)
    if '//' in target_ipa:
        target_phonemes = parse_ipa_phonemes(target_ipa)
    else:
        # Space-separated format
        target_phonemes = [p for p in target_ipa.split() if p]
    
    # Run edit distance to find errors
    operations = edit_operations(actual_phonemes, target_phonemes)
    
    # Convert operations to error format with dummy timestamps
    # TODO: Replace with actual MFA alignment for real timestamps
    errors = []
    total_samples = len(audio)
    samples_per_phoneme = total_samples // len(actual_phonemes) if len(actual_phonemes) > 0 else total_samples
    
    for op in operations:
        op_type = op[0]
        position = op[1]
        
        error_dict = {
            "type": op_type,
            "position": position
        }
        
        if op_type == "substitute":
            error_dict["expected"] = op[2] if len(op) > 2 else None
            error_dict["actual"] = actual_phonemes[position] if position < len(actual_phonemes) else None
        elif op_type == "insert":
            error_dict["expected"] = op[2] if len(op) > 2 else None
        elif op_type == "delete":
            error_dict["actual"] = actual_phonemes[position] if position < len(actual_phonemes) else None
        
        # Dummy timestamps - evenly distribute
        if position < len(actual_phonemes):
            start_sample = position * samples_per_phoneme
            end_sample = (position + 1) * samples_per_phoneme if position < len(actual_phonemes) - 1 else total_samples
            error_dict["timestamp"] = {
                "start": int(start_sample),
                "end": int(end_sample)
            }
        else:
            error_dict["timestamp"] = {"start": 0, "end": 4000}  # 0.25s at 16kHz
        
        errors.append(error_dict)
    
    # Calculate score
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
        "actual_ipa": actual_ipa_phonemes,
        "target_ipa": target_ipa,
        "score": score,
        "errors": errors
    }

