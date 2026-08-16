"""End-to-end pipeline tests against the synthetic corpus.

Run: python -m pytest corpus/scripts/site_build/tests/ -q
or:  python corpus/scripts/site_build/tests/test_pipeline.py   (no pytest needed)

These assert the *shapes and semantics* that matter — strict-identity
correctness, the θ->t substitution, the epenthetic insertion, stress mismatch,
metadata extraction — so when the real corpus arrives, the same assertions
validate it (or fail loudly on a schema surprise).
"""

from __future__ import annotations

import json
import sys
import tempfile
from pathlib import Path
from urllib.parse import quote

_HERE = Path(__file__).resolve()
sys.path.insert(0, str(_HERE.parents[2]))  # corpus/scripts

from site_build import align, build, exb, inventory, rhythm, textgrid  # noqa: E402
from site_build.tests import fixtures  # noqa: E402


def _fresh_corpus() -> tuple[Path, Path]:
    tmp = Path(tempfile.mkdtemp(prefix="corptes_test_"))
    raw = fixtures.make_corpus(tmp)
    return tmp, raw


def test_textgrid_roundtrip():
    tmp, raw = _fresh_corpus()
    tg = textgrid.read_textgrid(raw / "TASK1 audio&textgrids" / "S01T1.TextGrid")
    assert set(tg.tiers) == {"phones", "REF-phones", "words"}
    phones = tg.tier("phones").labelled()
    assert [iv.text for iv in phones] == ["t", "ˈɪ", "ŋ", "k"]
    assert abs(phones[0].dur - 0.20) < 1e-9


def test_inventory_classification():
    assert inventory.INVENTORY["θ"].area == "consonants"
    assert inventory.INVENTORY["θ"].missing_in_turkish is True
    assert inventory.INVENTORY["ɪ"].area == "vowels"
    # /b/ resolves to its own class set including a single-phone drill.
    b = inventory.INVENTORY["b"]
    assert "manner:plosive" in b.classes
    assert "voicing:voiced" in b.classes
    # Aliases + stress parsing
    p = inventory.parse_phone("ˈɪ")
    assert p.token == "ɪ" and p.stress == 1
    assert inventory.parse_phone("tS").token == "ʧ"


def test_alignment_typology():
    """θ->t substitution, correct vowel-with-stress-mismatch, exact tail."""
    tmp, raw = _fresh_corpus()
    tg = textgrid.read_textgrid(raw / "TASK1 audio&textgrids" / "S01T1.TextGrid")
    utts, warnings = build.load_utterances(tg, "S01", "T1")
    assert len(utts) == 1
    tokens = align.align_intervals(utts[0].ref_phones, utts[0].act_phones, utts[0].words)

    by_target = {t.target: t for t in tokens}
    # θ realised as t -> substitution
    assert by_target["θ"].error == "substitute"
    assert by_target["θ"].actual == "t"
    # ŋ and k correct
    assert by_target["ŋ"].error == "correct"
    assert by_target["k"].error == "correct"
    # ɪ correct segmentally but stress differs (primary vs secondary)
    assert by_target["ɪ"].error == "correct"
    assert by_target["ɪ"].stress_error is True


def test_insertion_detected():
    """Prothetic ɯ before /s/ is an insertion, ɹ->ɾ a substitution."""
    tmp, raw = _fresh_corpus()
    tg = textgrid.read_textgrid(raw / "TASK2 audio&textgrids" / "S01T2.TextGrid")
    utts, _ = build.load_utterances(tg, "S01", "T2")
    tokens = align.align_intervals(utts[0].ref_phones, utts[0].act_phones, utts[0].words)

    inserts = [t for t in tokens if t.error == "insert"]
    assert len(inserts) == 1
    assert inserts[0].actual == "ɯ"
    subs = {t.target: t.actual for t in tokens if t.error == "substitute"}
    assert subs.get("ɹ") == "ɾ"


def test_rhythm_metrics():
    tmp, raw = _fresh_corpus()
    tg = textgrid.read_textgrid(raw / "TASK1 audio&textgrids" / "S01T1.TextGrid")
    utts, _ = build.load_utterances(tg, "S01", "T1")
    m = rhythm.compute_rhythm(utts[0].act_phones)
    # think = t ɪ ŋ k -> C V C C ; %V should be finite and in (0,100)
    assert m.percent_v is not None
    assert 0 < m.percent_v < 100
    assert m.n_vocalic == 1


def test_exb_metadata():
    tmp, raw = _fresh_corpus()
    tr = exb.parse_exb(raw / "exb files" / "S01T1.exb")
    assert tr.project_name == "CORPTES"
    sp = tr.speakers["SPK0"]
    assert sp.sex == "f"
    assert sp.l1 == ["tur"]
    assert sp.ud["age"] == "21"
    assert sp.ud["learner_level_CEFR_conversion"] == "B2"
    # Annotation tier is discoverable and typed.
    ann = tr.tiers(type="a")
    assert len(ann) == 1
    assert ann[0].category == "error"
    assert ann[0].events[0].text == "TH-stopping"


def test_exb_unanchored_timeline():
    """T1 has no @time; it should interpolate to the midpoint of T0..T2."""
    tmp, raw = _fresh_corpus()
    tr = exb.parse_exb(raw / "exb files" / "S01T1.exb")
    anchored = tr.anchored_timeline()
    assert anchored["T0"] == 0.0
    assert anchored["T2"] == 1.0
    assert abs(anchored["T1"] - 0.5) < 1e-9


def test_full_build_emits_artifacts():
    tmp, raw = _fresh_corpus()
    out = tmp / "site"
    rc = build.build(raw, out, cut_clips=False)
    assert rc == 0

    manifest = json.loads((out / "data" / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["build"]["utterances"] == 2
    assert "vowels" in manifest["areas"]
    assert "S01" in manifest["speakers"]
    assert manifest["speakers"]["S01"]["age"] == "21"

    # Public artifacts expose a production phone with a binary judgment.
    t_rows = json.loads(
        (out / "data" / "tokens" / "consonants" / f"{quote('t', safe='')}.json").read_text(encoding="utf-8")
    )
    assert any(row["ph"] == "t" and row["e"] == "incorrect" for row in t_rows)

    # Area stats expose Correct/Incorrect, never a fabricated confusion.
    cons = json.loads((out / "data" / "areas" / "consonants.json").read_text(encoding="utf-8"))
    t_stat = next(p for p in cons["phones"] if p["phone"] == "t")
    assert t_stat["incorrect"] >= 1
    assert "confusions" not in t_stat

    # Per-utterance detail carries tokens + rhythm.
    utt = json.loads(
        (out / "data" / "utterances" / "S01T1_000.json").read_text(encoding="utf-8")
    )
    assert utt["judged"] is True
    assert utt["rhythm"]["percentV"] is not None
    assert len(utt["tokens"]) == 4


def _run_all():
    fns = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    failed = 0
    for fn in fns:
        try:
            fn()
            print(f"  PASS {fn.__name__}")
        except Exception as e:
            failed += 1
            print(f"  FAIL {fn.__name__}: {type(e).__name__}: {e}")
    print(f"\n{len(fns) - failed}/{len(fns)} passed")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(_run_all())
