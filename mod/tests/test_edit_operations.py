import unittest
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from assessment.edit_distance import edit_operations

class TestEditOperations(unittest.TestCase):
    
    def test_identical_strings(self):
        actual = list("hello")
        reference = list("hello")
        ops = edit_operations(actual, reference)
        self.assertEqual(ops, [])
    
    def test_empty_to_empty(self):
        actual = []
        reference = []
        ops = edit_operations(actual, reference)
        self.assertEqual(ops, [])
    
    def test_empty_to_non_empty(self):
        actual = []
        reference = list("abc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 3)
        self.assertTrue(all(op[0] == "delete" for op in ops))
        self.assertEqual(ops[0], ("delete", 0, "a"))
        self.assertEqual(ops[1], ("delete", 1, "b"))
        self.assertEqual(ops[2], ("delete", 2, "c"))
    
    def test_non_empty_to_empty(self):
        actual = list("abc")
        reference = []
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 3)
        self.assertTrue(all(op[0] == "insert" for op in ops))
        self.assertEqual(ops[0], ("insert", 0, "a"))
        self.assertEqual(ops[1], ("insert", 1, "b"))
        self.assertEqual(ops[2], ("insert", 2, "c"))
    
    def test_single_substitution(self):
        actual = list("abc")
        reference = list("axc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("substitute", 1, "x", "b"))
    
    def test_single_insertion(self):
        actual = list("ac")
        reference = list("abc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("delete", 1, "b"))
    
    def test_single_deletion(self):
        actual = list("abc")
        reference = list("ac")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("insert", 1, "b"))
    
    def test_multiple_substitutions(self):
        actual = list("abc")
        reference = list("xyz")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 3)
        self.assertTrue(all(op[0] == "substitute" for op in ops))
    
    def test_insert_at_beginning(self):
        actual = list("bc")
        reference = list("abc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("delete", 0, "a"))
    
    def test_insert_at_end(self):
        actual = list("ab")
        reference = list("abc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("delete", 2, "c"))
    
    def test_delete_at_beginning(self):
        actual = list("abc")
        reference = list("bc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("insert", 0, "a"))
    
    def test_delete_at_end(self):
        actual = list("abc")
        reference = list("ab")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("insert", 2, "c"))
    
    def test_mixed_operations(self):
        actual = list("kitten")
        reference = list("sitting")
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
    
    def test_complex_transformation(self):
        actual = list("saturday")
        reference = list("sunday")
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
    
    def test_single_character_different(self):
        actual = list("a")
        reference = list("b")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("substitute", 0, "b", "a"))
    
    def test_single_character_same(self):
        actual = list("a")
        reference = list("a")
        ops = edit_operations(actual, reference)
        self.assertEqual(ops, [])
    
    def test_all_different_lengths(self):
        actual = list("abc")
        reference = list("defgh")
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
    
    def test_prefix_match(self):
        actual = list("prefix123")
        reference = list("prefix456")
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
    
    def test_suffix_match(self):
        actual = list("123suffix")
        reference = list("456suffix")
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
    
    def test_multiple_insertions(self):
        actual = list("ac")
        reference = list("abcdef")
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
    
    def test_multiple_deletions(self):
        actual = list("abcdef")
        reference = list("ac")
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
    
    def test_operations_preserve_original_indices(self):
        actual = list("abc")
        reference = list("axc")
        ops = edit_operations(actual, reference)
        self.assertEqual(ops[0][1], 1)
        self.assertEqual(ops[0][0], "substitute")
        self.assertEqual(ops[0][2], "x")
        self.assertEqual(ops[0][3], "b")
    
    # Phonetic symbol tests
    def test_ipa_phonemes_identical(self):
        """Test that identical IPA phonemes produce no operations"""
        actual = ["h", "ɛ", "l", "o", "ʊ"]
        reference = ["h", "ɛ", "l", "o", "ʊ"]
        ops = edit_operations(actual, reference)
        self.assertEqual(ops, [])
    
    def test_ipa_phoneme_substitution(self):
        """Test substitution of IPA phonemes"""
        actual = ["h", "ɛ", "l", "o", "ʊ"]
        reference = ["h", "e", "l", "o", "ʊ"]
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0][0], "substitute")
        self.assertEqual(ops[0][1], 1)
        self.assertEqual(ops[0][2], "e")
        self.assertEqual(ops[0][3], "ɛ")
    
    def test_ipa_phoneme_insertion(self):
        """Test insertion (extra phoneme in actual)"""
        actual = ["h", "ɛ", "l", "l", "o", "ʊ"]
        reference = ["h", "ɛ", "l", "o", "ʊ"]
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0][0], "insert")
        self.assertEqual(ops[0][1], 2)
        self.assertEqual(ops[0][2], "l")
    
    def test_ipa_phoneme_deletion(self):
        """Test deletion (missing phoneme in actual)"""
        actual = ["h", "ɛ", "l", "ʊ"]
        reference = ["h", "ɛ", "l", "o", "ʊ"]
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0][0], "delete")
        self.assertEqual(ops[0][1], 3)
        self.assertEqual(ops[0][2], "o")
    
    def test_ipa_complex_operations(self):
        """Test complex operations with IPA phonemes"""
        actual = ["h", "ɛ", "l", "o"]
        reference = ["h", "ə", "l", "o", "ʊ"]
        ops = edit_operations(actual, reference)
        self.assertGreater(len(ops), 0)
        op_types = [op[0] for op in ops]
        self.assertIn("substitute", op_types)
        self.assertIn("delete", op_types)
    
    def test_ipa_diphthongs(self):
        """Test with IPA diphthongs"""
        actual = ["aɪ", "k", "æ", "n"]
        reference = ["aɪ", "k", "æ", "n"]
        ops = edit_operations(actual, reference)
        self.assertEqual(ops, [])
    
    def test_ipa_diphthong_substitution(self):
        """Test substitution of diphthongs"""
        actual = ["aɪ", "k", "æ", "n"]
        reference = ["eɪ", "k", "æ", "n"]
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0][0], "substitute")
        self.assertEqual(ops[0][2], "eɪ")
        self.assertEqual(ops[0][3], "aɪ")
    
    def test_ipa_stress_markers(self):
        """Test with stress markers"""
        actual = ["ˈh", "ɛ", "l", "o"]
        reference = ["ˈh", "ɛ", "l", "o"]
        ops = edit_operations(actual, reference)
        self.assertEqual(ops, [])
    
    def test_ipa_missing_stress(self):
        """Test missing stress marker (treated as substitution since 'h' != 'ˈh')"""
        actual = ["h", "ɛ", "l", "o"]
        reference = ["ˈh", "ɛ", "l", "o"]
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0][0], "substitute")
        self.assertEqual(ops[0][1], 0)
        self.assertEqual(ops[0][2], "ˈh")
        self.assertEqual(ops[0][3], "h")
    
    def test_ipa_extra_stress(self):
        """Test extra stress marker (treated as substitution since 'ˈh' != 'h')"""
        actual = ["ˈh", "ɛ", "l", "o"]
        reference = ["h", "ɛ", "l", "o"]
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0][0], "substitute")
        self.assertEqual(ops[0][1], 0)
        self.assertEqual(ops[0][2], "h")
        self.assertEqual(ops[0][3], "ˈh")
    
    def test_ipa_mixed_phonemes(self):
        """Test with various IPA symbols"""
        actual = ["θ", "ɪ", "ŋ", "k"]
        reference = ["θ", "ɪ", "ŋ", "k"]
        ops = edit_operations(actual, reference)
        self.assertEqual(ops, [])
    
    def test_ipa_phoneme_change(self):
        """Test changing one IPA phoneme"""
        actual = ["θ", "ɪ", "ŋ", "k"]
        reference = ["θ", "ɛ", "ŋ", "k"]
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0][0], "substitute")
        self.assertEqual(ops[0][2], "ɛ")
        self.assertEqual(ops[0][3], "ɪ")


if __name__ == "__main__":
    unittest.main()

