"""
vocab_probe.py — verify all arpa2powsm assumptions against live POWSM token list
and actual PR output on real audio.

Run inside the assessment worker container:
    docker exec senior-worker-assessment-1 python3 /worker/scripts/vocab_probe.py
"""
import sys
import librosa
import glob

sys.path.insert(0, '/worker')
from alignment import get_aligner

aligner = get_aligner()
tl = aligner.token_list
tl_set = set(tl)

# ─── 1. Vocab presence check ────────────────────────────────────────────────
print("=" * 60)
print("1. VOCAB PRESENCE CHECK")
print("=" * 60)

checks = {
    "diphthong single tokens (expected NO)": ["oʊ","eɪ","aɪ","aʊ","ɔɪ"],
    "diphthong components (expected YES)":   ["o","ʊ","e","ɪ","a","ɔ"],
    "affricates single (expected NO)":       ["tʃ","dʒ"],
    "affricate components (expected YES)":   ["t","ʃ","d","ʒ"],
    "r-colored vowels":                      ["ɚ","ɝ","ɜ","ɜ˞"],
    "length marks":                          ["iː","uː","ɜː"],
    "Turkish / non-English":                 ["ɯ","œ","ɾ","ɐ"],
    "standard vowels":                       ["ə","ʌ","æ","ɛ","i","u","ɑ","ɔ"],
    "standard consonants":                   ["θ","ð","ŋ","ɹ","ɡ","h","n","m","l"],
}

for group, phones in checks.items():
    results = [("YES" if f"/{p}/" in tl_set else "NO ") + f" /{p}/" for p in phones]
    print(f"\n{group}:")
    for r in results:
        print(f"  {r}")

# ─── 2. What does POWSM actually output for English diphthongs / ER? ────────
print()
print("=" * 60)
print("2. FREE ALIGNMENT ON REAL CLIPS")
print("=" * 60)

clips = sorted(glob.glob('/data/test_recordings/erem/ref_0*.wav'))
if not clips:
    print("No clips found at /data/test_recordings/erem/")
else:
    for wav_path in clips[:5]:
        audio, _ = librosa.load(wav_path, sr=16000, mono=True)
        segs = aligner.free_alignment(audio)
        phones = [s.token for s in segs]
        print(f"\n{wav_path.split('/')[-1]}: {phones}")

# ─── 3. Tokenizer behaviour on IPA strings ──────────────────────────────────
print()
print("=" * 60)
print("3. TOKENIZER ROUND-TRIP")
print("=" * 60)

test_strings = [
    "/o//ʊ/",    # diphthong as two-phone input
    "/oʊ/",      # diphthong as single-phone input (should be OOV or split)
    "/e//ɪ/",
    "/t//ʃ/",
    "/d//ʒ/",
    "/ɯ/",       # Turkish back vowel
    "/œ/",       # Turkish front rounded
    "/ɜ//ɹ/",    # ER as two phones
    "/ɜ/",       # ER as single phone
    "/ɹ/",       # English r
    "/ɾ/",       # tap r
]

tokenizer = aligner.s2t.tokenizer
converter = aligner.s2t.converter
unk_id = converter.tokens2ids(["<unk>"])[0]

for s in test_strings:
    toks = tokenizer.text2tokens(s)
    toks = [t for t in toks if t != "▁"]
    ids = converter.tokens2ids(toks)
    oov = [t for t, i in zip(toks, ids) if i == unk_id]
    status = "OOV:" + str(oov) if oov else "OK"
    print(f"  {s:20s}  tokens={toks}  {status}")
