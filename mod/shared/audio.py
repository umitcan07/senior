"""
Shared audio loading and preprocessing utilities.
Used by both assessment and IPA generation endpoints.
"""
import requests
import tempfile
import os
from typing import Tuple, Optional
import numpy as np


def load_audio(audio_uri: str, target_sr: int = 16000) -> Tuple[np.ndarray, int]:
    """
    Download audio from URI and load as numpy array.
    
    Args:
        audio_uri: URI to audio file (HTTP/HTTPS or S3-compatible)
        target_sr: Target sample rate (default: 16000 Hz)
    
    Returns:
        Tuple of (audio_array, sample_rate)
        audio_array: numpy array of audio samples (mono, float32, normalized)
        sample_rate: actual sample rate of loaded audio
    
    Raises:
        ValueError: If audio_uri is invalid or download fails
        RuntimeError: If audio loading fails
    """
    if not audio_uri:
        raise ValueError("audio_uri is required")
    
    # Download audio file to temporary location
    try:
        response = requests.get(audio_uri, timeout=30)
        response.raise_for_status()
    except requests.RequestException as e:
        raise ValueError(f"Failed to download audio from {audio_uri}: {str(e)}")
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_file:
        tmp_file.write(response.content)
        tmp_path = tmp_file.name
    
    try:
        # Load audio using librosa (handles resampling and mono conversion)
        import librosa
        audio, sr = librosa.load(tmp_path, sr=target_sr, mono=True)
        
        # Normalize to float32 range [-1.0, 1.0]
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)
        
        return audio, sr
    except Exception as e:
        raise RuntimeError(f"Failed to load audio: {str(e)}")
    finally:
        # Clean up temporary file
        if os.path.exists(tmp_path):
            os.unlink(tmp_path)


def get_audio_duration(audio_uri: str) -> float:
    """
    Get duration of audio file in seconds without fully loading it.
    
    Args:
        audio_uri: URI to audio file
    
    Returns:
        Duration in seconds
    """
    try:
        import librosa
        duration = librosa.get_duration(path=audio_uri)
        return duration
    except Exception:
        # Fallback: download and check
        audio, sr = load_audio(audio_uri)
        return len(audio) / sr

