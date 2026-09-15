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

from site_build import align, build, emit, exb, inventory, rhythm, textgrid, reference_ipa  # noqa: E402
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

    stress = json.loads((out / "data/tokens/stress/all.json").read_text(encoding="utf-8"))
    assert any(row["w"] == "think" and row["e"] == "incorrect" for row in stress)


def test_intonation_label_variants():
    assert build.intonation_labels("RISING -- YesNoQuestion") == ("Rising", "Yes/No Question")
    assert build.intonation_labels("RISING_YesNo") == ("Rising", "Yes/No Question")
    assert build.intonation_labels("RISEandFALL_ClosedC") == ("Rise & Fall", "Closed Choice")
    assert build.intonation_labels("RISE and FALL -- Listing") == ("Rise & Fall", "Listing")
    assert build.intonation_labels("FALLING_Wh") == ("Falling", "Wh Question")
    assert build.intonation_labels("FALLING") == ("Falling", None)
    assert build.intonation_labels("unrecognised") == (None, None)


def test_native_targets_and_exact_intonation_clip():
    """A sentence crossing chunk boundaries is exported once, with its own clip."""
    from unittest.mock import patch
    tmp, raw = _fresh_corpus()
    source = raw / "TASK1 audio&textgrids" / "S01T1.TextGrid"
    # Keep a >18s annotated sentence whole while ordinary chunks stay bounded.
    words = [(0, 1, "Before."), (1, 9, "Have"), (9, 18, "you"),
             (18, 19, "seen"), (19, 20, "a"), (20, 21, "wolf?"), (21, 22, "After.")]
    fixtures.write_textgrid(source, {
        "words": [(a, b, "wrong") for a, b, _ in words],
        "words-REF": words,
        "phones": [(1.1, 1.2, "h"), (20.1, 20.2, "w")],
    }, xmax=22)
    (raw / "exb files" / "S01T1.exb").write_text("""<basic-transcription><basic-body>
    <common-timeline><tli id="a" time="1"/><tli id="b" time="9"/>
    <tli id="c" time="18"/><tli id="d" time="20"/><tli id="e" time="21"/></common-timeline>
    <tier id="p" category="phoneAcc" type="a"><event start="a" end="e">incorrect</event></tier>
    <tier id="s" category="Stress_accuracy" type="a">
      <event start="a" end="b">correct</event><event start="d" end="e">incorrect</event></tier>
    <tier id="l" category="linkingAcc_accuracy" type="a"><event start="b" end="e">correct</event></tier>
    <tier id="i" category="Intonation_accuracy" type="a"><event start="a" end="e">incorrect</event></tier>
    <tier id="t" category="Intonation_types" type="a"><event start="a" end="e">RISING -- YesNoQuestion</event></tier>
    </basic-body></basic-transcription>""", encoding="utf-8")
    source.with_suffix(".wav").write_bytes(b"mock audio")
    planned = []
    def cut(_source, requested, _out, *, pad):
        assert pad == 0.0
        planned.extend(requested)
        return {c.identifier for c in requested}
    out = tmp / "feedback-site"
    with patch.object(build.clips, "cut_recording", side_effect=cut):
        assert build.build(raw, out, cut_clips=True, skip_pitch=True) == 0
    def read(path):
        return json.loads((out / "data" / path).read_text(encoding="utf-8"))
    phones = read("tokens/consonants/h.json")
    assert phones[0]["w"] == "Have"
    assert len(phones) == 1  # intonation detail must not inflate phone statistics
    stress = read("tokens/stress/all.json")
    assert [(r["w"], r["e"]) for r in stress] == [("Have", "correct"), ("wolf?", "incorrect")]
    linking = read("tokens/linking/all.json")
    assert len(linking) == 1
    assert linking[0]["w"] == "you seen a wolf?"
    rows = read("tokens/intonation/all.json")
    assert len(rows) == 1
    row = rows[0]
    assert row["tone"] == "Rising" and row["sentenceType"] == "Yes/No Question"
    assert row["w"] == "Have you seen a wolf?"
    detail = read(f"utterances/{row['u']}.json")
    assert detail["text"] == row["w"]
    assert detail["dur"] == 20 and detail["audioAvailable"]
    assert detail["annotations"] == rows
    assert all(0 <= t["t0"] < t["t1"] <= detail["dur"] for t in detail["tokens"])
    assert [c for c in planned if c.identifier == row["u"]] == [build.clips.Clip(row["u"], 1, 21)]
    assert row["u"] not in {u["id"] for u in read("manifest.json")["utterances"]}
    assert "referenceIpa" not in phones[0]

    # Reference words can cover annotation spans absent from the ordinary word
    # chunks. Keep those events as dedicated details instead of dropping them.
    tg = textgrid.read_textgrid(source)
    tr = exb.parse_exb(raw / "exb files" / "S01T1.exb")
    before = build.Utterance("before", "S01", "T1", 0, 1, "Before.", [], [], [])
    grouped, isolated = build.recording_annotations(tg, tr, [before], "S01", "T1")
    assert grouped == {}
    assert len(isolated) == 4
    assert [r["w"] for _, r in isolated if r["area"] == "lexical-stress"] == ["Have", "wolf?"]


def test_phone_word_boundary_does_not_merge_neighbours():
    words = [textgrid.Interval(0, 1, "birthday"), textgrid.Interval(1, 2, "party")]
    assert build.containing_word(words, .8, 1.01) == "birthday"
    assert build.containing_word(words, 1, 1.1) == "party"
    assert build.containing_word(words, 3, 4) == ""


def test_verified_reference_ipa_reaches_shards_and_details():
    tmp, raw = _fresh_corpus()
    dictionary = tmp / "reference.json"
    dictionary.write_text(json.dumps({"Birthday": ["/ˈbɜːθdeɪ/", "ˈbɜːθdeɪ", "ˈbɝθdeɪ"]}), encoding="utf-8")
    forms = reference_ipa.load(dictionary)
    writer = emit.SiteWriter(tmp / "site", forms)
    row = emit.TokenRow("test", "S01T1_000", "S01", "θ", "incorrect", 0, 1, word="birthday?")
    writer.add_token("consonants", row)
    annotation = {**row.as_dict(), "area": "lexical-stress"}
    writer.add_annotation("lexical-stress", annotation)
    writer.add_utterance({"id": row.utterance, "spk": row.speaker, "tokens": [row.as_dict()], "annotations": [annotation]})
    writer.flush_shards()
    writer.write_stress_stats()
    expected = ["ˈbɜːθdeɪ", "ˈbɝθdeɪ"]
    detail = json.loads((writer.data / "utterances" / "S01T1_000.json").read_text(encoding="utf-8"))
    assert detail["tokens"][0]["referenceIpa"] == expected
    assert detail["annotations"][0]["referenceIpa"] == expected
    for path in (writer.data / "tokens" / "consonants" / f"{quote('θ', safe='')}.json", writer.data / "tokens" / "stress" / "all.json"):
        assert json.loads(path.read_text(encoding="utf-8"))[0]["referenceIpa"] == expected
    assert "referenceIpa" not in reference_ipa.enrich({"w": "unknown"}, forms)


def test_invalid_dictionary_does_not_delete_existing_output():
    tmp, raw = _fresh_corpus()
    out = tmp / "existing"
    (out / "data").mkdir(parents=True)
    marker = out / "data" / "keep.txt"
    marker.write_text("existing")
    dictionary = tmp / "bad.json"
    dictionary.write_text('{"birthday": ["B ER1 TH D EY2"]}')
    try:
        build.build(raw, out, reference_ipa_path=dictionary)
    except ValueError:
        pass
    else:
        raise AssertionError("ARPABET must not be published as IPA")
    assert marker.read_text() == "existing"


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
