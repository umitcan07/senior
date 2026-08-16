"""Batch utterance-clip generation for the static CORPTES explorer.

Each source recording is decoded once.  ffmpeg's filter graph trims all of that
recording's requested windows and writes low-bitrate MP3s, avoiding thousands
of independent long seeks.
"""

from __future__ import annotations

import subprocess
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Clip:
    """One padded interval to publish from a recording."""

    identifier: str
    t0: float
    t1: float


def cut_recording(
    source: Path, clips: list[Clip], destination: Path, *, pad: float = 0.15
) -> set[str]:
    """Write requested clips with one ffmpeg process; return completed IDs."""
    if not source.is_file() or not clips:
        return set()
    destination.mkdir(parents=True, exist_ok=True)
    graph_parts = [f"[0:a]asplit={len(clips)}" + "".join(f"[in{i}]" for i in range(len(clips)))]
    for i, clip in enumerate(clips):
        start = max(0.0, clip.t0 - pad)
        end = clip.t1 + pad
        graph_parts.append(
            f"[in{i}]atrim=start={start:.3f}:end={end:.3f},"
            f"asetpts=PTS-STARTPTS,aresample=16000[out{i}]"
        )

    command = [
        "ffmpeg",
        "-y",
        "-loglevel",
        "error",
        "-i",
        str(source),
        "-filter_complex",
        ";".join(graph_parts),
    ]
    outputs: list[tuple[Clip, Path]] = []
    for i, clip in enumerate(clips):
        output = destination / f"{clip.identifier}.mp3"
        outputs.append((clip, output))
        command.extend(["-map", f"[out{i}]", "-ac", "1", "-b:a", "48k", str(output)])
    try:
        subprocess.run(command, check=True)
    except (subprocess.CalledProcessError, FileNotFoundError):
        return set()
    return {clip.identifier for clip, output in outputs if output.is_file() and output.stat().st_size > 0}
