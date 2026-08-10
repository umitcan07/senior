"""IPA phone inventory -> articulatory classes.

This table drives the filter tree the site exposes: the user picks an *area*
(vowels / consonants), then narrows by an articulatory class ("all fricatives")
or by a single phone ("/b/ only") — exactly the two levels requested in the
project brief.

Coverage is General American English **plus** the Turkish-L1 surface forms that
show up as substitutions (`t`/`d̪` for /θ/, `ɾ` for /t/, `ɯ ø y` epenthetic
vowels, …). Anything unrecognised is bucketed as `other` rather than dropped, so
an unexpected label in the annotation surfaces in the UI instead of vanishing.

Kept deliberately self-contained: the web app derives features from PanPhon
vectors stored in the DB (`app/src/lib/phone-hints.ts`), but this pipeline has
no DB, and the category names here mirror that file's `FEATURE_CATEGORY` values
so a contrast reads the same on both surfaces.
"""

from __future__ import annotations

import unicodedata
from dataclasses import dataclass, field
from typing import Literal

Area = Literal["vowels", "consonants", "other"]

# Diacritics we strip before lookup. Stress and length are meaningful but are
# handled as separate attributes (see `parse_phone`), not as part of identity.
_STRESS_MARKS = "ˈˌ"  # ˈ ˌ
_LENGTH_MARKS = "ːˑ"  # ː ˑ


@dataclass(frozen=True)
class Phone:
    """One entry in the inventory."""

    token: str
    area: Area
    # Consonant axes
    place: str | None = None
    manner: str | None = None
    voiced: bool | None = None
    # Vowel axes
    height: str | None = None
    backness: str | None = None
    rounded: bool | None = None
    tense: bool | None = None
    diphthong: bool = False
    # True for phones absent from the Turkish inventory — the ones the corpus
    # exists to study. See doc/V2_CONTEXT.md §4.1.
    missing_in_turkish: bool = False

    @property
    def classes(self) -> list[str]:
        """Articulatory classes this phone belongs to, as filter-tree keys."""
        out: list[str] = []
        if self.area == "consonants":
            if self.manner:
                out.append(f"manner:{self.manner}")
            if self.place:
                out.append(f"place:{self.place}")
            if self.voiced is not None:
                out.append("voicing:voiced" if self.voiced else "voicing:voiceless")
        elif self.area == "vowels":
            if self.diphthong:
                out.append("manner:diphthong")
            if self.height:
                out.append(f"height:{self.height}")
            if self.backness:
                out.append(f"backness:{self.backness}")
            if self.rounded is not None:
                out.append("rounding:rounded" if self.rounded else "rounding:unrounded")
            if self.tense is not None:
                out.append("tenseness:tense" if self.tense else "tenseness:lax")
        if self.missing_in_turkish:
            out.append("contrast:missing-in-turkish")
        return out


def _c(
    token: str,
    place: str,
    manner: str,
    voiced: bool,
    *,
    missing: bool = False,
) -> Phone:
    return Phone(
        token=token,
        area="consonants",
        place=place,
        manner=manner,
        voiced=voiced,
        missing_in_turkish=missing,
    )


def _v(
    token: str,
    height: str,
    backness: str,
    rounded: bool,
    tense: bool | None = None,
    *,
    diphthong: bool = False,
    missing: bool = False,
) -> Phone:
    return Phone(
        token=token,
        area="vowels",
        height=height,
        backness=backness,
        rounded=rounded,
        tense=tense,
        diphthong=diphthong,
        missing_in_turkish=missing,
    )


_CONSONANTS: list[Phone] = [
    _c("p", "bilabial", "plosive", False),
    _c("b", "bilabial", "plosive", True),
    _c("t", "alveolar", "plosive", False),
    _c("d", "alveolar", "plosive", True),
    _c("k", "velar", "plosive", False),
    _c("g", "velar", "plosive", True),
    _c("ɡ", "velar", "plosive", True),  # ɡ (U+0261 script g)
    _c("c", "palatal", "plosive", False),  # Turkish k before front vowels
    _c("ɟ", "palatal", "plosive", True),  # ɟ
    _c("ʔ", "glottal", "plosive", False),  # ʔ
    _c("f", "labiodental", "fricative", False),
    _c("v", "labiodental", "fricative", True),
    _c("θ", "dental", "fricative", False, missing=True),  # θ
    _c("ð", "dental", "fricative", True, missing=True),  # ð
    _c("s", "alveolar", "fricative", False),
    _c("z", "alveolar", "fricative", True),
    _c("ʃ", "postalveolar", "fricative", False),  # ʃ
    _c("ʒ", "postalveolar", "fricative", True),  # ʒ
    _c("x", "velar", "fricative", False),
    _c("ɣ", "velar", "fricative", True),  # ɣ
    _c("h", "glottal", "fricative", False),
    _c("ʧ", "postalveolar", "affricate", False),  # ʧ
    _c("ʤ", "postalveolar", "affricate", True),  # ʤ
    _c("ʰ", "alveolar", "affricate", False),  # stray aspiration mark guard
    _c("ts", "alveolar", "affricate", False),
    _c("dz", "alveolar", "affricate", True),
    _c("m", "bilabial", "nasal", True),
    _c("n", "alveolar", "nasal", True),
    _c("ŋ", "velar", "nasal", True, missing=True),  # ŋ
    _c("l", "alveolar", "lateral", True),
    _c("ɫ", "velar", "lateral", True),  # ɫ
    _c("ɹ", "alveolar", "approximant", True, missing=True),  # ɹ
    _c("r", "alveolar", "trill", True),
    _c("ɾ", "alveolar", "tap", True),  # ɾ
    _c("j", "palatal", "approximant", True),
    _c("w", "labial-velar", "approximant", True, missing=True),
]

_VOWELS: list[Phone] = [
    _v("i", "close", "front", False, True),
    _v("ɪ", "near-close", "front", False, False, missing=True),  # ɪ
    _v("e", "close-mid", "front", False, True),
    _v("ɛ", "open-mid", "front", False, False),  # ɛ
    _v("æ", "near-open", "front", False, False, missing=True),  # æ
    _v("ə", "mid", "central", False, False, missing=True),  # ə
    _v("ʌ", "open-mid", "back", False, False, missing=True),  # ʌ
    _v("ɑ", "open", "back", False, True),  # ɑ
    _v("a", "open", "front", False, False),
    _v("ɒ", "open", "back", True, False),  # ɒ
    _v("ɔ", "open-mid", "back", True, True),  # ɔ
    _v("o", "close-mid", "back", True, True),
    _v("ʊ", "near-close", "back", True, False, missing=True),  # ʊ
    _v("u", "close", "back", True, True),
    _v("ɜ", "open-mid", "central", False, True),  # ɜ
    _v("ɚ", "mid", "central", False, False, missing=True),  # ɚ
    _v("ɝ", "open-mid", "central", False, True, missing=True),  # ɝ
    # Turkish vowels that appear as substitutions / epenthesis
    _v("y", "close", "front", True, True),
    _v("ø", "close-mid", "front", True, True),  # ø
    _v("ɯ", "close", "back", False, True),  # ɯ
    # Diphthongs
    _v("eɪ", "close-mid", "front", False, True, diphthong=True),  # eɪ
    _v("aɪ", "open", "front", False, True, diphthong=True),  # aɪ
    _v("ɔɪ", "open-mid", "back", True, True, diphthong=True),  # ɔɪ
    _v("oʊ", "close-mid", "back", True, True, diphthong=True),  # oʊ
    _v("aʊ", "open", "front", False, True, diphthong=True),  # aʊ
    _v("ɪə", "near-close", "front", False, False, diphthong=True),  # ɪə
    _v("eə", "open-mid", "front", False, False, diphthong=True),  # eə
    _v("ʊə", "near-close", "back", True, False, diphthong=True),  # ʊə
]

INVENTORY: dict[str, Phone] = {p.token: p for p in (*_CONSONANTS, *_VOWELS)}

# Style variants seen in the corpus annotation. `analyze_corpus_deep.py` already
# carries this table for the fine-tune path; kept in sync deliberately.
ALIASES: dict[str, str] = {
    "ej": "eɪ",
    "ow": "oʊ",
    "aj": "aɪ",
    "aw": "aʊ",
    "oy": "ɔɪ",
    "oj": "ɔɪ",
    "i:": "i",
    "u:": "u",
    "a:": "ɑ",
    "3:": "ɜ",
    "o:": "ɔ",
    "e:": "e",
    "tS": "ʧ",
    "dZ": "ʤ",
    "tʃ": "ʧ",
    "dʒ": "ʤ",
    "ɡ": "g",
    "R": "ɹ",
    "N": "ŋ",
    "S": "ʃ",
    "Z": "ʒ",
    "T": "θ",
    "D": "ð",
}


@dataclass(frozen=True)
class ParsedPhone:
    """A phone label split into identity + suprasegmental attributes."""

    raw: str
    token: str
    stress: int = 0  # 0 none, 1 primary, 2 secondary
    long: bool = False
    phone: Phone | None = field(default=None, compare=False)

    @property
    def area(self) -> Area:
        return self.phone.area if self.phone else "other"

    @property
    def known(self) -> bool:
        return self.phone is not None


def parse_phone(raw: str) -> ParsedPhone:
    """Split a corpus phone label into identity, stress and length.

    POWSM-style slashes (`/h/`) are stripped on the way in, matching the
    convention in `app/src/lib/ipa.ts` — our tokens never carry them.
    """
    label = raw.strip().strip("/")
    if not label:
        return ParsedPhone(raw=raw, token="")

    label = unicodedata.normalize("NFC", label)

    stress = 0
    if "ˈ" in label:
        stress = 1
    elif "ˌ" in label:
        stress = 2
    label = label.strip(_STRESS_MARKS)

    long = any(m in label for m in _LENGTH_MARKS)
    label = "".join(ch for ch in label if ch not in _LENGTH_MARKS)

    token = ALIASES.get(label, label)
    # Retry the alias table after case folding — some speakers' TextGrids use
    # SAMPA-ish capitals inconsistently.
    if token not in INVENTORY and label.lower() in ALIASES:
        token = ALIASES[label.lower()]

    return ParsedPhone(
        raw=raw,
        token=token,
        stress=stress,
        long=long,
        phone=INVENTORY.get(token),
    )


def filter_tree() -> dict[str, list[dict[str, object]]]:
    """Build the area -> class -> phones structure the site's sidebar renders."""
    tree: dict[str, list[dict[str, object]]] = {}
    for area in ("consonants", "vowels"):
        phones = [p for p in INVENTORY.values() if p.area == area]
        classes: dict[str, list[str]] = {}
        for p in phones:
            for cls in p.classes:
                classes.setdefault(cls, []).append(p.token)
        tree[area] = [
            {"key": key, "phones": sorted(set(toks))}
            for key, toks in sorted(classes.items())
        ]
    return tree
