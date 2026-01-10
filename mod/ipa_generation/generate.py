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


# Singleton model instances (loaded once on worker startup)
_g2p_model = None
_asr_model = None


def get_models(device: str = "cuda"):
    """
    Load and cache POWSM models for G2P and ASR tasks.
    
    Args:
        device: Device to load models on ("cuda" or "cpu")
        
    Returns:
        Tuple of (asr_model, g2p_model)
    """
    global _asr_model, _g2p_model
    
    if _asr_model is None or _g2p_model is None:
        from espnet2.bin.s2t_inference import Speech2Text
        
        print("DEBUG: Loading POWSM models...")
        
        # ASR model (needed to get transcript for audio-guided G2P)
        _asr_model = Speech2Text.from_pretrained(
            "espnet/powsm",
            device=device,
            lang_sym="<eng>",
            task_sym="<asr>",
        )
        
        # G2P model (audio-guided grapheme-to-phoneme)
        _g2p_model = Speech2Text.from_pretrained(
            "espnet/powsm",
            device=device,
            lang_sym="<eng>",
            task_sym="<g2p>",
        )
        
        print("DEBUG: POWSM models loaded successfully")
    
    return _asr_model, _g2p_model


def generate_ipa_audio_guided(text: str, audio_uri: str, device: str = "cuda") -> str:
    """
    Generate IPA from text and audio using POWSM audio-guided G2P.
    
    The audio-guided G2P uses both the text and audio to generate IPA
    that reflects how the speaker actually pronounced the text.
    
    Args:
        text: English text string (ground truth transcript)
        audio_uri: URI to audio file
        device: Device to run inference on ("cuda" or "cpu")
    
    Returns:
        IPA phonemes string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
    """
    import soundfile as sf
    
    print(f"DEBUG: Starting audio-guided G2P for text: '{text}'")
    
    # Download audio from URI
    temp_path, _ = download_audio(audio_uri)
    
    try:
        # Load audio
        print(f"DEBUG: Reading audio file: {temp_path}")
        speech, rate = sf.read(temp_path)
        print(f"DEBUG: Audio read successfully. Sample rate: {rate}, Shape: {speech.shape}")
        
        # Get models
        asr_model, g2p_model = get_models(device)
        
        # Step 1: Get ASR transcript (needed as prompt for G2P)
        # We use the ASR output instead of the ground truth text because
        # the G2P needs to match what was actually spoken in the audio
        print("DEBUG: Running ASR step...")
        result_asr = asr_model(speech, text_prev="<na>")
        asr_transcript = result_asr[0][0]
        print(f"DEBUG: ASR transcript: '{asr_transcript}'")
        
        # Post-process ASR output
        if "<notimestamps>" in asr_transcript:
            asr_transcript = asr_transcript.split("<notimestamps>")[1].strip()
        else:
            asr_transcript = asr_transcript.strip()
        
        # Step 2: Audio-guided G2P
        # The text_prev parameter provides context for G2P
        print("DEBUG: Running G2P step...")
        result_g2p = g2p_model(speech, text_prev=asr_transcript)
        ipa_result = result_g2p[0][0]
        print(f"DEBUG: G2P result raw: '{ipa_result}'")
        
        # Post-process G2P output
        if "<notimestamps>" in ipa_result:
            ipa_result = ipa_result.split("<notimestamps>")[1].strip()
        else:
            ipa_result = ipa_result.strip()
            
        print(f"DEBUG: Final IPA result: '{ipa_result}'")
        return ipa_result
        
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_path)
        except:
            pass


def generate_ipa(text: str, audio_uri: Optional[str] = None, device: str = "cuda") -> Dict:
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
