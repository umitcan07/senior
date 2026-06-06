# Turkish-L1 English corpus (POWSM fine-tune)

Tools and QC gates for the ~6 h Turkish-native English recording corpus (30 speakers × read-aloud + interview). **Raw audio is not committed** — only scripts, QC docs, and small generated manifests.

## Raw data location

Place the EXMARALDA export locally (folder name often `Corpus Files`):

```
Corpus Files/
  TASK1 audio&textgrids/   # read-aloud → label tier `phones`
  TASK2 audio&textgrids/   # interview   → label tier `REF-phones`
  README.docx
  exb files/
  coma files/
```

Point scripts at it with:

```bash
export CORPUS_RAW_DIR="$HOME/Downloads/Corpus Files"   # Linux/macOS
# PowerShell: $env:CORPUS_RAW_DIR = "$env:USERPROFILE\Downloads\Corpus Files"
```

Or symlink into the repo (gitignored):

```bash
# from repo root
ln -s "/path/to/Corpus Files" corpus/raw
```

## QC workflow

Follow **[finetune_qc.md](./finetune_qc.md)** gates 0–12 before ESPnet fine-tune and Nounce deploy (V2 **A6**, **D1/D2**). See also `doc/V2_CONTEXT.md` §3 (POWSM).

## Analysis scripts

From repo root (Python 3.10+):

```bash
python corpus/scripts/analyze_corpus.py
python corpus/scripts/analyze_corpus_deep.py
python corpus/scripts/analyze_corpus_chunks.py
```

Optional: write a report under `corpus/reports/` (gitignored):

```bash
python corpus/scripts/analyze_corpus.py > corpus/reports/inventory.txt
```

## Processed outputs (future)

Gate artifacts (`manifest_chunks.tsv`, ESPnet `wav.scp`, splits) should live under `corpus/processed/` — not committed until curated and small enough for review.
