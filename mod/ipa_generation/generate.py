"""
Core IPA generation logic using POWSM G2P.
Uses audio-guided grapheme-to-phoneme for accurate pronunciation transcription.
"""
import sys
import os
import urllib.request
import tempfile
import shutil
from typing import Dict, Optional, List, Tuple

# Add parent directory to path to import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


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


def download_audio(audio_uri: str) -> Tuple[str, str]:
    """
    Download audio from URI to a temporary file.
    
    Args:
        audio_uri: URL to audio file
        
    Returns:
        Tuple of (temp_file_path, audio format suffix)
    """
    print(f"DEBUG: Downloading audio from: {audio_uri}")
    
    # Determine file extension from URI
    if '.wav' in audio_uri.lower():
        suffix = '.wav'
    elif '.mp3' in audio_uri.lower():
        suffix = '.mp3'
    elif '.m4a' in audio_uri.lower():
        suffix = '.m4a'
    else:
        suffix = '.wav'  # Default to wav
    
    # Create temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    temp_path = temp_file.name
    temp_file.close()
    
    try:
        # Download audio
        import ssl
        # Create unverified context to avoid SSL errors (especially in dev/docker environments)
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        # Use urlopen instead of urlretrieve to control context, then write to file
        with urllib.request.urlopen(audio_uri, context=ctx) as response, open(temp_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
            
        file_size = os.path.getsize(temp_path)
        print(f"DEBUG: Audio downloaded to {temp_path} ({file_size} bytes)")
        return temp_path, suffix
    except Exception as e:
        print(f"ERROR: Failed to download audio from {audio_uri}: {str(e)}")
        # Clean up empty file if download failed
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise e


# Singleton model instance (loaded once on worker startup)
_g2p_model = None
_device = None


def get_device():
    """
    Detect available device (CUDA if available, otherwise CPU).
    
    Returns:
        "cuda" if CUDA is available, "cpu" otherwise
    """
    global _device
    if _device is None:
        try:
            import torch
            if torch.cuda.is_available():
                _device = "cuda"
                print("DEBUG: CUDA available, using GPU")
            else:
                _device = "cpu"
                print("DEBUG: CUDA not available, using CPU")
        except Exception as e:
            _device = "cpu"
            print(f"DEBUG: Error checking CUDA availability: {e}, using CPU")
    return _device


def get_models(device: Optional[str] = None):
    """
    Load and cache POWSM G2P model.
    
    Args:
        device: Device to load models on ("cuda" or "cpu"). If None, auto-detect.
        
    Returns:
        Tuple of (None, g2p_model) - ASR model not needed when using ground truth text
    """
    global _g2p_model
    
    # Auto-detect device if not specified
    if device is None:
        device = get_device()
    
    if _g2p_model is None:
        from espnet2.bin.s2t_inference import Speech2Text
        
        print(f"DEBUG: Loading POWSM G2P model on device: {device}")
        
        # G2P model (audio-guided grapheme-to-phoneme)
        # Uses audio as primary signal, ground truth text as context
        _g2p_model = Speech2Text.from_pretrained(
            "espnet/powsm",
            device=device,
            lang_sym="<eng>",
            task_sym="<g2p>",
        )
        
        print(f"DEBUG: POWSM G2P model loaded successfully on {device}")
    
    return None, _g2p_model


def generate_ipa_audio_guided(text: str, audio_uri: str, device: Optional[str] = None) -> str:
    """
    Generate IPA from text and audio using POWSM audio-guided G2P.
    
    The audio-guided G2P uses both the text and audio to generate IPA
    that reflects how the speaker actually pronounced the text.
    
    Args:
        text: English text string (ground truth transcript)
        audio_uri: URI to audio file
        device: Device to run inference on ("cuda" or "cpu"). If None, auto-detect.
    
    Returns:
        IPA phonemes string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
    """
    import soundfile as sf
    import time
    
    total_start = time.time()
    
    # Auto-detect device if not specified
    if device is None:
        device = get_device()
    
    print(f"DEBUG: Starting audio-guided G2P for text: '{text}' on device: {device}")
    
    # Download audio from URI
    download_start = time.time()
    temp_path, _ = download_audio(audio_uri)
    download_time = time.time() - download_start
    print(f"DEBUG: Audio download took {download_time:.2f} seconds")
    
    try:
        # Load audio
        load_start = time.time()
        print(f"DEBUG: Reading audio file: {temp_path}")
        speech, rate = sf.read(temp_path)
        load_time = time.time() - load_start
        print(f"DEBUG: Audio read successfully. Sample rate: {rate}, Shape: {speech.shape} (took {load_time:.2f}s)")
        
        # Get G2P model (audio-guided G2P uses audio as primary signal, text as context)
        model_start = time.time()
        _, g2p_model = get_models(device)
        model_time = time.time() - model_start
        print(f"DEBUG: Model retrieval took {model_time:.2f} seconds")
        
        # Audio-guided G2P
        # The audio signal is the primary input for pronunciation
        # The ground truth text provides context/prompt for the G2P model
        # This is faster and more reliable than using ASR output
        inference_start = time.time()
        print("DEBUG: Running audio-guided G2P with ground truth text...")
        result_g2p = g2p_model(speech, text_prev=text)
        inference_time = time.time() - inference_start
        print(f"DEBUG: G2P inference took {inference_time:.2f} seconds")
        ipa_result = result_g2p[0][0]
        print(f"DEBUG: G2P result raw: '{ipa_result}'")
        
        # Post-process G2P output
        if "<notimestamps>" in ipa_result:
            ipa_result = ipa_result.split("<notimestamps>")[1].strip()
        else:
            ipa_result = ipa_result.strip()
            
        print(f"DEBUG: Final IPA result: '{ipa_result}'")
        total_time = time.time() - total_start
        print(f"DEBUG: Total generation time: {total_time:.2f} seconds")
        return ipa_result
        
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_path)
        except:
            pass


def generate_ipa(text: str, audio_uri: Optional[str] = None, device: Optional[str] = None) -> Dict:
    """
    Generate IPA transcription from text and audio.
    
    Args:
        text: English text string
        audio_uri: URI to audio file for audio-guided G2P
        device: Device to run inference on ("cuda" or "cpu")
    
    Returns:
        Dictionary with:
        - ipa_phonemes: str (POWSM format, e.g., "/h//ɛ//l//o//ʊ/")
        - phonemes: List[str] (individual phonemes)
    """
    if not text:
        raise ValueError("text is required")
        
    if not audio_uri:
        raise ValueError("audio_uri is required for audio-guided IPA generation")
    
    # Use audio-guided G2P
    ipa_phonemes = generate_ipa_audio_guided(text, audio_uri, device)
    
    # Parse phonemes from POWSM format
    phonemes = parse_ipa_phonemes(ipa_phonemes)
    
    return {
        "ipa_phonemes": ipa_phonemes,
        "phonemes": phonemes
    }
