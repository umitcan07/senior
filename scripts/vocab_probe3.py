"""
Validate all generated manifest text files against the live POWSM token list.
Run inside assessment container:
    docker exec senior-worker-assessment-1 python3 /worker/scripts/vocab_probe3.py
"""
import sys, os, glob
sys.path.insert(0, '/worker')
from alignment import get_aligner

aligner = get_aligner()
tl = aligner.token_list
tl_set = set(tl)
tok = aligner.s2t.tokenizer
conv = aligner.s2t.converter
unk_id = conv.tokens2ids(['<unk>'])[0]

manifest_dir = '/data/finetune'
text_files = glob.glob(os.path.join(manifest_dir, '**', 'text'), recursive=True)

print("Checking manifests under", manifest_dir)
print()

all_oov = {}
for tf in sorted(text_files):
    oov_phones = set()
    total = 0
    with open(tf, encoding='utf-8') as f:
        for line in f:
            parts = line.strip().split(None, 1)
            if len(parts) < 2:
                continue
            espnet_text = parts[1]
            toks = [t for t in tok.text2tokens(espnet_text) if t != '▁']
            ids = conv.tokens2ids(toks)
            for t, i in zip(toks, ids):
                total += 1
                if i == unk_id:
                    oov_phones.add(t)
    rel = os.path.relpath(tf, manifest_dir)
    status = "CLEAN" if not oov_phones else ("OOV: " + str(sorted(oov_phones)))
    print(f"  {rel:45s}  {total:6d} tokens  {status}")
    if oov_phones:
        all_oov[rel] = oov_phones

print()
if all_oov:
    print("FAIL: OOV phones found. Fix arpa2powsm.py before training.")
else:
    print("PASS: All phones are in POWSM vocabulary. Safe to train.")
