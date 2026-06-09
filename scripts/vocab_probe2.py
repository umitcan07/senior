"""Run inside assessment container to check ER/IY/UW mappings."""
import sys, librosa
sys.path.insert(0, '/worker')
from alignment import get_aligner
aligner = get_aligner()
tl_set = set(aligner.token_list)
tok = aligner.s2t.tokenizer
conv = aligner.s2t.converter
unk_id = conv.tokens2ids(['<unk>'])[0]

# --- Vocab check ---
extras = ['ɜ˞','ə˞','ɚ','ɝ','iː','i','uː','u','kʰ','tʰ','pʰ','bʰ','dʰ','ɡʰ']
print("Vocab check:")
for p in extras:
    t = '/' + p + '/'
    print("  " + p + " " + ("YES" if t in tl_set else "NO"))

# --- Tokenizer round-trip ---
print("\nTokenizer round-trip:")
tests = ['/iː/', '/i/', '/uː/', '/u/', '/ɜ˞/', '/ə˞/', '/kʰ/', '/tʰ/']
for s in tests:
    toks = [t for t in tok.text2tokens(s) if t != '▁']
    ids = conv.tokens2ids(toks)
    oov = [t for t,i in zip(toks,ids) if i==unk_id]
    status = "OOV:" + str(oov) if oov else "OK"
    print("  " + s + " -> " + str(toks) + "  " + status)

# --- Count iː vs i in free alignment of 10 erem clips ---
import glob
clips = sorted(glob.glob('/data/test_recordings/erem/ref_0*.wav'))[:10]
from collections import Counter
counts = Counter()
for wav_path in clips:
    audio, _ = librosa.load(wav_path, sr=16000, mono=True)
    segs = aligner.free_alignment(audio)
    for s in segs:
        if s.token in ('iː','i','uː','u','ɜ˞','ə˞','ɚ'):
            counts[s.token] += 1

print("\nToken frequency in erem clips:")
for tok_name, cnt in sorted(counts.items()):
    print("  " + tok_name + ": " + str(cnt))
