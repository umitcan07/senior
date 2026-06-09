"""
ARPAbet → POWSM IPA phone list mapping.

Returns a list of IPA phone strings per ARPAbet input because some ARPAbet phones
expand to two POWSM phones (diphthongs → two vowel phones, affricates → stop+fricative).
All IPA strings here are POWSM's native output convention, confirmed empirically via PR runs.

Key conventions (both confirmed from finetuning_failure_analysis.md):
  - Diphthongs use VOWEL OFFGLIDE notation: aɪ, eɪ, oʊ, aʊ, ɔɪ (NOT aj, ej, ow, aw, oj)
  - Each diphthong expands to two phones because POWSM's CTC targets are monophthongs
  - Affricates expand to two phones (stop + fricative)
  - Stress digits (AH0 vs AH1) drive the ə/ʌ distinction
  - Length marks (ː) are stripped (CTC targets exclude suprasegmentals)
"""

from typing import List

# Maps ARPAbet (uppercase, no stress digit) → list of POWSM IPA phones
# Stress-sensitive entries are handled in arpa_to_powsm() below.
_BASE_MAP: dict[str, List[str]] = {
    # Stops
    "B": ["b"],
    "D": ["d"],
    "G": ["ɡ"],   # U+0261 (not ASCII g)
    "K": ["k"],
    "P": ["p"],
    "T": ["t"],
    # Fricatives
    "DH": ["ð"],
    "F": ["f"],
    "HH": ["h"],
    "S": ["s"],
    "SH": ["ʃ"],
    "TH": ["θ"],
    "V": ["v"],
    "Z": ["z"],
    "ZH": ["ʒ"],
    # Affricates → two phones (POWSM CTC monophthong convention)
    "CH": ["t", "ʃ"],
    "JH": ["d", "ʒ"],
    # Nasals
    "M": ["m"],
    "N": ["n"],
    "NG": ["ŋ"],
    # Approximants / liquids
    "L": ["l"],
    "R": ["ɹ"],   # English approximant r
    "W": ["w"],
    "Y": ["j"],
    # Monophthong vowels (stress digit stripped; handled below for AH)
    "AA": ["ɑ"],
    "AE": ["æ"],
    "AO": ["ɔ"],
    "EH": ["ɛ"],
    "IH": ["ɪ"],
    "IY": ["i"],   # length mark stripped
    "UH": ["ʊ"],
    "UW": ["u"],   # length mark stripped
    # R-colored vowels: ER is handled stress-dependently in arpa_to_powsm() below
    # (ER1→ɜ˞, ER0/ER2→ə˞).  No entry here — this comment is the reminder.
    # Diphthongs → two phones (POWSM offglide convention)
    "AW": ["a", "ʊ"],   # NOT aw
    "AY": ["a", "ɪ"],   # NOT aj
    "EY": ["e", "ɪ"],   # NOT ej
    "OW": ["o", "ʊ"],   # NOT ow
    "OY": ["ɔ", "ɪ"],
}

# Silence/noise labels to skip
_SKIP_LABELS = {"sil", "sp", "SIL", "SP", "", "spn", "SPN", "<eps>"}


def arpa_to_powsm(arpa_label: str) -> List[str]:
    """
    Convert a single ARPAbet label (with optional stress digit) to a list of
    POWSM IPA phone strings.  Returns [] for silence/noise labels.

    Handles L2-ARCTIC extended ARPAbet:
      - X* suffix (flap/reduced variants) → treat as base X
      - AX / AX0 / AX1 (reduced schwa) → ə
      - ERR (emphatic r-color) → ɚ

    >>> arpa_to_powsm("AH0")   # unstressed → schwa
    ['ə']
    >>> arpa_to_powsm("AH1")   # stressed → strut vowel
    ['ʌ']
    >>> arpa_to_powsm("EY1")   # diphthong → two phones (offglide convention)
    ['e', 'ɪ']
    >>> arpa_to_powsm("CH")    # affricate → two phones
    ['t', 'ʃ']
    >>> arpa_to_powsm("R*")    # L2-ARCTIC flap r → ɹ
    ['ɹ']
    >>> arpa_to_powsm("AX")    # reduced schwa
    ['ə']
    """
    label = arpa_label.strip().upper()

    if label in _SKIP_LABELS or not label:
        return []

    # L2-ARCTIC extended: ERR (emphatic r-color) → ə˞ (ɚ is NOT in POWSM vocab)
    if label == "ERR":
        return ["ə˞"]

    # IPA passthrough: some L2-ARCTIC PPL fields contain IPA ɚ/ɝ directly.
    # ɚ (r-colored schwa, unstressed) → ə˞; ɝ (stressed rhotic) → ɜ˞
    if label == "ɚ":
        return ["ə˞"]
    if label == "ɝ":
        return ["ɜ˞"]

    # L2-ARCTIC extended: AX / AX0 / AX1 / AX2 → ə (reduced schwa)
    if label.startswith("AX"):
        return ["ə"]

    # L2-ARCTIC extended: X* suffix → strip asterisk, treat as base phone X
    if label.endswith("*"):
        label = label[:-1]
        if not label:
            return []

    # Strip stress digit suffix (0, 1, 2)
    stress = ""
    if label and label[-1].isdigit():
        stress = label[-1]
        base = label[:-1]
    else:
        base = label

    # AH: stress-dependent split (AH0→ə, AH1/AH2→ʌ)
    if base == "AH":
        return ["ə"] if stress in ("0", "") else ["ʌ"]

    # ER: stress-dependent rhotic vowel mapping (ɚ is NOT in POWSM vocab).
    # ER0 / ER2 (unstressed) → ə˞  (rhotic schwa, e.g. "butter", "over")
    # ER1 (stressed)         → ɜ˞  (rhotic open-mid, e.g. "bird", "early")
    # Confirmed against actual POWSM free_alignment output (vocab_probe2.py).
    if base == "ER":
        return ["ɜ˞"] if stress == "1" else ["ə˞"]

    phones = _BASE_MAP.get(base)
    if phones is None:
        # Unknown label — caller decides whether to skip or raise
        return []
    return phones


def arpa_seq_to_powsm(arpa_phones: List[str]) -> List[str]:
    """
    Convert a list of ARPAbet labels to a flat list of POWSM IPA phones.
    Silences and unknown labels are dropped.
    """
    out = []
    for a in arpa_phones:
        out.extend(arpa_to_powsm(a))
    return out


def phones_to_espnet_text(phones: List[str]) -> str:
    """
    Format a phone list as POWSM's ESPnet text format: /h//ɛ//l//oʊ/
    (each phone wrapped in slashes, no spaces).
    """
    return "".join(f"/{p}/" for p in phones)


def validate_phones(phones: List[str], token_list: List[str]) -> List[str]:
    """
    Return any phones not present as /phone/ tokens in POWSM's token_list.
    A clean result returns [].
    """
    token_set = {t.strip("/") for t in token_list if t.startswith("/") and t.endswith("/")}
    return [p for p in phones if p not in token_set]
