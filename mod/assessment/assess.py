"""
Core assessment logic for pronunciation evaluation.
Uses POWSM PR (Phone Recognition) and MFA for time alignment.
"""
import sys
import os
import tempfile
import subprocess
import urllib.request
import shutil
from typing import Dict, List, Optional, Tuple
import numpy as np
import soundfile as sf
import librosa

# Add parent directory to path to import shared modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from shared.audio import load_audio
from edit_distance import edit_operations


# ============================================================================
# SIGNAL QUALITY CHECKS
# ============================================================================

def check_signal_quality(audio: np.ndarray, sample_rate: int) -> Dict:
    """
    Analyze audio signal quality and return metrics.
    
    Checks for:
    - RMS level (too quiet or too loud)
    - Clipping (samples at max amplitude)
    - Silence ratio (percentage of silent frames)
    - Estimated SNR (signal-to-noise ratio)
    
    Args:
        audio: Audio samples as numpy array (mono, normalized to [-1, 1])
        sample_rate: Sample rate in Hz
    
    Returns:
        Dict with:
        - is_acceptable: bool (True if quality is acceptable)
        - quality_score: float (0.0-1.0)
        - rms_db: float (RMS level in dB)
        - clipping_ratio: float (ratio of clipped samples)
        - silence_ratio: float (ratio of silent frames)
        - snr_estimate_db: float (estimated SNR in dB)
        - warnings: List[str] (quality issues found)
        - suggestions: List[str] (how to fix issues)
    """
    warnings = []
    suggestions = []
    
    # Ensure mono audio
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)
    
    # Normalize to float if needed
    if audio.dtype != np.float32 and audio.dtype != np.float64:
        audio = audio.astype(np.float32) / np.iinfo(audio.dtype).max
    
    # 1. RMS Level
    rms = np.sqrt(np.mean(audio ** 2))
    rms_db = 20 * np.log10(rms + 1e-10)  # Add epsilon to avoid log(0)
    
    # Target RMS: -20dB to -6dB is typical for speech
    if rms_db < -40:
        warnings.append("audio_too_quiet")
        suggestions.append("Speak louder or move closer to the microphone")
    elif rms_db < -30:
        warnings.append("audio_quiet")
        suggestions.append("Consider speaking slightly louder")
    elif rms_db > -3:
        warnings.append("audio_too_loud")
        suggestions.append("Move away from the microphone or reduce input gain")
    
    # 2. Clipping Detection
    clip_threshold = 0.99
    clipped_samples = np.sum(np.abs(audio) >= clip_threshold)
    clipping_ratio = clipped_samples / len(audio)
    
    if clipping_ratio > 0.01:  # More than 1% clipped
        warnings.append("severe_clipping")
        suggestions.append("Reduce recording volume to avoid distortion")
    elif clipping_ratio > 0.001:  # More than 0.1% clipped
        warnings.append("minor_clipping")
        suggestions.append("Consider reducing recording volume slightly")
    
    # 3. Silence Detection (using frame-based energy)
    frame_size = int(0.025 * sample_rate)  # 25ms frames
    hop_size = int(0.010 * sample_rate)    # 10ms hop
    
    num_frames = max(1, (len(audio) - frame_size) // hop_size + 1)
    frame_energies = []
    
    for i in range(num_frames):
        start = i * hop_size
        end = min(start + frame_size, len(audio))
        frame = audio[start:end]
        energy = np.sum(frame ** 2)
        frame_energies.append(energy)
    
    frame_energies = np.array(frame_energies)
    
    # Consider frames with energy < 1% of max as silence
    energy_threshold = np.max(frame_energies) * 0.01 if len(frame_energies) > 0 else 0
    silent_frames = np.sum(frame_energies < energy_threshold)
    silence_ratio = silent_frames / max(1, len(frame_energies))
    
    if silence_ratio > 0.7:
        warnings.append("mostly_silence")
        suggestions.append("Make sure to speak during the recording")
    elif silence_ratio > 0.5:
        warnings.append("excessive_silence")
        suggestions.append("Try to fill more of the recording with speech")
    
    # 4. SNR Estimation (simple method: signal power vs noise floor)
    # Estimate noise from the quietest 10% of frames
    if len(frame_energies) > 10:
        sorted_energies = np.sort(frame_energies)
        noise_floor = np.mean(sorted_energies[:len(sorted_energies) // 10])
        signal_power = np.mean(sorted_energies[len(sorted_energies) // 2:])  # Top 50%
        
        if noise_floor > 0:
            snr_estimate_db = 10 * np.log10((signal_power + 1e-10) / (noise_floor + 1e-10))
        else:
            snr_estimate_db = 40.0  # Assume good SNR if noise floor is 0
    else:
        snr_estimate_db = 20.0  # Default estimate for very short audio
    
    if snr_estimate_db < 10:
        warnings.append("low_snr")
        suggestions.append("Record in a quieter environment or use a better microphone")
    elif snr_estimate_db < 15:
        warnings.append("moderate_noise")
        suggestions.append("Consider reducing background noise")
    
    # 5. Duration check
    duration = len(audio) / sample_rate
    if duration < 0.5:
        warnings.append("too_short")
        suggestions.append("Recording is very short, speak longer for better analysis")
    elif duration > 30:
        warnings.append("too_long")
        suggestions.append("Recording is long, consider shorter segments for faster processing")
    
    # Calculate overall quality score
    quality_score = 1.0
    
    # Deduct for issues
    if "audio_too_quiet" in warnings:
        quality_score -= 0.3
    elif "audio_quiet" in warnings:
        quality_score -= 0.1
    if "audio_too_loud" in warnings:
        quality_score -= 0.2
    if "severe_clipping" in warnings:
        quality_score -= 0.4
    elif "minor_clipping" in warnings:
        quality_score -= 0.1
    if "mostly_silence" in warnings:
        quality_score -= 0.5
    elif "excessive_silence" in warnings:
        quality_score -= 0.2
    if "low_snr" in warnings:
        quality_score -= 0.3
    elif "moderate_noise" in warnings:
        quality_score -= 0.1
    if "too_short" in warnings:
        quality_score -= 0.2
    
    quality_score = max(0.0, quality_score)
    
    # Determine if acceptable
    is_acceptable = quality_score >= 0.5 and "mostly_silence" not in warnings
    
    return {
        "is_acceptable": is_acceptable,
        "quality_score": round(quality_score, 2),
        "rms_db": round(rms_db, 1),
        "clipping_ratio": round(clipping_ratio, 4),
        "silence_ratio": round(silence_ratio, 2),
        "snr_estimate_db": round(snr_estimate_db, 1),
        "duration_seconds": round(duration, 2),
        "warnings": warnings,
        "suggestions": suggestions,
    }


# ============================================================================
# TIMESTAMP ESTIMATION (when MFA is not available)
# ============================================================================

def estimate_phoneme_timestamps(
    phonemes: List[str],
    audio_duration: float,
    speech_start: float = 0.0,
    speech_end: Optional[float] = None,
) -> List[Dict]:
    """
    Estimate timestamps for phonemes when MFA is not available.
    
    Uses proportional distribution based on phoneme complexity:
    - Vowels and diphthongs: longer duration (weight 1.5)
    - Consonants: shorter duration (weight 1.0)
    - Stops and affricates: very short (weight 0.7)
    
    Args:
        phonemes: List of IPA phoneme strings
        audio_duration: Total audio duration in seconds
        speech_start: Estimated speech start time (default 0.0)
        speech_end: Estimated speech end time (default: audio_duration)
    
    Returns:
        List of dicts with 'phone', 'start', 'end' keys
    """
    if not phonemes:
        return []
    
    if speech_end is None:
        speech_end = audio_duration
    
    speech_duration = speech_end - speech_start
    
    # Phoneme duration weights based on type
    vowels = set("aɑæɐeɛəɜiɪoɔuʊʌyœøɨʉɯɤɵɞ")
    diphthongs = {"aɪ", "eɪ", "ɔɪ", "aʊ", "oʊ", "ɪə", "eə", "ʊə"}
    stops = set("pbtdkgʔ")
    affricates = {"tʃ", "dʒ", "ts", "dz"}
    nasals = set("mnŋɲɱ")
    approximants = set("wjɹlɾɻ")
    fricatives = set("fvθðszʃʒhxɣçʁχħʕ")
    
    # Calculate weights for each phoneme
    weights = []
    for p in phonemes:
        p_lower = p.lower()
        
        if p_lower in diphthongs or len(p) > 1 and any(c in vowels for c in p):
            # Diphthongs and complex vowels
            weights.append(1.8)
        elif p_lower in vowels or any(c in vowels for c in p_lower):
            # Simple vowels
            weights.append(1.5)
        elif p_lower in affricates:
            # Affricates (two-part sounds)
            weights.append(1.2)
        elif p_lower in nasals or any(c in nasals for c in p_lower):
            # Nasals
            weights.append(1.1)
        elif p_lower in approximants or any(c in approximants for c in p_lower):
            # Approximants
            weights.append(1.0)
        elif p_lower in fricatives or any(c in fricatives for c in p_lower):
            # Fricatives
            weights.append(0.9)
        elif p_lower in stops or any(c in stops for c in p_lower):
            # Stops (very short)
            weights.append(0.7)
        else:
            # Default weight
            weights.append(1.0)
    
    # Normalize weights to sum to speech duration
    total_weight = sum(weights)
    if total_weight == 0:
        total_weight = len(phonemes)
        weights = [1.0] * len(phonemes)
    
    # Calculate timestamps
    alignments = []
    current_time = speech_start
    
    for i, (phoneme, weight) in enumerate(zip(phonemes, weights)):
        duration = (weight / total_weight) * speech_duration
        
        alignments.append({
            "phone": phoneme,
            "start": round(current_time, 3),
            "end": round(current_time + duration, 3),
            "estimated": True,  # Flag that this is estimated, not from MFA
        })
        
        current_time += duration
    
    return alignments


def estimate_speech_boundaries(audio: np.ndarray, sample_rate: int) -> Tuple[float, float]:
    """
    Estimate speech start and end times from audio using energy analysis.
    
    Args:
        audio: Audio samples as numpy array
        sample_rate: Sample rate in Hz
    
    Returns:
        Tuple of (speech_start, speech_end) in seconds
    """
    # Ensure mono
    if len(audio.shape) > 1:
        audio = np.mean(audio, axis=1)
    
    duration = len(audio) / sample_rate
    
    # Frame-based energy analysis
    frame_size = int(0.025 * sample_rate)  # 25ms
    hop_size = int(0.010 * sample_rate)    # 10ms
    
    num_frames = max(1, (len(audio) - frame_size) // hop_size + 1)
    frame_energies = []
    frame_times = []
    
    for i in range(num_frames):
        start = i * hop_size
        end = min(start + frame_size, len(audio))
        frame = audio[start:end]
        energy = np.sqrt(np.mean(frame ** 2))
        frame_energies.append(energy)
        frame_times.append(start / sample_rate)
    
    if not frame_energies:
        return 0.0, duration
    
    frame_energies = np.array(frame_energies)
    frame_times = np.array(frame_times)
    
    # Threshold: 10% of max energy
    threshold = np.max(frame_energies) * 0.1
    
    # Find first frame above threshold
    speech_frames = np.where(frame_energies > threshold)[0]
    
    if len(speech_frames) == 0:
        return 0.0, duration
    
    speech_start = frame_times[speech_frames[0]]
    speech_end = frame_times[speech_frames[-1]] + frame_size / sample_rate
    
    # Add small buffer
    speech_start = max(0.0, speech_start - 0.05)
    speech_end = min(duration, speech_end + 0.05)
    
    return speech_start, speech_end


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


def powsm_to_mfa_format(powsm_ipa: str) -> str:
    """Convert POWSM format to MFA space-separated format."""
    phones = parse_ipa_phonemes(powsm_ipa)
    return ' '.join(phones)


# Singleton model instances (loaded once on worker startup)
_pr_model = None
_g2p_model = None
_asr_model = None
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
    Load and cache POWSM models for PR, G2P, and ASR tasks.
    
    Args:
        device: Device to load models on ("cuda" or "cpu"). If None, auto-detect.
        
    Returns:
        Tuple of (pr_model, g2p_model, asr_model)
    """
    global _pr_model, _g2p_model, _asr_model
    
    # Auto-detect device if not specified
    if device is None:
        device = get_device()
    
    if _pr_model is None or _g2p_model is None or _asr_model is None:
        from espnet2.bin.s2t_inference import Speech2Text
        
        print(f"DEBUG: Loading POWSM models on device: {device}")
        
        # PR model (Phone Recognition: Audio → IPA)
        _pr_model = Speech2Text.from_pretrained(
            "espnet/powsm",
            device=device,
            lang_sym="<eng>",
            task_sym="<pr>",
        )
        
        # G2P model (Grapheme-to-Phoneme: Text → IPA)
        _g2p_model = Speech2Text.from_pretrained(
            "espnet/powsm",
            device=device,
            lang_sym="<eng>",
            task_sym="<g2p>",
        )

        # ASR model (Automatic Speech Recognition: Audio → Text)
        # Use beam_size=5 for better accuracy (default is usually 3, but higher can help)
        _asr_model = Speech2Text.from_pretrained(
            "espnet/powsm",
            device=device,
            lang_sym="<eng>",
            task_sym="<asr>",
            beam_size=5,  # Increase from default 3 for better accuracy
        )
        
        print(f"DEBUG: POWSM models loaded successfully on {device}")
    
    return _pr_model, _g2p_model, _asr_model


def extract_ipa_from_audio(audio_uri: str, device: Optional[str] = None) -> str:
    """
    Extract IPA transcription from audio using POWSM PR model.
    
    Args:
        audio_uri: URI to audio file
        device: Device to run inference on ("cuda" or "cpu"). If None, auto-detect.
    
    Returns:
        IPA phonemes string in POWSM format (e.g., "/h//ɛ//l//o//ʊ/")
    """
    import time
    
    # Auto-detect device if not specified
    if device is None:
        device = get_device()
    
    print(f"DEBUG: Starting PR inference on device: {device}")
    
    # Download audio from URI
    download_start = time.time()
    temp_path, _ = download_audio(audio_uri)
    download_time = time.time() - download_start
    print(f"DEBUG: Audio download took {download_time:.2f} seconds")
    
    try:
    # Load audio using librosa (handles WebM, WAV, MP3, etc. via ffmpeg)
    # IMPORTANT: POWSM model expects 16kHz audio
        load_start = time.time()
        speech, rate = librosa.load(temp_path, sr=16000, mono=True)
        load_time = time.time() - load_start
        print(f"DEBUG: Audio loaded. Sample rate: {rate}Hz, Shape: {speech.shape}, Duration: {len(speech)/rate:.2f}s (took {load_time:.2f}s)")
        print(f"DEBUG: Audio stats - min: {speech.min():.4f}, max: {speech.max():.4f}, mean: {speech.mean():.4f}, std: {speech.std():.4f}")
        
        # Get PR model
        pr_model, _, _ = get_models(device)
        
        # Run PR inference
        inference_start = time.time()
        print("DEBUG: Running PR inference...")
        result_pr = pr_model(speech, text_prev="<na>")
        inference_time = time.time() - inference_start
        print(f"DEBUG: PR inference took {inference_time:.2f} seconds")
        
        ipa_result = result_pr[0][0]
        print(f"DEBUG: PR result raw: '{ipa_result}'")
        
        # Post-process PR output
        if "<notimestamps>" in ipa_result:
            ipa_result = ipa_result.split("<notimestamps>")[1].strip()
        else:
            ipa_result = ipa_result.strip()
            
        print(f"DEBUG: Final PR result: '{ipa_result}'")
        return ipa_result
        
    finally:
        # Clean up temporary file
        try:
            os.unlink(temp_path)
        except:
            pass


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
    elif '.webm' in audio_uri.lower():
        suffix = '.webm'
    elif '.ogg' in audio_uri.lower():
        suffix = '.ogg'
    else:
        suffix = '.webm'  # Default to webm since browsers record WebM
    
    # Create temporary file
    temp_file = tempfile.NamedTemporaryFile(suffix=suffix, delete=False)
    temp_path = temp_file.name
    temp_file.close()
    
    try:
        # Download audio
        import ssl
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        
        with urllib.request.urlopen(audio_uri, context=ctx) as response, open(temp_path, 'wb') as out_file:
            shutil.copyfileobj(response, out_file)
            
        file_size = os.path.getsize(temp_path)
        print(f"DEBUG: Audio downloaded to {temp_path} ({file_size} bytes)")
        return temp_path, suffix
    except Exception as e:
        print(f"ERROR: Failed to download audio from {audio_uri}: {str(e)}")
        if os.path.exists(temp_path):
            os.unlink(temp_path)
        raise e


def run_mfa_alignment(
    audio_file: str,
    transcription: str,
    temp_base: str,
    mfa_command: str = "mfa",
    env: Optional[dict] = None,
    dictionary_id: str = "english_us_mfa",
    acoustic_id: str = "english_mfa",
) -> Dict:
    """
    Run MFA alignment for a given transcription and return alignments.
    
    MFA models and dictionaries are cached in MFA_ROOT_DIRECTORY (network volume if available).
    """
    """
    Run MFA alignment for a given transcription and return alignments.
    
    Args:
        audio_file: Path to audio file
        transcription: Text transcription to align
        temp_base: Base directory for temporary files
        mfa_command: MFA command to use (default: "mfa")
        env: Environment variables dict (optional)
        dictionary_id: MFA dictionary ID (default: "english_us_mfa")
        acoustic_id: MFA acoustic model ID (default: "english_mfa")
    
    Returns:
        Dictionary with:
        - alignments: List[Dict] with phone, start, end
        - quality: Dict with quality metrics
    """
    if not transcription:
        return {
            "alignments": [],
            "quality": {"quality_score": 0.0, "warnings": ["empty_transcription"]},
        }
    
    corpus_dir = os.path.join(temp_base, "corpus")
    output_dir = os.path.join(temp_base, "output")
    os.makedirs(corpus_dir, exist_ok=True)
    os.makedirs(output_dir, exist_ok=True)
    
    # Copy audio to corpus directory
    audio_basename = os.path.splitext(os.path.basename(audio_file))[0]
    audio_in_corpus = os.path.join(corpus_dir, f"{audio_basename}.wav")
    shutil.copy(audio_file, audio_in_corpus)
    
    # Write transcription file
    transcription_file = os.path.join(corpus_dir, f"{audio_basename}.txt")
    with open(transcription_file, 'w') as f:
        f.write(transcription)
    
    # Run MFA align
    # Use temp directory in temp_base for MFA temporary files
    mfa_temp_dir = os.path.join(temp_base, "mfa_temp")
    os.makedirs(mfa_temp_dir, exist_ok=True)
    
    cmd = [
        mfa_command,
        "align",
        corpus_dir,
        dictionary_id,
        acoustic_id,
        output_dir,
        "--clean",
        "--beam",
        "400",
        "--retry_beam",
        "1600",
        "--temp_directory",
        mfa_temp_dir,
    ]
    
    env_dict = env.copy() if env else os.environ.copy()
    
    # Set MFA root directory (use network volume if available)
    # MFA_ROOT_DIR stores dictionaries, acoustic models, and configuration
    network_volume_path = "/runpod-volume"
    if os.path.exists(network_volume_path):
        mfa_root_dir = os.path.join(network_volume_path, ".cache", "mfa")
        os.makedirs(mfa_root_dir, exist_ok=True)
        env_dict["MFA_ROOT_DIR"] = mfa_root_dir
        print(f"DEBUG: Using network volume for MFA root directory at {mfa_root_dir}")
    else:
        # Use default MFA root location (~/Documents/MFA)
        mfa_root_dir = os.path.expanduser("~/Documents/MFA")
        env_dict["MFA_ROOT_DIR"] = mfa_root_dir
        print(f"DEBUG: Using default MFA root directory at {mfa_root_dir}")
    
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            env=env_dict,
            timeout=300,  # 5 minute timeout
        )
        
        # Parse TextGrid output
        textgrid_path = os.path.join(output_dir, f"{audio_basename}.TextGrid")
        alignments = []
        
        if os.path.exists(textgrid_path):
            alignments = parse_textgrid(textgrid_path)
        
        return {
            "alignments": alignments,
            "quality": {
                "quality_score": 1.0 if alignments else 0.0,
                "warnings": [] if alignments else ["no_alignments"],
            },
            "stdout": result.stdout,
            "stderr": result.stderr,
            "returncode": result.returncode,
        }
    except subprocess.TimeoutExpired:
        return {
            "alignments": [],
            "quality": {"quality_score": 0.0, "warnings": ["timeout"]},
        }
    except Exception as e:
        print(f"ERROR: MFA alignment failed: {e}")
        return {
            "alignments": [],
            "quality": {"quality_score": 0.0, "warnings": [str(e)]},
        }


def parse_textgrid(textgrid_path: str) -> List[Dict]:
    """
    Parse TextGrid file and extract phone alignments.
    
    Args:
        textgrid_path: Path to TextGrid file
    
    Returns:
        List of dicts with 'phone', 'start', 'end' keys
    """
    alignments = []
    try:
        # Try using textgrid library first (more reliable)
        try:
            from textgrid import TextGrid
            tg = TextGrid.fromFile(textgrid_path)
            for tier in tg.tiers:
                if tier.name.lower() in ["phones", "phone"]:
                    for interval in tier:
                        if interval.mark.strip():
                            alignments.append({
                                "phone": interval.mark.strip(),
                                "start": interval.minTime,
                                "end": interval.maxTime,
                            })
                    break
            return alignments
        except ImportError:
            # Fallback to manual parsing if textgrid library not available
            pass
        
        # Manual TextGrid parser (fallback)
        with open(textgrid_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Find phone tier
        in_phone_tier = False
        i = 0
        
        while i < len(lines):
            line = lines[i].strip()
            
            if 'name = "phones"' in line or 'name = "Phones"' in line:
                in_phone_tier = True
                # Skip to intervals
                while i < len(lines) and 'intervals [' not in lines[i]:
                    i += 1
                continue
            
            if in_phone_tier and 'intervals [' in line:
                # Parse interval
                if i + 3 < len(lines):
                    start_line = lines[i + 1].strip()
                    end_line = lines[i + 2].strip()
                    text_line = lines[i + 3].strip()
                    
                    if 'xmin' in start_line and 'xmax' in end_line and 'text' in text_line:
                        try:
                            start = float(start_line.split('=')[1].strip())
                            end = float(end_line.split('=')[1].strip())
                            phone = text_line.split('=')[1].strip().strip('"')
                            
                            if phone and phone != '':
                                alignments.append({
                                    "phone": phone,
                                    "start": start,
                                    "end": end,
                                })
                        except (ValueError, IndexError):
                            pass
                        i += 4
                        continue
            
            i += 1
        
        return alignments
    except Exception as e:
        print(f"ERROR: Failed to parse TextGrid: {e}")
        import traceback
        traceback.print_exc()
        return []


def assess(audio_uri: str, target_text: str, target_ipa: Optional[str] = None, device: Optional[str] = None) -> Dict:
    """
    Assess pronunciation by comparing actual vs target IPA.
    
    Args:
        audio_uri: URI to audio file
        target_text: Target text (ground truth transcript)
        target_ipa: Optional target IPA (if not provided, will generate with G2P)
        device: Device to run inference on ("cuda" or "cpu"). If None, auto-detect.
    
    Returns:
        Dictionary with:
        - actual_ipa: str (detected IPA from PR)
        - target_ipa: str (target IPA from G2P)
        - score: float (0.0-1.0)
        - errors: List[Dict] (errors with timestamps from MFA)
    """
    import time
    
    total_start = time.time()
    
    # Auto-detect device if not specified
    if device is None:
        device = get_device()
    
    print(f"DEBUG: Starting assessment on device: {device}")
    
    # Step 1: Extract actual pronunciation from audio using PR
    print("DEBUG: Step 1: Phone Recognition (PR)...")
    actual_ipa_phonemes = extract_ipa_from_audio(audio_uri, device)
    print(f"DEBUG: Raw actual IPA from PR: '{actual_ipa_phonemes[:100]}...'" if len(actual_ipa_phonemes) > 100 else f'DEBUG: Raw actual IPA from PR: {actual_ipa_phonemes}')
    actual_phonemes = parse_ipa_phonemes(actual_ipa_phonemes)
    print(f"DEBUG: Detected {len(actual_phonemes)} phones from PR")
    print(f"DEBUG: Actual phonemes list: {actual_phonemes[:20]}..." if len(actual_phonemes) > 20 else f"DEBUG: Actual phonemes list: {actual_phonemes}")
    
    # Step 2: Generate target pronunciation from text using G2P
    print("DEBUG: Step 2: Grapheme-to-Phoneme (G2P)...")
    if target_ipa is None:
        # Download audio for G2P (audio-guided)
        temp_path, _ = download_audio(audio_uri)
        try:
            speech, rate = librosa.load(temp_path, sr=16000, mono=True)
            _, g2p_model, _ = get_models(device)
            result_g2p = g2p_model(speech, text_prev=target_text)
            target_ipa_phonemes = result_g2p[0][0]
            if "<notimestamps>" in target_ipa_phonemes:
                target_ipa_phonemes = target_ipa_phonemes.split("<notimestamps>")[1].strip()
            else:
                target_ipa_phonemes = target_ipa_phonemes.strip()
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass
    else:
        target_ipa_phonemes = target_ipa
    
    target_phonemes = parse_ipa_phonemes(target_ipa_phonemes)
    print(f"DEBUG: Target {len(target_phonemes)} phones from G2P")
    print(f"DEBUG: Raw target IPA: '{target_ipa_phonemes[:100]}...' if len(target_ipa_phonemes) > 100 else f'DEBUG: Raw target IPA: '{target_ipa_phonemes}'")
    
    # Step 3: Run edit distance to find errors
    print(f"DEBUG: Running edit distance: actual ({len(actual_phonemes)}) vs target ({len(target_phonemes)})")
    operations = edit_operations(actual_phonemes, target_phonemes)
    print(f"DEBUG: Edit distance found {len(operations)} operations")
    
    # Step 4: Get audio for signal quality checks and timestamp estimation
    print("DEBUG: Step 4: Downloading audio for analysis...")
    temp_path, _ = download_audio(audio_uri)
    try:
        speech, rate = librosa.load(temp_path, sr=16000, mono=True)
        audio_duration = len(speech) / rate
        
        # Signal quality check
        print("DEBUG: Step 5: Signal quality analysis...")
        signal_quality = check_signal_quality(speech, rate)
        print(f"DEBUG: Signal quality score: {signal_quality['quality_score']}, warnings: {signal_quality['warnings']}")
        
        # Estimate speech boundaries for better timestamp estimation
        speech_start, speech_end = estimate_speech_boundaries(speech, rate)
        print(f"DEBUG: Estimated speech boundaries: {speech_start:.2f}s - {speech_end:.2f}s")
        
        # Run ASR
        print("DEBUG: Step 5b: Running ASR...")
        print(f"DEBUG: ASR input audio stats - shape: {speech.shape}, duration: {len(speech)/rate:.2f}s, sample rate: {rate}Hz")
        print(f"DEBUG: ASR input audio stats - min: {speech.min():.4f}, max: {speech.max():.4f}, mean: {speech.mean():.4f}, std: {speech.std():.4f}")
        
        _, _, asr_model = get_models(device)
        
        # Use target text as context to improve ASR accuracy
        # This helps the model better recognize words, especially at the start
        # Note: text_prev provides context but doesn't force exact matches - the model
        # will still output what it hears, but with better word recognition
        asr_text_prev = target_text if target_text else "<na>"
        print(f"DEBUG: ASR using text_prev: '{asr_text_prev[:50]}...'" if len(asr_text_prev) > 50 else f"DEBUG: ASR using text_prev: '{asr_text_prev}'")
        
        # Run ASR with target text as context
        result_asr = asr_model(speech, text_prev=asr_text_prev)
        actual_text_raw = result_asr[0][0]
        
        # Clean tags from ASR output
        actual_text = actual_text_raw
        if "<notimestamps>" in actual_text:
            actual_text = actual_text.split("<notimestamps>")[1].strip()
        
        # Remove other potential tags loosely
        actual_text = actual_text.replace("<eng>", "").replace("<asr>", "").strip()
        
        # Remove other potential tags loosely (duplicate line removed)
        
        print(f"DEBUG: ASR result raw: '{actual_text_raw}'")
        print(f"DEBUG: ASR result cleaned: '{actual_text}'")
        
        # Compare with PR results to see if phonemes match
        print(f"DEBUG: Comparing ASR vs PR:")
        print(f"DEBUG:   PR detected phonemes: {actual_phonemes[:10]}..." if len(actual_phonemes) > 10 else f"DEBUG:   PR detected phonemes: {actual_phonemes}")
        print(f"DEBUG:   ASR detected text: '{actual_text}'")
        print(f"DEBUG:   Target text: '{target_text}'")
        
        # Debug characters
        print(f"DEBUG: ASR raw chars: {[f'{c}: {ord(c):04x}' for c in actual_text_raw[:50]]}")

        # Step 5c: Word-level comparison
        print("DEBUG: Step 5c: Word-level comparison...")
        def normalize_text_to_list(text):
            # Convert to lowercase and remove punctuation
            import string
            import re
            text = text.lower()
            # Remove punctuation except apostrophes within words
            text = re.sub(r'[^\w\s\']', '', text)
            return text.split()
            
        def normalize_text_string(text):
            import string
            import re
            text = text.lower()
            text = re.sub(r'[^\w\s\']', '', text)
            # Collapse whitespace
            return ' '.join(text.split())

        normalized_target_words = normalize_text_to_list(target_text)
        normalized_actual_words = normalize_text_to_list(actual_text)
        
        target_text_normalized = normalize_text_string(target_text)
        actual_text_normalized = normalize_text_string(actual_text)
        
        print(f"DEBUG: Normalized target words: {normalized_target_words}")
        print(f"DEBUG: Normalized actual words: {normalized_actual_words}")
        
        word_operations = edit_operations(normalized_actual_words, normalized_target_words)
        
        word_errors = []
        for op in word_operations:
            op_type = op[0]
            position = op[1]
            
            error_dict = {
                "type": op_type,
                "position": position
            }
            
            if op_type == "substitute":
                error_dict["expected"] = op[2] if len(op) > 2 else None
                error_dict["actual"] = normalized_actual_words[position] if position < len(normalized_actual_words) else None
            elif op_type == "insert":
                error_dict["actual"] = normalized_actual_words[position] if position < len(normalized_actual_words) else None
            elif op_type == "delete":
                error_dict["expected"] = op[2] if len(op) > 2 else None
            
            # TODO: Add timestamp estimation for words
            # For now, we'll leave timestamps null or estimate proportionally
            word_errors.append(error_dict)
            
        # Calculate word score
        # Use accuracy-based scoring: (correct_words / total_words)
        # Where correct_words = total_words - deletions - substitutions
        total_words = len(normalized_target_words)
        if total_words == 0:
            word_score = 1.0 if len(normalized_actual_words) == 0 else 0.0
        else:
            # Count errors
            deletions = sum(1 for op in word_operations if op[0] == "delete")
            substitutions = sum(1 for op in word_operations if op[0] == "substitute")
            # Correct words are those that weren't deleted or substituted
            correct_words = total_words - deletions - substitutions
            word_score = max(0.0, correct_words / total_words)
            
        print(f"DEBUG: Found {len(word_errors)} word errors, score: {word_score:.4f}")

    finally:
        try:
            os.unlink(temp_path)
        except:
            pass
    
    # Step 5: MFA alignment or timestamp estimation
    print("DEBUG: Step 6: Alignment/Timestamp estimation...")
    estimated_alignments = []
    mfa_alignments = []
    use_mfa = False
    
    # Check if MFA is available
    mfa_command = "mfa"
    mfa_paths = [
        "mfa",  # In PATH (should work if conda env is in PATH)
        "/opt/conda/envs/mfa-env/bin/mfa",  # MFA conda environment (created in Dockerfile)
        "/opt/conda/envs/mfa/bin/mfa",  # Alternative MFA conda environment name
        "/opt/conda/envs/worker/bin/mfa",  # Worker conda environment
        "/opt/conda/bin/mfa",  # Base conda
    ]
    
    for mfa_path in mfa_paths:
        try:
            result = subprocess.run([mfa_path, "version"], capture_output=True, timeout=5)
            if result.returncode == 0:
                use_mfa = True
                mfa_command = mfa_path
                print(f"DEBUG: MFA is available at {mfa_command}")
                break
        except:
            continue
    
    if use_mfa:
        # Use MFA for precise alignment
        temp_path, _ = download_audio(audio_uri)
        try:
            with tempfile.TemporaryDirectory() as temp_base:
                actual_transcription = powsm_to_mfa_format(actual_ipa_phonemes)
                actual_result = run_mfa_alignment(
                    audio_file=temp_path,
                    transcription=actual_transcription,
                    temp_base=temp_base,
                    mfa_command=mfa_command,
                )
                mfa_alignments = actual_result.get("alignments", [])
                print(f"DEBUG: MFA aligned {len(mfa_alignments)} phones")
        finally:
            try:
                os.unlink(temp_path)
            except:
                pass
    else:
        # Use proportional timestamp estimation
        print("DEBUG: MFA not available, using proportional timestamp estimation")
        estimated_alignments = estimate_phoneme_timestamps(
            actual_phonemes,
            audio_duration,
            speech_start=speech_start,
            speech_end=speech_end,
        )
        print(f"DEBUG: Estimated timestamps for {len(estimated_alignments)} phones")
    
    # Use whichever alignments are available
    alignments = mfa_alignments if mfa_alignments else estimated_alignments
    
    # Map errors to timestamps
    errors = []
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
        
        # Get timestamp from alignments
        # Note: 'delete' errors (User Deletion) use Target Index for position, so we cannot 
        # look up timestamp in Actual Alignments (which aligns to Actual Index).
        # For now, we omit timestamp for deletions.
        if op_type != "delete" and alignments and position < len(alignments):
            alignment = alignments[position]
            error_dict["timestamp"] = {
                "start": alignment.get("start", 0.0),
                "end": alignment.get("end", 0.0),
                "estimated": alignment.get("estimated", not use_mfa),
            }
        else:
            # Fallback: proportional estimate based on position
            if actual_phonemes:
                progress = position / len(actual_phonemes)
                start_time = speech_start + progress * (speech_end - speech_start)
                phone_duration = (speech_end - speech_start) / max(1, len(actual_phonemes))
                error_dict["timestamp"] = {
                    "start": round(start_time, 3),
                    "end": round(start_time + phone_duration, 3),
                    "estimated": True,
                }
            else:
                error_dict["timestamp"] = {
                    "start": 0.0,
                    "end": 0.0,
                    "estimated": True,
                }
        
        errors.append(error_dict)
    
    # Calculate score using accuracy-based approach
    # Score = (correct_phonemes / total_phonemes)
    # Where correct_phonemes = total_phonemes - deletions - substitutions
    total_phonemes = len(target_phonemes)
    total_actual_phonemes = len(actual_phonemes)
    
    print(f"DEBUG: Scoring calculation:")
    print(f"DEBUG:   Target phonemes: {len(target_phonemes)}")
    print(f"DEBUG:   Actual phonemes: {len(actual_phonemes)}")
    print(f"DEBUG:   Target phoneme list: {target_phonemes[:40]}..." if len(target_phonemes) > 40 else f"DEBUG:   Target phoneme list: {target_phonemes}")
    print(f"DEBUG:   Actual phoneme list: {actual_phonemes[:40]}..." if len(actual_phonemes) > 40 else f"DEBUG:   Actual phoneme list: {actual_phonemes}")
    print(f"DEBUG:   Total operations: {len(operations)}")
    
    if total_phonemes == 0:
        score = 1.0 if len(actual_phonemes) == 0 else 0.0
        print(f"DEBUG:   Score (edge case): {score}")
    else:
        # Count errors
        deletions = sum(1 for op in operations if op[0] == "delete")
        substitutions = sum(1 for op in operations if op[0] == "substitute")
        insertions = sum(1 for op in operations if op[0] == "insert")
        
        print(f"DEBUG:   Deletions: {deletions}")
        print(f"DEBUG:   Substitutions: {substitutions}")
        print(f"DEBUG:   Insertions: {insertions}")
        
        # Correct phonemes are those that weren't deleted or substituted
        # This counts how many target phonemes were correctly matched
        correct_phonemes = total_phonemes - deletions - substitutions
        
        print(f"DEBUG:   Correct phonemes (target - deletions - substitutions): {correct_phonemes} = {total_phonemes} - {deletions} - {substitutions}")
        
        # Verify: matches + deletions + substitutions should equal total_phonemes
        matches_implied = correct_phonemes
        total_accounted = matches_implied + deletions + substitutions
        if total_accounted != total_phonemes:
            print(f"DEBUG:   WARNING: Total accounted ({total_accounted}) != total phonemes ({total_phonemes})")
            print(f"DEBUG:   This suggests an issue with the edit distance calculation")
        
        score = max(0.0, correct_phonemes / total_phonemes)
        print(f"DEBUG:   Final score: {score:.4f} ({score*100:.2f}%)")
        
        # Also log a sample of operations for debugging
        if len(operations) > 0:
            print(f"DEBUG:   Sample operations (first 10): {operations[:10]}")
    
    total_time = time.time() - total_start
    print(f"DEBUG: Total assessment time: {total_time:.2f} seconds")
    
    return {
        "actual_text": actual_text if 'actual_text' in locals() else "",
        "actual_text_normalized": actual_text_normalized if 'actual_text_normalized' in locals() else "",
        "target_text_normalized": target_text_normalized if 'target_text_normalized' in locals() else "",
        "actual_ipa": actual_ipa_phonemes,
        "target_ipa": target_ipa_phonemes,
        "score": score,
        "word_score": word_score if 'word_score' in locals() else 0.0,
        "errors": errors,
        "word_errors": word_errors,
        "signal_quality": signal_quality,
        "alignments": alignments,
        "alignment_method": "mfa" if use_mfa else "estimated",
    }

