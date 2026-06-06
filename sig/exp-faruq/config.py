"""Shared configuration for the POWSM experiment."""

from pathlib import Path

ROOT = Path(__file__).parent
DATA_DIR = ROOT / "data" / "sentences"
RESULTS_DIR = ROOT / "results"
CACHE_DIR = ROOT / "cache"

MODEL_NAME = "espnet/powsm_ctc"
DEVICE = "cuda"
LANG = "<unk>"  # CTC model uses <unk>; original powsm uses <eng>
TARGET_SR = 16000
TARGET_DURATION = 20  # seconds
TARGET_CHANNELS = 1  # mono

AUDIO_EXTENSIONS = {".m4a", ".mp3", ".wav", ".flac", ".ogg", ".aac"}
