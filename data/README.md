# `data/` — audio fixtures + offline verification ground

DB-free fixtures for the V2 pronunciation pipeline. Everything an agent needs to run a real WAV
through POWSM (phone recognition, CTC forced/free alignment, GOP) and check the result lives here
— **no Neon, no RunPod cloud, no R2 fetch required**.

Recordings are keyed by **author**, so any number of GenAm/RP voices coexist without colliding.
`data/authors.json` holds who's who; `mod/dev/verify.py` discovers clips on disk.

## Layout

```
data/
  authors.json                            # hand-maintained: author_id -> {kind, dialect, name, ...}
  manifest.json                           # generated prompt index: sentences + /learn word->dest
  references/<author>/ref_NNN.wav         # native reference speeches (+ ref_NNN.expected.json goldens)
  learn/<author>/word_NN.wav              # /learn example-word recordings (per author -> US/UK toggle, E9.3)
  test_recordings/<speaker>/ref_NNN.wav   # learner/test attempts, id-matched to the sentence
  labels/<author>.txt                     # Audacity-format cut points (start TAB end TAB id) — provenance
  fiverr/<author>.wav                     # GITIGNORED order takes (one file = sentences + words)
  raw/                                    # GITIGNORED — your own raw test recordings
```

## IDs & authors

- **`ref_NNN`** — the 25 validation sentences, 3-digit, matching `doc/validation_sentences.md`.
- **`word_NN`** — `/learn` recordings, one slot per take. `word_01..40` are the 40 example words;
  `word_41/42/43` are the **second takes** of the three words that back two `/learn` files
  (`cat`→`cat-k.wav`, `go`→`go-g.wav`, `sit`→`sit-s.wav`). Each slot's `dest` is in `manifest.json`.
- **Author id** = `<dialect>_<name>` for reference voices (`genam_jordan`, `rp_jon`); test users get
  any short id (`umit`). Define each in `data/authors.json` with `kind` (`reference`/`test_user`) and,
  for reference voices, `dialect` (`genam`/`rp`). **Add authors there first**, then run
  `python scripts/gen_manifest.py` if the source lists changed.

## Add an author's audio

The order takes are one continuous file (sentences + words). The recommended path maps them by
content, so it tolerates comma pauses, retakes, and missing/extra utterances.

> One-time setup: the verify harness uses Whisper for clean ASR. Install it into the dev worker:
> `docker compose -f docker-compose.dev.yml exec worker-assessment pip install -r /worker/dev/requirements-dev.txt`
> (See `mod/dev/requirements-dev.txt`. Set `VERIFY_ASR=powsm` to skip it and use POWSM's weaker ASR.)

### 1. automap (recommended)

Over-segments by silence, ASRs every piece (Whisper), then maps pieces → the known prompt order by
text overlap (DP). It **auto-merges** pause-split prompts (comma sentences), **skips** extra
utterances (retakes/junk), and **prefers one clean utterance** per prompt — robust to imperfect pauses.

```
docker compose -f docker-compose.dev.yml exec worker-assessment python3 \
  /worker/dev/verify.py automap --author genam_jordan --cut
```

Prints each prompt with recognized text + a word-overlap % (`??` below threshold is usually just a
short word/homophone Whisper mis-spells — `too`→"two", `ten`→"10"; audio is fine), writes
`data/labels/<author>.txt`, and with `--cut` cuts the clips. Drop `--cut` to review; add `--dump`
to print every detected piece for debugging. Knobs: `--min-silence`, `--max-merge`, `--skip-penalty`,
`--merge-cost`, `--noise`. Then mint goldens: `verify.py align-refs --author <id> --save`.

### Fallbacks (no Whisper / manual)

- **`scripts/auto_segment.py`** — ffmpeg `silencedetect` only, assigns ids by time order. Fast but
  only works when the detected count matches exactly; comma pauses cause over-splits. Tuning:
  `--min-silence`, `--merge-below <s>`, `--merge-at <s>`.
- **Audacity** — drag-select each utterance, `Ctrl+B`, type the id, **File → Export → Export Labels**
  to `data/labels/<author>.txt`, then `scripts/split_audio.py <labels.txt> <take.wav> --author <id>`.
  You can also import an automap/auto_segment label file into Audacity to nudge and re-export.

## Verify (inside the dev worker — GPU + model there)

```
python scripts/runpod.py        # bring up the docker-compose worker

# free-align one clip -> phones + timings
... verify.py align ref_001 --author genam_jordan
# (re)generate golden snapshots for every reference clip — commit these
... verify.py align-refs --save
# unbiased mapping check: ASR each sentence (no hint) vs expected text
... verify.py asr --author genam_jordan
# score a test recording vs a reference author's golden (phone diff + GOP)
... verify.py assess umit ref_001 --author genam_jordan
# regression check: re-align refs vs committed goldens (non-zero exit on DIFF)
... verify.py batch --check
```

`assess` needs which reference voice to compare against: pass `--author`, or `--dialect` when that
dialect has exactly one reference author.

**Goldens** (`*.expected.json`) are pinned baseline POWSM output, not hand-verified ground truth. A
`DIFF` from `batch --check` means "the Python change moved the output — review it"; regenerate with
`align-refs --save` when the model/checkpoint changes (e.g. the E5 fine-tune).

## Current dataset

Reference authors `genam_jordan`, `genam_katherine`, `genam_teyanna`, `rp_jon` — each 25 sentences
(+ goldens) and 43 /learn words. Notes:
- **rp_jon `word_40`** (wet) was missing from the main take; sourced from a separate take
  `data/fiverr/rp_jon_wet-wet.mp3` (cut via `data/labels/rp_jon_wet.txt`).
- **genam_jordan `ref_019`** says "…every morning" but the text is "…every evening" — pending a
  re-record; re-cut + `align-refs --save` that one clip when the new take arrives.

## Not here (on purpose)

The DB stays untouched. Loading these into Postgres (`practice_texts`, `authors`,
`reference_speeches` — one row per author×sentence) is the separate E4.4/E4.5 ingest (#26/#27); the
`/learn` upload using each `learn_words[].dest` per dialect is E9 (#44/#49, #48 toggle).
