"""Resolve Turkish-L1 corpus raw directory (WAV + PRAAT TextGrids)."""
from __future__ import annotations

import os
from pathlib import Path

_REPO_CORPUS = Path(__file__).resolve().parents[1]
_DEFAULT_DOWNLOADS = Path.home() / "Downloads" / "Corpus Files"


def corpus_raw_dir() -> Path:
    env = os.environ.get("CORPUS_RAW_DIR")
    if env:
        return Path(env).expanduser().resolve()
    symlink = _REPO_CORPUS / "raw"
    if symlink.is_dir():
        return symlink.resolve()
    return _DEFAULT_DOWNLOADS.resolve()


def task_dirs() -> dict[str, Path]:
    base = corpus_raw_dir()
    return {
        "task1": base / "TASK1 audio&textgrids",
        "task2": base / "TASK2 audio&textgrids",
    }
