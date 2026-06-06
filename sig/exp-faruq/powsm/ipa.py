"""IPA utilities: ARPA→IPA conversion, CMU dictionary lookup, IPA tokenization."""

from __future__ import annotations

import re
import unicodedata

# ARPAbet → IPA mapping
ARPA_TO_IPA = {
    "AA": "ɑ", "AE": "æ", "AH": "ə", "AO": "ɔ", "AW": "aʊ", "AY": "aɪ",
    "B": "b", "CH": "tʃ", "D": "d", "DH": "ð", "EH": "ɛ", "ER": "ɝ",
    "EY": "eɪ", "F": "f", "G": "ɡ", "HH": "h", "IH": "ɪ", "IY": "i",
    "JH": "dʒ", "K": "k", "L": "l", "M": "m", "N": "n", "NG": "ŋ",
    "OW": "oʊ", "OY": "ɔɪ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "u", "V": "v", "W": "w",
    "Y": "j", "Z": "z", "ZH": "ʒ",
}

# Multi-character IPA symbols (diphthongs / affricates) for tokenization
_MULTI_CHAR_IPA = sorted(
    [v for v in ARPA_TO_IPA.values() if len(v) > 1],
    key=len,
    reverse=True,
)


def arpa_seq_to_ipa(arpa_seq: list[str]) -> str:
    """Convert a list of ARPAbet symbols (with optional stress digits) to an IPA string."""
    parts: list[str] = []
    for sym in arpa_seq:
        base = sym.rstrip("012")
        parts.append(ARPA_TO_IPA.get(base, base.lower()))
    return "".join(parts)


def cmu_target_ipa(text: str) -> str:
    """Look up each word via CMU dictionary and return the concatenated IPA string."""
    try:
        import cmudict
    except ImportError as e:
        raise ImportError("pip install cmudict") from e

    cmu = cmudict.dict()
    words = re.findall(r"[A-Za-z']+", text.lower())
    ipa_parts: list[str] = []
    for w in words:
        pron_list = cmu.get(w)
        if not pron_list:
            continue  # skip OOV
        ipa_parts.append(arpa_seq_to_ipa(pron_list[0]))
    return "".join(ipa_parts)


def tokenize_ipa(ipa_string: str | tuple[str, list[str]] | list[str]) -> list[str]:
    """Split an IPA string into a list of phoneme tokens.

    Handles multi-character symbols (diphthongs, affricates) before falling back
    to single-character tokenization.  If passed a (raw, tokens) tuple from
    ``parse_pred``, uses the token list directly.  If passed a list, returns it
    as-is (already tokenized).
    """
    if isinstance(ipa_string, list):
        return ipa_string
    if isinstance(ipa_string, tuple):
        # parse_pred returns (raw, tokens)
        return list(ipa_string[1])

    tokens: list[str] = []
    i = 0
    s = ipa_string
    while i < len(s):
        matched = False
        for multi in _MULTI_CHAR_IPA:
            if s[i:].startswith(multi):
                tokens.append(multi)
                i += len(multi)
                matched = True
                break
        if not matched:
            ch = s[i]
            # skip whitespace and combining marks on their own
            if not ch.isspace() and unicodedata.category(ch) not in ("Mn",):
                tokens.append(ch)
            i += 1
    return tokens
