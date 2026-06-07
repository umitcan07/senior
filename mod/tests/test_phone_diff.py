import unittest
import sys
import os

# Add parent directory (mod/) to path so `phone_diff` and `assessment` resolve.
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from phone_diff import phone_diff, _align, _binary_sub_cost

# phone_diff now uses an articulatory-feature substitution cost (E7.6 / #57) that
# needs panphon. The tests below still hold under feature cost (scale 2.0 keeps a
# substitution no costlier than ins+del, so the sub-first tie-break still wins), but
# they require panphon at call time. Skip them gracefully on a bare host; the binary
# path is still covered panphon-free by TestBinaryAlignerEquivalence.
try:
    import panphon  # noqa: F401

    _HAS_PANPHON = True
except Exception:  # noqa: BLE001
    _HAS_PANPHON = False


@unittest.skipUnless(_HAS_PANPHON, "panphon not installed (feature cost unavailable)")


class TestPhoneDiffPER(unittest.TestCase):

    def test_identical_is_zero(self):
        result = phone_diff(["h", "ɛ", "l", "o", "ʊ"], ["h", "ɛ", "l", "o", "ʊ"])
        self.assertEqual(result["per"], 0.0)
        self.assertEqual(result["errors"], [])

    def test_one_substitution_in_five(self):
        result = phone_diff(["h", "ɛ", "l", "o", "ʊ"], ["h", "ɛ", "l", "a", "ʊ"])
        self.assertAlmostEqual(result["per"], 0.2)
        self.assertEqual(len(result["errors"]), 1)

    def test_one_insertion(self):
        # User said an extra phone.
        result = phone_diff(["k", "æ", "t"], ["k", "æ", "h", "t"])
        self.assertAlmostEqual(result["per"], 1 / 3)
        self.assertEqual(len(result["errors"]), 1)
        self.assertEqual(result["errors"][0]["type"], "ins")

    def test_one_deletion(self):
        # User dropped a phone.
        result = phone_diff(["k", "æ", "t"], ["k", "t"])
        self.assertAlmostEqual(result["per"], 1 / 3)
        self.assertEqual(len(result["errors"]), 1)
        self.assertEqual(result["errors"][0]["type"], "del")

    def test_empty_ref_and_empty_user(self):
        result = phone_diff([], [])
        self.assertEqual(result["per"], 0.0)
        self.assertEqual(result["errors"], [])
        self.assertEqual(result["alignment"], [])

    def test_empty_ref_nonempty_user(self):
        result = phone_diff([], ["a", "b"])
        self.assertEqual(result["per"], 1.0)
        self.assertEqual(len(result["errors"]), 2)
        self.assertTrue(all(e["type"] == "ins" for e in result["errors"]))


@unittest.skipUnless(_HAS_PANPHON, "panphon not installed (feature cost unavailable)")
class TestPhoneDiffErrorShape(unittest.TestCase):

    def test_substitution_fields(self):
        result = phone_diff(["θ"], ["t"])
        err = result["errors"][0]
        self.assertEqual(err["type"], "sub")
        self.assertEqual(err["expected"], "θ")
        self.assertEqual(err["actual"], "t")
        self.assertEqual(err["ref_position"], 0)
        self.assertEqual(err["user_position"], 0)

    def test_insertion_fields(self):
        result = phone_diff(["k", "t"], ["k", "h", "t"])
        err = next(e for e in result["errors"] if e["type"] == "ins")
        self.assertEqual(err["actual"], "h")
        self.assertEqual(err["user_position"], 1)
        self.assertIsNone(err["expected"])
        self.assertIsNone(err["ref_position"])

    def test_deletion_fields(self):
        result = phone_diff(["k", "h", "t"], ["k", "t"])
        err = next(e for e in result["errors"] if e["type"] == "del")
        self.assertEqual(err["expected"], "h")
        self.assertEqual(err["ref_position"], 1)
        self.assertIsNone(err["actual"])
        self.assertIsNone(err["user_position"])

    def test_error_types_are_short_labels(self):
        result = phone_diff(["a", "b", "c"], ["x", "b"])
        self.assertTrue(all(e["type"] in ("sub", "ins", "del") for e in result["errors"]))


@unittest.skipUnless(_HAS_PANPHON, "panphon not installed (feature cost unavailable)")
class TestPhoneDiffAlignment(unittest.TestCase):

    def test_alignment_includes_matches(self):
        result = phone_diff(["k", "æ", "t"], ["k", "æ", "t"])
        self.assertEqual(len(result["alignment"]), 3)
        self.assertTrue(all(row["op"] == "match" for row in result["alignment"]))
        self.assertEqual([r["ref"] for r in result["alignment"]], ["k", "æ", "t"])

    def test_alignment_op_sequence(self):
        # ref k æ t  vs  user k a t  -> match, sub, match
        result = phone_diff(["k", "æ", "t"], ["k", "a", "t"])
        self.assertEqual([r["op"] for r in result["alignment"]], ["match", "sub", "match"])

    def test_alignment_round_trips_to_errors(self):
        result = phone_diff(["θ", "ɪ", "ŋ", "k"], ["t", "ɪ", "n", "k"])
        non_match = [r for r in result["alignment"] if r["op"] != "match"]
        self.assertEqual(len(non_match), len(result["errors"]))

    def test_thing_example(self):
        # "think" mispronounced: θ->t, ŋ->n. From the plan's sanity check.
        result = phone_diff(["θ", "ɪ", "ŋ", "k"], ["t", "ɪ", "n", "k"])
        subs = [e for e in result["errors"] if e["type"] == "sub"]
        self.assertEqual(len(subs), 2)
        self.assertEqual(result["per"], 0.5)
        self.assertEqual(len(result["alignment"]), 4)


@unittest.skipUnless(_HAS_PANPHON, "panphon not installed (feature cost unavailable)")
class TestPhoneDiffIpaAtomicity(unittest.TestCase):

    def test_multicodepoint_phones_are_atomic(self):
        # Diphthong eɪ and multi-byte θ/ŋ are single tokens, not split.
        result = phone_diff(["θ", "eɪ", "ŋ"], ["θ", "eɪ", "ŋ"])
        self.assertEqual(result["per"], 0.0)
        self.assertEqual(len(result["alignment"]), 3)

    def test_diphthong_substitution(self):
        # eɪ is multi-segment -> uncovered -> fallback cost 2.0; tie-break still
        # picks `sub` (2.0 == ins+del), so the diphthong stays one substitution.
        result = phone_diff(["b", "eɪ", "t"], ["b", "ɛ", "t"])
        self.assertEqual(len(result["errors"]), 1)
        self.assertEqual(result["errors"][0]["expected"], "eɪ")
        self.assertEqual(result["errors"][0]["actual"], "ɛ")


@unittest.skipUnless(_HAS_PANPHON, "panphon not installed (feature cost unavailable)")
class TestFeatureAlignment(unittest.TestCase):
    """Behavior that is specifically different under the feature cost (the #57 fix)."""

    def test_close_phone_collapses_insdel_pair_into_sub(self):
        # Canonical case from doc/e7.6_panphon_feasibility.md §3.2 (real: erem ref_004).
        # ref "ɡ ə˞" vs user "ɡ ə ɹ": the rhotic-schwa target should match the plain
        # schwa (small Δ) and the extra ɹ should be a clean insertion — NOT the binary
        # mislocation ins(ə) · sub(ə˞→ɹ).
        result = phone_diff(["ɡ", "ə˞"], ["ɡ", "ə", "ɹ"])
        ops = [(a["op"], a["ref"], a["user"]) for a in result["alignment"]]
        self.assertEqual(
            ops, [("match", "ɡ", "ɡ"), ("sub", "ə˞", "ə"), ("ins", None, "ɹ")]
        )

    def test_alignment_round_trips_under_feature_cost(self):
        # Float traceback must not drop or mis-type ops: every non-match row is an error.
        result = phone_diff(["θ", "ɪ", "ŋ", "k", "ə˞"], ["t", "ɪ", "n", "k", "ə", "ɹ"])
        non_match = [r for r in result["alignment"] if r["op"] != "match"]
        self.assertEqual(len(non_match), len(result["errors"]))
        for r in result["alignment"]:
            self.assertIn(r["op"], ("match", "sub", "ins", "del"))


class TestBinaryAlignerEquivalence(unittest.TestCase):
    """The binary cost (sub=2) must still reproduce the pre-E7.6 alignment exactly.
    Panphon-free: this is the production-side mirror of the POC's 75/75 fidelity guard."""

    def _ops(self, ref, user):
        return [(o, r, u) for o, _ri, _ui, r, u in _align(ref, user, _binary_sub_cost)]

    def test_substitution(self):
        self.assertEqual(
            self._ops(["k", "æ", "t"], ["k", "a", "t"]),
            [("match", "k", "k"), ("sub", "æ", "a"), ("match", "t", "t")],
        )

    def test_insertion(self):
        self.assertEqual(
            self._ops(["k", "t"], ["k", "h", "t"]),
            [("match", "k", "k"), ("ins", None, "h"), ("match", "t", "t")],
        )

    def test_deletion(self):
        self.assertEqual(
            self._ops(["k", "h", "t"], ["k", "t"]),
            [("match", "k", "k"), ("del", "h", None), ("match", "t", "t")],
        )

    def test_binary_keeps_insdel_pair_uncollapsed(self):
        # Under binary cost the §3.2 case stays mislocated — proves the feature cost
        # (not some other change) is what collapses it.
        self.assertEqual(
            self._ops(["ɡ", "ə˞"], ["ɡ", "ə", "ɹ"]),
            [("match", "ɡ", "ɡ"), ("ins", None, "ə"), ("sub", "ə˞", "ɹ")],
        )


if __name__ == "__main__":
    unittest.main()
