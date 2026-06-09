# Intelligibility rating harness (E6 #34)

Blind 1–5 human intelligibility ratings of learner recordings, to correlate with the
system's pronunciation score (Spearman ρ, #35). **No phonetic annotation needed** — any
2–3 reasonably fluent English listeners can rate; this is *not* a linguist task.

## Pieces

- `scripts/build_rating_manifest.py` → writes `clips.json` (learner clips + a few native
  "anchor" clips as blind scale controls). Speaker identity is hidden under `_`-prefixed keys.
- `rate.html` → self-contained rater UI. Plays clips in a per-rater randomized order, collects
  1–5 + optional notes, saves progress in the browser, exports `ratings_<id>.csv`.

## Cohort

100 learner clips (erem/omer/umit/ibrahim × 25 sentences) + umut × 25 once split = **125**,
plus 12 native anchors = ~137. Per-clip n is ample; note clips are **speaker-clustered**
(5 learners), so report ρ per-clip with that caveat, or aggregate per speaker as a check.

## Running a rating session

Audio is Git-LFS-tracked, so first make the clips real on the machine that will serve them:

```bash
git lfs pull --include "data/test_recordings/**,data/references/**"   # turn pointers into audio
python scripts/build_rating_manifest.py                               # (re)build clips.json
python3 -m http.server 8080                                           # FROM THE REPO ROOT
# open http://localhost:8080/sig/validation/rate.html
```

`rate.html` fetches `clips.json` and loads audio by repo-root-relative path, so the server
**must** run at the repo root. Each rater enters initials, rates every clip, clicks
"Download my ratings", and sends back `ratings_<id>.csv`.

For remote raters: either give them the repo (LFS-pulled) + these commands, or zip
`sig/validation/` + the referenced `data/...wav` files preserving paths and have them serve
the zip root.

## Then (analysis, #35)

Collect the `ratings_*.csv`, join `clip_id → _speaker/_ref` (from `clips.json`) and the
system score per clip (from `scripts/batch_assess.py`, #33), and compute Spearman ρ
(system vs mean human rating) + inter-rater agreement (Krippendorff α / Cohen κ).

## Design notes

- **Blind:** raters never see speaker id, L1, or whether a clip is a native anchor.
- **Target shown:** the sentence text is displayed — this is read-aloud speech, so raters judge
  comprehensibility of a *known* utterance, which matches the reference-based system score.
- **Anchors:** native clips should score ~5; they validate the scale and flag inattentive raters.
- Ratings persist in `localStorage` keyed by rater name — reopening and re-entering the same
  name resumes where they left off.
