"""Synthetic EXMARaLDA fixtures — a stand-in corpus until the real drop lands.

These build a minimal but schema-faithful TASK1/TASK2 pair so the whole pipeline
(parse -> align -> rhythm -> emit) can be exercised end to end offline. The .exb
follows the DTD-verified layout in `exb.py`; the TextGrids follow PRAAT long
format with the tier names from corpus/finetune_qc.md.

The point is coverage of the shapes that matter: a correct token, a
substitution (θ->t, the canonical Turkish-L1 error), a deletion, an insertion
(epenthetic vowel), a stress mismatch, and unanchored timeline items in the .exb.
"""

from __future__ import annotations

from pathlib import Path


def _interval_tier(name: str, intervals: list[tuple[float, float, str]], xmax: float) -> str:
    lines = [
        '    class = "IntervalTier"',
        f'    name = "{name}"',
        "    xmin = 0",
        f"    xmax = {xmax}",
        f"    intervals: size = {len(intervals)}",
    ]
    for i, (t0, t1, text) in enumerate(intervals, 1):
        lines += [
            f"    intervals [{i}]:",
            f"        xmin = {t0}",
            f"        xmax = {t1}",
            f'        text = "{text}"',
        ]
    return "\n".join(lines)


def write_textgrid(path: Path, tiers: dict[str, list[tuple[float, float, str]]], xmax: float) -> None:
    blocks = [
        'File type = "ooTextFile"',
        'Object class = "TextGrid"',
        "",
        "xmin = 0",
        f"xmax = {xmax}",
        "tiers? <exists>",
        f"size = {len(tiers)}",
        "item []:",
    ]
    for i, (name, intervals) in enumerate(tiers.items(), 1):
        blocks.append(f"item [{i}]:")
        blocks.append(_interval_tier(name, intervals, xmax))
    path.write_text("\n".join(blocks) + "\n", encoding="utf-8")


def write_exb(path: Path, speaker: str) -> None:
    """A schema-faithful .exb with a learner speaker carrying ud metadata."""
    xml = f"""<?xml version="1.0" encoding="UTF-8"?>
<basic-transcription>
  <head>
    <meta-information>
      <project-name>CORPTES</project-name>
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
        <sex value="f"/>
        <languages-used><language lang="eng"/></languages-used>
        <l1><language lang="tur"/></l1>
        <l2><language lang="eng"/></l2>
        <ud-speaker-information>
          <ud-information attribute-name="age">21</ud-information>
          <ud-information attribute-name="learner_level_CEFR_conversion">B2</ud-information>
          <ud-information attribute-name="L2_study_years">10</ud-information>
        </ud-speaker-information>
        <comment></comment>
      </speaker>
    </speakertable>
  </head>
  <basic-body>
    <common-timeline>
      <tli id="T0" time="0.0"/>
      <tli id="T1"/>
      <tli id="T2" time="1.0"/>
    </common-timeline>
    <tier id="TIE0" speaker="SPK0" category="v" type="t" display-name="{speaker} [v]">
      <event start="T0" end="T2">think</event>
    </tier>
    <tier id="TIE1" speaker="SPK0" category="error" type="a" display-name="{speaker} [error]">
      <event start="T0" end="T1">TH-stopping</event>
    </tier>
  </basic-body>
</basic-transcription>
"""
    path.write_text(xml, encoding="utf-8")


def make_corpus(root: Path) -> Path:
    """Create a two-file synthetic corpus under `root`; return the raw dir."""
    raw = root / "Corpus Files"
    t1 = raw / "TASK1 audio&textgrids"
    t2 = raw / "TASK2 audio&textgrids"
    exb_dir = raw / "exb files"
    for d in (t1, t2, exb_dir):
        d.mkdir(parents=True, exist_ok=True)

    # TASK1: "think" said as [t ɪ ŋ k] with epenthesis — target /θ ɪ ŋ k/.
    # phones (actual): t ɪ ŋ k  ;  REF-phones (target): θ ɪ ŋ k
    write_textgrid(
        t1 / "S01T1.TextGrid",
        {
            "phones": [
                (0.0, 0.20, "t"),
                (0.20, 0.35, "ˈɪ"),
                (0.35, 0.50, "ŋ"),
                (0.50, 0.65, "k"),
            ],
            "REF-phones": [
                (0.0, 0.20, "θ"),
                (0.20, 0.35, "ˌɪ"),
                (0.35, 0.50, "ŋ"),
                (0.50, 0.65, "k"),
            ],
            "words": [(0.0, 0.65, "think.")],
        },
        xmax=1.0,
    )
    write_exb(exb_dir / "S01T1.exb", "S01")

    # TASK2: "star" -> Turkish epenthesis [ ɯ s t ɑ ɹ ] (prothetic vowel).
    # actual has an inserted ɯ the reference lacks; final ɹ realised as ɾ.
    write_textgrid(
        t2 / "S01T2.TextGrid",
        {
            "REF-phones": [
                (0.10, 0.25, "s"),
                (0.25, 0.40, "t"),
                (0.40, 0.60, "ɑ"),
                (0.60, 0.75, "ɹ"),
            ],
            "phones": [
                (0.00, 0.10, "ɯ"),
                (0.10, 0.25, "s"),
                (0.25, 0.40, "t"),
                (0.40, 0.60, "ɑ"),
                (0.60, 0.75, "ɾ"),
            ],
            # Word span covers the produced audio, prothetic vowel included —
            # this is what a forced-alignment word boundary looks like.
            "REF-words-matched": [(0.00, 0.75, "star.")],
        },
        xmax=1.0,
    )

    return raw
