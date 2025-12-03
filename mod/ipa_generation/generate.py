"""
Core IPA generation logic using POWSM G2P.
Dummy implementation - returns placeholder IPA.
"""
import sys
import os
from typing import Dict, Optional

# Add parent directory to path to import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


def parse_ipa_phonemes(ipa_phonemes: str) -> list:
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


def generate_ipa_text_only(text: str) -> str:
    """
    Generate IPA from text using POWSM text-only G2P.
    
    DUMMY IMPLEMENTATION: Returns placeholder IPA.
    Replace with actual POWSM G2P model inference.
    
    Args:
        text: English text string
    
    Returns:
        IPA phonemes string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
    """
    # TODO: Replace with actual POWSM G2P model inference
    # Load POWSM model with G2P task
    # Run text-only G2P inference
    # Return ipa_phonemes from model output
    
    # Dummy: return placeholder based on text length
    # In real implementation, this would use espnet/powsm model
    return "/h//ɛ//l//o//ʊ/"


def generate_ipa_audio_guided(text: str, audio_uri: str) -> str:
    """
    Generate IPA from text and audio using POWSM audio-guided G2P.
    
    DUMMY IMPLEMENTATION: Returns placeholder IPA.
    Replace with actual POWSM audio-guided G2P model inference.
    
    Args:
        text: English text string
        audio_uri: URI to audio file
    
    Returns:
        IPA phonemes string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
    """
    # TODO: Replace with actual POWSM audio-guided G2P model inference
    # Load audio from URI
    # from shared.audio import load_audio
    # audio, sr = load_audio(audio_uri)
    
    # Load POWSM model with audio-guided G2P task
    # Run audio-guided G2P inference (more accurate than text-only)
    # Return ipa_phonemes from model output
    
    # Dummy: return placeholder
    # In real implementation, this would use espnet/powsm model with audio input
    return "/h//ɛ//l//o//ʊ/"


def generate_ipa(text: str, audio_uri: Optional[str] = None) -> Dict:
    """
    Generate IPA transcription from text (and optionally audio).
    
    Args:
        text: English text string
        audio_uri: Optional URI to audio file for audio-guided G2P
    
    Returns:
        Dictionary with:
        - ipa_phonemes: str (POWSM format, e.g., "/h//ɛ//l//o//ʊ/")
        - phonemes: List[str] (individual phonemes)
    """
    if not text:
        raise ValueError("text is required")
    
    # Use audio-guided G2P if audio_uri provided, otherwise text-only
    if audio_uri:
        ipa_phonemes = generate_ipa_audio_guided(text, audio_uri)
    else:
        ipa_phonemes = generate_ipa_text_only(text)
    
    # Parse phonemes from POWSM format
    phonemes = parse_ipa_phonemes(ipa_phonemes)
    
    return {
        "ipa_phonemes": ipa_phonemes,
        "phonemes": phonemes
    }

