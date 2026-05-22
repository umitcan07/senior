# Nounce V2 — Plan

Senior project V2 deliverables. Defense: 13 June 2026.

---

## Context (one page)

**Project:** Nounce — web-based English pronunciation assessment for Turkish learners. User listens to a native reference recording, imitates it, gets phone-level feedback.

**Team:** 2 people, joint defense. Teammate handled fine-tuning.

**V1 → V2 in one line:** V1 was a working MVP with fake alignment, TTS references, no Turkish adaptation, and no validation. V2 fixes all four.

**V2 contributions:**
1. Real POWSM CTC alignment (replaces fake placeholder + abandoned MFA)
2. Reference-based assessment (compare to native reference audio, not canonical IPA from G2P)
3. Human reference recordings — US + UK dialects (replaces TTS)
4. Fine-tuned POWSM on 10h Turkish L1 dataset
5. Posterior-based GOP scoring (alongside edit distance)
6. VAD + abstention rules (no confident hallucination)
7. Human-judgment validation study (Spearman ρ vs expert ratings)

**Tech stack:** POWSM (espnet), POWSM CTC alignment, Silero VAD, RunPod serverless, TanStack Start, Clerk, Neon Postgres, Cloudflare R2, Fly.io.

**Out of scope for V2:** prosody, calibration with temperature scaling, multi-speaker per dialect, languages beyond English, dataset platform (scaffold only — full delivery post-defense).

---

## Issues

Each section below maps to one GitHub Issue. Title + body + acceptance.

---

### A0 — Remove fake alignment and MFA artifacts

**Body:**
- Grep repo for `uniform`, `random_align`, `fake_align`, `placeholder_align` — delete dead code
- Grep for `mfa`, `montreal`, `kaldi` — remove Dockerfile refs, scripts, deps
- Deprecate G2P endpoint (return 410 or remove)

**Acceptance:** no fake-alignment or MFA references remain outside changelogs.

---

### A1 — `mod/alignment.py`: POWSM CTC alignment

**Body:**

Two functions exposed:
- `free_alignment(audio)` → list of `{token, start_ms, end_ms, confidence}` (what the user said + timing)
- `forced_alignment(audio, canonical_ipa)` → same shape (canonical sequence + timing)

Wrapped in a `POWSMAligner` class that loads the model once and exposes `encode(audio)` returning CTC logprobs `[T, V]` plus `n_frames`.

Frame stride, blank token id, phone token format must be read from POWSM config, not hardcoded.

**Acceptance:** running on a reference WAV prints phone timing that aligns with what's heard. Output is JSON-serializable.

**Depends on:** A0

---

### A2 — `mod/precompute_references.py`: offline reference processing

**Body:**

Take a directory of reference WAVs + a manifest (text, dialect). For each:
- Upload audio to R2
- Run POWSM → store `phones[]`, `alignment[]`, optionally `posteriors`
- Write row to `references` table (Postgres)

CLI flag `--model <tag>` to switch between pretrained and fine-tuned POWSM (so we can re-run after A6).

Idempotent — re-running produces same DB state.

**Acceptance:** US + UK reference recordings ingested into DB after C3.

**Depends on:** A1

---

### A3 — `mod/phone_diff.py`: phone-level Levenshtein diff

**Body:**

Standard edit distance with backtracking. Returns:
- `errors[]` — substitutions, deletions, insertions with positions and expected/got
- `alignment[]` — ref-user phone pairs (match/sub/del/ins)
- `per` — edit_distance / len(ref)

**Acceptance:** unit tests cover 5–10 hand-crafted sequence pairs.

---

### A4 — `mod/gop_scoring.py`: Goodness of Pronunciation

**Body:**

Per aligned phone segment, compute from CTC logprobs:
- `gop_score` = mean log P(target) − mean max log P(other)
- `entropy` — mean frame entropy
- `margin` — top1 prob − top2 prob
- `uncertain` boolean based on entropy threshold (~2.0 nats, tune later)

**Acceptance:** correct recordings show positive GOP on most phones; deliberately wrong recordings drop sharply.

**Depends on:** A1

---

### A5 — `mod/assess.py`: refactored endpoint

**Body:**

Request:
```json
{ "user_audio": "<base64 wav>", "reference_id": "ref_001_us" }
```

Flow:
1. Silero VAD — if no speech, return `status: "no_speech"`
2. POWSMAligner on user audio → logprobs + free alignment
3. Fetch reference from DB
4. `phone_diff(ref.phones, user.phones)`
5. `compute_gop(...)` on user logprobs + alignment
6. Compute overall score; check abstention thresholds
7. Return combined JSON (schema in repo docs)

**Acceptance:** end-to-end test with 3 ref/user pairs returns sensible JSON in <3s on warm RunPod container.

**Depends on:** A1, A2, A3, A4, B1

---

### A6 — Deploy fine-tuned POWSM + re-precompute references

**Body:**
- Confirm with Ömer Faruk: checkpoint location, model tag, config diffs
- Push checkpoint to HF Hub (private) or RunPod volume
- Update POWSMAligner to load fine-tuned tag
- Re-run A2 with `--model <fine-tuned>` so reference cache reflects new model
- Redeploy endpoint

**Acceptance:** same user audio + reference returns different (more L2-aware) phone outputs than baseline. Spot-checked on 5 Turkish-accented recordings.

**Depends on:** A5

---

### B1 — Silero VAD integration

**Body:**
- Add `silero-vad` dep
- `_has_speech(audio, sr)` wrapper
- Used in A5 step 1

**Acceptance:** silence/noise inputs return `no_speech` in ~100ms without invoking POWSM.

---

### B2 — Abstention rules

**Body:**

Three triggers:
- SNR < 5 dB → `abstention: "low_audio_quality"`
- Mean entropy > threshold → `abstention: "uncertain"`
- Duration < 0.5s or > 25s → reject with explicit message

**Acceptance:** three contrived inputs each trigger correct abstention.

**Depends on:** A5

---

### B3 — Frontend updates

**Body:**
- Dialect selector (US/UK) on reference selection screen
- Phone-by-phone result visualization (red = sub/ins, orange = low GOP, green = ok)
- Audio playback with alignment markers; click phone → seek to time region
- Confidence/abstention message rendering
- Remove V1 UI bits depending on fake alignment positions

**Acceptance:** sample assessment renders convincingly for poster demo.

**Depends on:** A5

---

### C1 — Finalize 25 validation sentences

**Body:**

Sentence selection covers Turkish-critical phonetics:
- /θ/, /ð/ (Turkish lacks both)
- /w/ vs /v/
- /æ/ vs /ɛ/ vs /ʌ/
- Syllable-final /ɹ/
- Final voicing contrasts (Turkish final devoicing)
- Consonant clusters (Turkish epenthesis)
- Reduced vowels / schwa
- /ŋ/ vs /n/+/g/
- Plus 5 natural daily-use sentences

Output: `doc/validation_sentences.pdf` with numbered `ref_001` … `ref_025`.

**Acceptance:** PDF committed.

---

### C2 — Fiverr orders (US + UK)

**Body:**

Two orders, ~$20–30 each:
- General American voice talent
- Standard Southern British (RP) voice talent

Same 25 sentences PDF (from C1). Brief specifies: 16 kHz or 48 kHz mono WAV, conversational pace, no effects, filename `ref_001.wav` … `ref_025.wav`, ZIP delivery.

**Acceptance:** two ZIPs received, audio clean on spot-check listen.

**Depends on:** C1

---

### C3 — Ingest reference recordings

**Body:**
- Upload WAVs to R2 (`references/us/`, `references/uk/`)
- Insert rows in `references` table with `text`, `dialect`, `audio_url`
- Run A2 to populate phones/alignment/posteriors

**Acceptance:** both dialects queryable in DB and selectable on frontend.

**Depends on:** A2, C2

---

### D1 — Baseline PER measurement

**Body:**
- Run pretrained POWSM on held-out test split of 10h dataset (confirm speaker-disjoint with Ömer Faruk)
- Compute overall PER
- Per-phone error rate for: θ, ð, æ, ŋ, w, ɹ, plus final voicing
- Confusion matrix figure

Outputs:
- `doc/baseline_results.json`
- `doc/figures/confusion_baseline.png`

**Acceptance:** numbers and figure ready for poster, script committed and reproducible.

---

### D2 — Fine-tuned model evaluation

**Body:**

Same as D1 but with the fine-tuned checkpoint. Side-by-side comparison table (baseline vs fine-tuned, overall + per critical phone) + confusion matrix for fine-tuned. Honest reporting if any phones got worse.

**Acceptance:** side-by-side comparison figure ready for poster.

**Depends on:** D1, A6 (need checkpoint accessible)

---

### D3 — Recruit and record validation users

**Body:**

Recruit 5–10 Turkish-native English learners. Each records the 25 sentences (reference audio playable for shadowing).

Save to `data/validation/user_<anon_id>/ref_<n>.wav`. Metadata: English level, age range — no real names.

**Acceptance:** ~125–250 recordings collected (5 × 25 min), uploaded to R2, indexed in DB.

**Depends on:** C3 (references must exist to imitate)

---

### D4 — System scoring of validation recordings

**Body:**

Batch call `/assess` for every (user_recording, reference_id) pair. Store result JSONs.

**Acceptance:** every user recording has an associated assessment result.

**Depends on:** A6, D3

---

### D5 — Expert intelligibility ratings

**Body:**

Recruit 2–3 raters (advisor, English instructor, dataset annotator, ESL teacher). Each rates every learner recording 1–5 on intelligibility, blind to system score.

Optional stretch: one rater also phone-level annotates a subset for precision/recall.

Store ratings in DB.

**Acceptance:** every user recording has ≥2 expert ratings.

**Depends on:** D3

---

### D6 — Statistical analysis

**Body:**
- Spearman ρ: system overall score vs mean expert rating
- Krippendorff's α (or Cohen's κ) on rater agreement
- Optional: per Turkish-critical phone detection precision/recall (if D5 stretch done)
- Scatter plot of system score vs human rating with ρ in corner

**Acceptance:** ρ, α, scatter plot ready as poster figures.

**Depends on:** D4, D5

---

### E1 — Dataset platform DB schema + auth (scaffold only)

**Body:**

Tables: `datasets`, `dataset_items`, `dataset_item_revisions`, `dataset_audit_log`. Clerk role `dataset_admin`. Route guard for `/dataset/*`.

Full upload/annotation UI is post-defense. Only schema + read view in scope here.

**Note:** Decide whether to do this before defense. Skip unless time is genuinely free in week 3.

---

### E2 — Dataset read-only listing page

**Body:**

`/dataset` lists datasets. `/dataset/<id>` lists items with audio + IPA + speaker id. No edit, no upload, no annotation. Pure view.

**Depends on:** E1

---

### E3 — Import 10h dataset to DB

**Body:**

Populate `dataset_items` from existing manifest, upload audio to R2 under `datasets/<id>/audio/`.

**Acceptance:** dataset team can log in as `dataset_admin` and see the 10h dataset listed.

**Depends on:** E1

---

### F1 — Poster V2 content

**Body:**

Update V1 poster to V2 with new sections:

- **Method section (new):** 7 V2 contributions
- **Evaluation section (new):** baseline vs fine-tuned table, per-phone improvement, confusion matrix, validation ρ + scatter
- **Architecture:** remove MFA, add POWSM CTC alignment, Silero VAD, fine-tuned model
- **Limitations:** small validation sample, segmental-only, uncalibrated confidence, single speaker per dialect
- **Future work:** remove items now in V2; keep voice cloning, language expansion; add prosody, larger validation, public dataset platform

**Acceptance:** poster PDF committed to `doc/presentation/`.

---

### F2 — Presentation slide deck (30 min)

**Body:**

Suggested arc:
- Motivation + pedagogical model (2 min)
- V1 architecture + lessons learned (3 min)
- V2 contribution overview (3 min)
- Method deep-dive (6 min)
- Turkish fine-tuning + results (4 min)
- Validation study + findings (5 min)
- Limitations + future work (3 min)
- Demo (3 min)
- Q&A buffer

**Acceptance:** slide deck committed.

---

### F3 — Demo asset

**Body:**

Prefer recorded video (network/latency/audio device risk in unfamiliar room). Live demo as bonus if conditions allow.

**Acceptance:** demo video committed to `doc/presentation/`.

---

## Risks

- Fiverr delivery delay → order day 1, identify backup talent
- Validation participant dropout → recruit 10 to get 5–7 completed
- Expert raters slow → send recordings as soon as first 2 users finish, don't batch
- RunPod cold-start hurts demo → warm endpoint before demo, recorded video as backup
- Teammate contribution scope unclear → document in poster acknowledgments

---

## Open coordination items with Ömer Faruk

- Exact baseline vs fine-tuned PER numbers
- Train/valid/test split details (speaker-disjoint?)
- Freeze schedule, epochs
- Checkpoint location
- Who handles A6 deploy
- Who handles D1/D2 evaluation
