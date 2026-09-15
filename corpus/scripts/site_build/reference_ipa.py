"""Import verified dictionary forms without deriving pronunciations from learners."""
from __future__ import annotations

import json
import re
import unicodedata
from pathlib import Path


def word_key(word: str) -> str:
    return unicodedata.normalize("NFC", word).casefold().strip().strip(".,!?;:\"“”")


def load(path: Path) -> dict[str, list[str]]:
    """Read an explicit word -> IPA-variants JSON export of the corpus dictionary.

    This intentionally does not transcribe words or silently convert ARPABET.
    Validate the entire input before the builder removes any old output.
    """
    payload = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(payload, dict) or not payload:
        raise ValueError("Reference IPA must be a non-empty word-to-variants JSON object")
    result: dict[str, list[str]] = {}
    for word, variants in payload.items():
        key = word_key(word)
        if not key or not isinstance(variants, list) or not variants:
            raise ValueError(f"Expected a non-empty IPA variant list for {word!r}")
        forms = []
        for variant in variants:
            if not isinstance(variant, str):
                raise ValueError(f"IPA variants must be strings: {word!r}")
            form = unicodedata.normalize("NFC", variant.strip().strip("/"))
            if not form or re.search(r"[A-Z0-9]", form):
                raise ValueError(f"Expected IPA, not ARPABET or numeric stress: {word!r}")
            form = "".join(form.split())
            if not form:
                raise ValueError(f"Empty IPA for {word!r}")
            if form not in forms:
                forms.append(form)
        bucket = result.setdefault(key, [])
        bucket.extend(form for form in forms if form not in bucket)
    return result


def enrich(row: dict, forms: dict[str, list[str]]) -> dict:
    variants = forms.get(word_key(row.get("w") or ""))
    if variants:
        return {**row, "referenceIpa": variants}
    return row
