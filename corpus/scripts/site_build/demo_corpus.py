"""Generate a synthetic but realistic demo corpus.

This is scaffolding for development and for the teacher's first look — NOT real
data. It fabricates a Turkish-L1 English corpus with plausible error patterns so
the site can be built and viewed before the real EXMARaLDA drop arrives. Every
utterance is clearly marked demo in the manifest's raw_dir.

It produces the same on-disk shape the real corpus has —
`TASK{1,2} audio&textgrids/*.{TextGrid,wav}` plus `exb files/*.exb` — so the
exact same `build.py` command runs against it. When the real data lands, point
`--raw` at that instead and delete the demo output.

Turkish-L1 substitutions applied probabilistically (doc/V2_CONTEXT.md §4):
    θ→t  ð→d  w→v  ŋ→n  ɹ→r  æ→ɛ/a  ɪ→i  ʊ→u  ə→ɛ
    consonant-cluster epenthesis (prothetic/anaptyctic ɯ)
    final-obstruent devoicing (b→p, d→t, g→k, z→s)
"""

from __future__ import annotations

import argparse
import math
import struct
import wave
from pathlib import Path

# Written into the generated raw dir; build.py looks for the same name and
# stamps `synthetic` into the manifest. Keep the two in sync (same convention as
# the "TASK1 audio&textgrids" / "exb files" folder names).
SYNTHETIC_MARKER = ".synthetic"

# (word, reference IPA phones) — a compact set that exercises every filter class.
WORDS: list[tuple[str, list[str]]] = [
    ("think", ["θ", "ɪ", "ŋ", "k"]),
    ("this", ["ð", "ɪ", "s"]),
    ("three", ["θ", "ɹ", "i"]),
    ("weather", ["w", "ɛ", "ð", "ɚ"]),
    ("water", ["w", "ɔ", "t", "ɚ"]),
    ("world", ["w", "ɝ", "l", "d"]),
    ("thing", ["θ", "ɪ", "ŋ"]),
    ("young", ["j", "ʌ", "ŋ"]),
    ("song", ["s", "ɔ", "ŋ"]),
    ("red", ["ɹ", "ɛ", "d"]),
    ("right", ["ɹ", "aɪ", "t"]),
    ("very", ["v", "ɛ", "ɹ", "i"]),
    ("cat", ["k", "æ", "t"]),
    ("bad", ["b", "æ", "d"]),
    ("map", ["m", "æ", "p"]),
    ("ship", ["ʃ", "ɪ", "p"]),
    ("sheep", ["ʃ", "i", "p"]),
    ("bit", ["b", "ɪ", "t"]),
    ("beat", ["b", "i", "t"]),
    ("full", ["f", "ʊ", "l"]),
    ("fool", ["f", "u", "l"]),
    ("about", ["ə", "b", "aʊ", "t"]),
    ("sofa", ["s", "oʊ", "f", "ə"]),
    ("student", ["s", "t", "u", "d", "ə", "n", "t"]),
    ("street", ["s", "t", "ɹ", "i", "t"]),
    ("spring", ["s", "p", "ɹ", "ɪ", "ŋ"]),
    ("school", ["s", "k", "u", "l"]),
    ("stop", ["s", "t", "ɔ", "p"]),
    ("desk", ["d", "ɛ", "s", "k"]),
    ("job", ["ʤ", "ɑ", "b"]),
    ("bridge", ["b", "ɹ", "ɪ", "ʤ"]),
    ("church", ["ʧ", "ɝ", "ʧ"]),
    ("measure", ["m", "ɛ", "ʒ", "ɚ"]),
    ("vision", ["v", "ɪ", "ʒ", "ə", "n"]),
    ("garage", ["g", "ə", "ɹ", "ɑ", "ʒ"]),
]

# Substitution table: target -> (replacement, probability)
SUBS: dict[str, tuple[str, float]] = {
    "θ": ("t", 0.72),
    "ð": ("d", 0.68),
    "w": ("v", 0.55),
    "ŋ": ("n", 0.45),
    "ɹ": ("r", 0.85),
    "æ": ("ɛ", 0.5),
    "ɪ": ("i", 0.4),
    "ʊ": ("u", 0.45),
    "ə": ("ɛ", 0.3),
    "ɚ": ("ɛr", 0.4),
    "ɝ": ("ɛr", 0.5),
    "ʒ": ("ʤ", 0.5),
    "ʌ": ("a", 0.35),
}
FINAL_DEVOICE = {"b": "p", "d": "t", "g": "k", "z": "s", "ʤ": "ʧ", "v": "f"}
VOWELS = set("iɪeɛæəʌɑaɒɔoʊuɜɚɝyøɯ") | {"eɪ", "aɪ", "ɔɪ", "oʊ", "aʊ"}


class Rng:
    """Deterministic LCG — no Math.random-style nondeterminism, reproducible."""

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.state = (1103515245 * self.state + 12345) & 0x7FFFFFFF
        return self.state / 0x7FFFFFFF

    def chance(self, p: float) -> bool:
        return self.next() < p

    def pick(self, seq):
        return seq[int(self.next() * len(seq)) % len(seq)]


def realise(ref: list[str], rng: Rng) -> list[tuple[str, str, str]]:
    """Return (target, actual, op) triples. op in correct/sub/del/ins."""
    out: list[tuple[str, str, str]] = []
    for i, ph in enumerate(ref):
        # Cluster epenthesis: insert ɯ before a word-initial s+cons cluster.
        if i == 0 and ph == "s" and len(ref) > 1 and ref[1] not in VOWELS:
            if rng.chance(0.5):
                out.append(("", "ɯ", "ins"))
        sub = SUBS.get(ph)
        is_final = i == len(ref) - 1
        if is_final and ph in FINAL_DEVOICE and rng.chance(0.4):
            out.append((ph, FINAL_DEVOICE[ph], "sub"))
        elif sub and rng.chance(sub[1]):
            out.append((ph, sub[0], "sub"))
        elif rng.chance(0.04):
            out.append((ph, ph, "del"))  # occasional omission
        else:
            out.append((ph, ph, "correct"))
    return out


def _dur_for(ph: str, rng: Rng) -> float:
    base = 0.13 if ph in VOWELS else 0.08
    return base + rng.next() * 0.05


def write_textgrid(path: Path, phones, refs, words, xmax: float) -> None:
    def tier(name: str, intervals: list[tuple[float, float, str]]) -> str:
        lines = [
            "    class = \"IntervalTier\"",
            f"    name = \"{name}\"",
            "    xmin = 0",
            f"    xmax = {xmax:.3f}",
            f"    intervals: size = {len(intervals)}",
        ]
        for i, (t0, t1, tx) in enumerate(intervals, 1):
            lines += [
                f"    intervals [{i}]:",
                f"        xmin = {t0:.3f}",
                f"        xmax = {t1:.3f}",
                f"        text = \"{tx}\"",
            ]
        return "\n".join(lines)

    out = [
        'File type = "ooTextFile"',
        'Object class = "TextGrid"',
        "",
        "xmin = 0",
        f"xmax = {xmax:.3f}",
        "tiers? <exists>",
        "size = 3",
        "item []:",
        "item [1]:",
        tier("phones", phones),
        "item [2]:",
        tier("REF-phones", refs),
        "item [3]:",
        tier("words", words),
    ]
    path.write_text("\n".join(out) + "\n", encoding="utf-8")


def synth_wav(path: Path, phones: list[tuple[float, float, str]], f0_base: float, rng: Rng) -> None:
    """Render a crude voiced/unvoiced WAV so the F0 tracker has something real.

    Vowels -> a harmonic-ish tone at a declining F0 with a final movement;
    consonants -> low-amplitude noise. Not speech, but it carries a legible
    pitch contour for the intonation demo.
    """
    sr = 16000
    total = max(iv[1] for iv in phones) if phones else 0.5
    n = int(total * sr)
    samples = [0.0] * n
    declination = 0.85  # F0 drifts down across the utterance
    final_rise = rng.chance(0.4)
    phase = 0.0
    for t0, t1, ph in phones:
        a = int(t0 * sr)
        b = min(n, int(t1 * sr))
        voiced = ph in VOWELS or ph in "mnŋlrɹjwvðzʒʤ"
        pos = t0 / total
        f0 = f0_base * (1 - (1 - declination) * pos)
        if final_rise and pos > 0.7:
            f0 *= 1.0 + (pos - 0.7) * 0.8
        for i in range(a, b):
            if voiced:
                phase += 2 * math.pi * f0 / sr
                val = 0.5 * math.sin(phase) + 0.2 * math.sin(2 * phase)
            else:
                val = (rng.next() - 0.5) * 0.25
            samples[i] += val

    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        frames = b"".join(
            struct.pack("<h", max(-32767, min(32767, int(s * 30000)))) for s in samples
        )
        w.writeframes(frames)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", type=Path, required=True, help="raw corpus dir to create")
    parser.add_argument("--speakers", type=int, default=24)
    parser.add_argument("--audio", action="store_true", help="also synth WAVs")
    args = parser.parse_args(argv)

    raw = args.out
    t1_dir = raw / "TASK1 audio&textgrids"
    t2_dir = raw / "TASK2 audio&textgrids"
    exb_dir = raw / "exb files"
    for d in (t1_dir, t2_dir, exb_dir):
        d.mkdir(parents=True, exist_ok=True)

    # Marker so build.py can stamp the manifest — the site refuses to present
    # fabricated numbers as if they were the corpus.
    (raw / SYNTHETIC_MARKER).write_text(
        "Generated by corpus/scripts/site_build/demo_corpus.py. Not real data.\n",
        encoding="utf-8",
    )

    cefr_levels = ["A2", "B1", "B1", "B2", "B2", "C1"]
    n_files = 0
    for s in range(1, args.speakers + 1):
        rng = Rng(seed=1000 + s * 7)
        sex = "f" if s % 2 == 0 else "m"
        f0_base = 190 + rng.next() * 60 if sex == "f" else 110 + rng.next() * 40
        cefr = cefr_levels[s % len(cefr_levels)]
        age = 18 + int(rng.next() * 8)

        # A speaker reads a rotating subset of the word list.
        for task, folder in (("T1", t1_dir), ("T2", t2_dir)):
            words = WORDS[(s + (0 if task == "T1" else 3)) % len(WORDS) :] + WORDS[
                : (s + (0 if task == "T1" else 3)) % len(WORDS)
            ]
            words = words[:18]
            phones_iv: list[tuple[float, float, str]] = []
            refs_iv: list[tuple[float, float, str]] = []
            words_iv: list[tuple[float, float, str]] = []
            # Concatenate several words into one utterance TextGrid, tracking a
            # per-word interval on the phones timeline so the concordance's Word
            # column is meaningful.
            t = 0.0
            rt = 0.0
            for word, ref in words:
                word_start = t
                triples = realise(ref, rng)
                for target, actual, op in triples:
                    if op != "ins" and target:
                        d = _dur_for(target, rng)
                        refs_iv.append((rt, rt + d, target))
                        rt += d
                    if op != "del" and actual:
                        d = _dur_for(actual, rng)
                        phones_iv.append((t, t + d, actual))
                        t += d
                if t > word_start:
                    words_iv.append((word_start, t, word))
                t += 0.06  # inter-word gap
                rt += 0.06
            # Mark only the last word with a sentence period so the file is one
            # multi-word utterance, not one utterance per word.
            if words_iv:
                lt0, lt1, lw = words_iv[-1]
                words_iv[-1] = (lt0, lt1, lw + ".")
            xmax = max(t, rt) + 0.1

            stem = f"S{s:02d}{task}"
            # Add a primary-stress mark to the first vowel of the utterance so
            # the lexical-stress area has signal.
            phones_iv = _mark_stress(phones_iv, rng)
            refs_iv = _mark_stress(refs_iv, rng)
            write_textgrid((folder / f"{stem}.TextGrid"), phones_iv, refs_iv, words_iv, xmax)
            if args.audio:
                synth_wav(folder / f"{stem}.wav", phones_iv, f0_base, rng)
            n_files += 1

        write_exb(exb_dir / f"S{s:02d}T1.exb", f"S{s:02d}", sex, cefr, age)

    print(f"Demo corpus: {args.speakers} speakers, {n_files} files -> {raw}")
    if not args.audio:
        print("  (no audio; pass --audio to synth WAVs for clips + intonation)")
    return 0


def _mark_stress(intervals, rng: Rng):
    """Put a primary/secondary mark on some vowels to exercise lexical stress."""
    out = []
    first_vowel_marked = False
    for t0, t1, ph in intervals:
        if ph in VOWELS and not first_vowel_marked:
            ph = "ˈ" + ph
            first_vowel_marked = True
        elif ph in VOWELS and rng.chance(0.15):
            ph = "ˌ" + ph
        out.append((t0, t1, ph))
    return out


def write_exb(path: Path, speaker: str, sex: str, cefr: str, age: int) -> None:
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<basic-transcription>
  <head>
    <meta-information>
      <project-name>CORPTES (demo)</project-name>
      <transcription-name>{speaker}T1</transcription-name>
      <referenced-file url="{speaker}T1.wav"/>
      <ud-meta-information>
        <ud-information attribute-name="corpus_acronym">CORPTES</ud-information>
      </ud-meta-information>
      <comment></comment>
      <transcription-convention></transcription-convention>
    </meta-information>
    <speakertable>
      <speaker id="SPK0">
        <abbreviation>{speaker}</abbreviation>
        <sex value="{sex}"/>
        <languages-used><language lang="eng"/></languages-used>
        <l1><language lang="tur"/></l1>
        <l2><language lang="eng"/></l2>
        <ud-speaker-information>
          <ud-information attribute-name="age">{age}</ud-information>
          <ud-information attribute-name="learner_level_CEFR_conversion">{cefr}</ud-information>
          <ud-information attribute-name="L2_study_years">{age - 7}</ud-information>
        </ud-speaker-information>
        <comment></comment>
      </speaker>
    </speakertable>
  </head>
  <basic-body>
    <common-timeline><tli id="T0" time="0.0"/><tli id="T1" time="1.0"/></common-timeline>
    <tier id="TIE0" speaker="SPK0" category="v" type="t" display-name="{speaker} [v]"></tier>
  </basic-body>
</basic-transcription>
"""
    path.write_text(xml, encoding="utf-8")


if __name__ == "__main__":
    raise SystemExit(main())
