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
        self.assertTrue(all(op[0] == "insert" for op in ops))
    
    def test_non_empty_to_empty(self):
        actual = list("abc")
        reference = []
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 3)
        self.assertTrue(all(op[0] == "delete" for op in ops))
    
    def test_single_substitution(self):
        actual = list("abc")
        reference = list("axc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("substitute", 1, "x"))
    
    def test_single_insertion(self):
        actual = list("ac")
        reference = list("abc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("insert", 1, "b"))
    
    def test_single_deletion(self):
        actual = list("abc")
        reference = list("ac")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("delete", 1))
    
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
        self.assertEqual(ops[0], ("insert", 0, "a"))
    
    def test_insert_at_end(self):
        actual = list("ab")
        reference = list("abc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("insert", 2, "c"))
    
    def test_delete_at_beginning(self):
        actual = list("abc")
        reference = list("bc")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("delete", 0))
    
    def test_delete_at_end(self):
        actual = list("abc")
        reference = list("ab")
        ops = edit_operations(actual, reference)
        self.assertEqual(len(ops), 1)
        self.assertEqual(ops[0], ("delete", 2))
    
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
        self.assertEqual(ops[0], ("substitute", 0, "b"))
    
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


if __name__ == "__main__":
    unittest.main()

