# Nounce V2 — Reference / Context for Contributors

> **Read this first if you're picking up any V2 issue.** It is the canonical shared context: what the project does, the components it leans on, the conventions, and the Turkish-L2-English phonetics that motivate everything. Everything below is true as of issue creation; flag drift in a comment if the codebase diverges.
>
> Also tracked at GitHub Issue #42 (pinned).

---

## 1. Mission + timing

**Nounce** is a web-based English pronunciation assessment for Turkish-native learners. A user picks a sentence, listens to a native reference recording (US or UK), records themselves imitating it, and gets per-phone feedback — what was wrong, where, and how confidently the model believes it.

This is a senior project at Boğaziçi University. **Defense: 13 June 2026.** V2 lands four things V1 lacked:

1. Real **POWSM CTC alignment** (replaces V1's fake/heuristic timestamps + abandoned MFA path).
2. **Reference-based assessment** — comparing the learner's phones to a precomputed native reference, not a G2P-from-text canonical.
3. **Human reference recordings** (US + UK) instead of TTS.
4. **Fine-tuned POWSM** on a 10-hour Turkish-L1 dataset.

Plus three smaller contributions: posterior-based **GOP** scoring, **Silero VAD** + abstention, and a **human-judgment validation study** (Spearman ρ vs expert ratings).

Out of scope for V2: prosody, calibration, multi-speaker per dialect, languages beyond English, dataset-platform UI.

---

## 2. System architecture (high-level)

```
┌──────────────────────────────────────────────────────────────────┐
│   Browser (TanStack Start app, app/)                              │
│   - record/upload → /api/audio → R2                               │
│   - submit assessment → /api/assessment → submitAssessmentJob()   │
│   - poll analysis page; await webhook                              │
└────────────┬─────────────────────────────────────────────────────┘
             │ Clerk auth, server functions
             ▼
┌──────────────────────────────────────────────────────────────────┐
│   TanStack server (Fly.io, app/)                                  │
│   - Neon Postgres via Drizzle (app/src/db/*)                      │
│   - Cloudflare R2 (app/src/lib/r2.ts) for audio                   │
│   - Submits RunPod job + webhook URL                              │
└────────────┬─────────────────────────────────────────────────────┘
             │ HTTPS, RunPod REST + webhook
             ▼
┌──────────────────────────────────────────────────────────────────┐
│   RunPod Serverless — Assessment worker (mod/assessment/)         │
│   - Pre-loads POWSM on container startup                          │
│   - VAD → CTC encode → reference lookup → phone_diff → GOP        │
│   - POSTs result JSON to webhook                                   │
└──────────────────────────────────────────────────────────────────┘
```

**V1 had a second worker** (`mod/ipa_generation/`, POWSM G2P) that the app called on demand to canonicalize target IPA. V2 deprecates it: references are precomputed once (E4·precompute_references.py) and the assess worker only needs the **PR/CTC** path.

---

## 3. Component deep-dive

### POWSM (Phonetic Open Whisper-Style Speech Model)

**Source:** [Li et al., 2025, arXiv 2510.24992](https://arxiv.org/abs/2510.24992). Built with [ESPnet](https://github.com/espnet/espnet). Checkpoint: [`espnet/powsm`](https://huggingface.co/espnet/powsm) on HuggingFace (also a `textnorm_retrained/` subfolder from Jan 2026 with improved ASR text normalization).

**Architecture**
- E-Branchformer encoder (9 layers) + Transformer decoder (9 layers), **~350M params**.
- Hybrid CTC/attention loss: ℒ = 0.3·ℒ_ctc + 0.7·ℒ_attention during training. At inference, CTC weight 0.3 by default (tunable).
- Input: **16 kHz** mono waveform, padded/truncated to **20 s** fixed length.
- Token vocabulary: ~40k tokens total, of which **~6k are IPA phone tokens**. CTC encoder targets exclude suprasegmentals (length marks `ː ˑ`, break marks `. ‖`) for faster convergence; the decoder keeps them.
- Phone tokens are emitted **with slash delimiters**, e.g. `/h//ɛ//l//oʊ/`. Strip the slashes in post-processing for phone lists.

**Four tasks (selected via `task_sym` argument)**
| Task | `task_sym` | Input | Output |
|------|-----------|-------|--------|
| Phone Recognition (PR) | `<pr>` | audio | IPA phones |
| Grapheme-to-Phoneme (G2P) | `<g2p>` | audio + text prompt | IPA phones |
| Phoneme-to-Grapheme (P2G) | `<p2g>` | audio + phone prompt | grapheme text |
| ASR | `<asr>` | audio | grapheme text |

**Two G2P quirks worth knowing**
- POWSM G2P is *audio-guided*: when both modalities are present the speech actually shapes the output, so the same text can produce slightly different IPA depending on the speaker. The paper calls this out as a feature ("speech-guided G2P preserves phonetic variation; text prompts normalize it"). V1 exploited this, V2 doesn't — we precompute against a single native speaker per dialect.
- The model is a hybrid AED — its decoder does "implicit phonotactic language modeling" and **tends to normalize L2 / dialectal variation toward high-resource patterns**. This is the central failure mode V2's fine-tuning addresses: a baseline POWSM may auto-correct a Turkish learner's `[t]` for `/θ/` back to `/θ/` because that's what English data overwhelmingly trains it to expect.

**Baseline performance** (Phone Feature Error Rate, lower is better):
- In-domain (IPAPack++, 11 languages): **2.62 avg PFER**, English **2.85**.
- Beats Wav2Vec2-Phoneme (11.11), comparable to ZIPA-CR-Large (2.70).
- Out-of-domain (unseen languages, DoReCo / VoxAngeles / Tusom2021): ~17–22 PFER — a much harder regime.

**Inference pattern (the `Speech2Text` wrapper)**
```python
from espnet2.bin.s2t_inference import Speech2Text
s2t = Speech2Text.from_pretrained(
    "espnet/powsm",
    device="cuda",
    lang_sym="<eng>",
    task_sym="<pr>",
)
speech, _ = sf.read("clip.wav")           # 16 kHz mono
pred = s2t(speech, text_prev="<na>")[0][0]
# pred contains "<notimestamps>/h//ɛ//l//oʊ/"; split + strip slashes
```

For models loaded from a local checkpoint (the fine-tuned case), use the lower-level `Speech2Text(config_path=..., model_file=..., ...)` constructor.

### POWSM CTC forced alignment

**Which model — clear up the naming.** On HF there are two related artifacts: `espnet/powsm` (the ~350M hybrid CTC/attention model we use) and `espnet/powsm_ctc` (a separate CTC-only variant — buggy, see ESPnet issues [#6360](https://github.com/espnet/espnet/issues/6360) and [#6426](https://github.com/espnet/espnet/issues/6426); we do **not** use this). When this codebase says "POWSM CTC alignment" we mean *using the CTC head of `espnet/powsm`*: drive `torchaudio.functional.forced_align(...)` on the CTC log-posteriors (forced) and read `model.s2t_model.ctc.log_softmax(...)` (free / GOP). ESPnet ships a reference recipe at [`egs2/powsm/s2t1/force_align.py`](https://github.com/espnet/espnet/blob/master/egs2/powsm/s2t1/force_align.py) — useful as a starting point but **note the recipe bugs called out below**.

> **Verified locally 2026-06-05** (espnet 202412, torch/torchaudio 2.7.1+cu118, RTX 4060 Ti) with `mod/dev/powsm_ctc_probe.py`. The skeletons below are the *actually-working* API, which differs from earlier drafts — see the correction note.
>
> **Correction:** there is **no `forced_align` method** on `ESPnetS2TModel` or on `espnet2.asr.ctc.CTC` in espnet 202412 (the old skeleton's `model.s2t_model.forced_align(speech=..., text=...)` does not exist). Forced alignment is done by computing CTC log-probs yourself and passing them to `torchaudio.functional.forced_align`. The `ctc.py:240` / `espnet_model.py:156` line refs below were from a hypothetical wrapper and don't apply.

**API skeleton — forced alignment (verified):**
```python
import torchaudio.functional as AF
model = s2t.s2t_model
# 1. tokenize the target IPA; text2tokens prepends a SentencePiece "▁" marker
#    (a non-phone) — strip it before aligning.
tokens = [t for t in s2t.tokenizer.text2tokens("/h//ɛ//l//oʊ/") if t != "▁"]
ids = s2t.converter.tokens2ids(tokens)            # must contain no <blank> (id 0)
# 2. one encoder pass on the 20s-padded clip -> CTC frame log-probs
enc, enc_lens = model.encode(speech_tensor, speech_lengths)   # [1, T_enc, D]
log_probs = model.ctc.log_softmax(enc)                        # [1, T_enc, V]
# 3. forced alignment + span merge
targets = torch.tensor([ids], dtype=torch.int32, device=enc.device)
target_lengths = torch.tensor([len(ids)], dtype=torch.int32, device=enc.device)
path, scores = AF.forced_align(
    log_probs.float(), targets, enc_lens.to(torch.int32), target_lengths,
    blank=model.blank_id,                          # 0
)
spans = AF.merge_tokens(path[0], scores[0].exp())  # scores are log-probs; .exp() -> prob
frame_sec = s2t.s2t_train_args.preprocessor_conf["speech_resolution"]  # 0.04 — read at runtime
alignment = [(s2t.converter.token_list[s.token],
              [s.start * frame_sec * 1000, s.end * frame_sec * 1000])
             for s in spans if s.token != model.blank_id]
```

**API skeleton — free alignment / GOP frame logprobs (verified):**
```python
enc, enc_lens = model.encode(speech_tensor, speech_lengths)   # one encoder pass; T_enc=499 for 20s
log_probs = model.ctc.log_softmax(enc)                        # [1, T_enc, V] — frame posteriors
argmax_path = model.ctc.argmax(enc)                           # [1, T_enc] — for greedy collapse
# collapse blanks + duplicates → spans; multiply frame indices by frame_sec for ms
```

**Key facts the V2 aligner must respect:**
- **Frame stride is 40 ms** (`speech_resolution: 0.04` in POWSM config; `conv2d` input layer 4× subsamples the 10 ms frontend hop). **Verified:** a 20 s padded clip yields **499 encoder frames** (≈19.96 s). The recipe's `force_align.py` uses `time_hop=0.02` — **that's a bug in the recipe** and would halve every timestamp. Read it at runtime from `s2t.s2t_train_args.preprocessor_conf["speech_resolution"]` (the `Speech2Text` object has no `.preprocessor_conf` attribute directly); never hardcode.
- **Run forced alignment batch-size-1.** We pad to 20 s and align one clip at a time. The precompute pass over the reference WAVs is fine (sequential); the assess endpoint cannot batch concurrent user requests anyway.
- **Target sequence must not contain `<blank>` (id 0)** — `torchaudio.functional.forced_align` rejects targets containing the blank symbol. Validate `all(i != model.blank_id for i in ids)` before aligning. Also strip the leading `▁` SentencePiece marker that `tokenizer.text2tokens` emits — it is not a phone.
- **`forced_align` requires that the supplied `text` actually appears in the audio.** For our free-alignment path on user audio we instead use the `log_softmax` / `argmax` route above (greedy CTC, collapse blanks + duplicates).
- **20 s padding is effectively required** — the model is trained with `<0.00>` / `<20.00>` time markers (`speech_init_silence: 20` in config). Variable length technically works but quality degrades. Budget one 20 s encoder forward per request.
- **The blank id and phone vocab live in the model** — read `model.s2t_model.blank_id` (=0) and `s2t.converter.token_list` (len 40002, `token_list[0] == '<blank>'`) at startup, never hardcode.
- **POWSM forced alignment is GPU-friendly but CPU-runnable**; the dominant cost is the encoder forward (350M params over a 20 s clip). No published CPU benchmark for POWSM specifically — measure before depending on it.
- **Pin `torchaudio < 2.9`** — `torchaudio.functional.forced_align` is deprecated in torchaudio 2.9. The assessment image currently lands on **2.7.1+cu118**, but `mod/assessment/Dockerfile` installs it *unpinned* via its own `RUN python3 -m pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cu118` line (not `requirements.txt`), so a rebuild could pull ≥2.9 and break alignment. Pin it on that `RUN` line as `torchaudio<2.9` — or move the torch/torchaudio install into `mod/assessment/requirements.txt` and update both files together.
- **Fine-tuned checkpoint drop-in works** as long as the fine-tune preserves `token_list`, `ctc_type: builtin`, and `encoder.input_layer: conv2d` — standard ESPnet `--init_param` fine-tuning preserves all three. Assert these at aligner startup.

### Goodness of Pronunciation (GOP)

A posterior-based confidence score per phone segment, originally from Witt & Young (2000). Our V2 formulation, computed from POWSM's CTC frame-level log-posteriors over frames `[t_start, t_end]` aligned to a target phone `p`:

- `gop_score(p) = mean_t log P(p | x_t) − mean_t max_{p' ≠ p} log P(p' | x_t)`
- `entropy(p)   = mean_t H(P(· | x_t))` over the segment
- `margin(p)    = mean_t (top1_prob − top2_prob)`
- `uncertain(p) = entropy(p) > τ` (default τ ≈ 2.0 nats; tune in E6)

Intuition: GOP is *positive and large* when the model is both right and confident on the target phone, *near zero or negative* when a competitor phone scores nearly as well (= ambiguous or substituted). Entropy/margin/uncertain are auxiliary flags for the UI (amber coloring) and for the abstention rule.

### MFA (Montreal Forced Aligner)

[MFA docs](https://montreal-forced-aligner.readthedocs.io/). V1 used MFA for phone timestamps; **V2 removes it entirely**. Reasons:

- MFA is a GMM-HMM Kaldi pipeline that needs (a) a pronunciation dictionary and (b) a transcription that **accurately reflects what was said**. For L2 / accented speech, those assumptions break — when a Turkish speaker substitutes `[t]` for `/θ/`, MFA either fails to align that token or smears the boundary unpredictably.
- It's CPU-only, slow to install, has a multi-stage acoustic model bundle (~1 GB), and added a long cold-start step on RunPod (`mod/assessment/start.sh` synced models to the network volume).
- POWSM's own CTC head gives us phone timings *and* logprobs in one pass on the same GPU we already need for inference. No second model, no dictionary mismatch.

If you find MFA / Kaldi / TextGrid references in the V2 codebase outside `CHANGELOG.md` or this issue, it's residue from V1 — Epic E1 strips it.

### RunPod Serverless

[Docs](https://docs.runpod.io/serverless/overview). Each endpoint is a pool of GPU workers + queue + REST API.

- `POST /v2/{endpoint_id}/run` → async, returns `{ id, status: "IN_QUEUE" }`, results delivered via webhook.
- `POST /v2/{endpoint_id}/runsync` → sync (we don't use this).
- `GET /v2/{endpoint_id}/status/{id}` → poll fallback.
- Job states: `IN_QUEUE → IN_PROGRESS → COMPLETED | FAILED` (these are the literal strings the webhook payload uses; the app maps to lowercase enum values in `app/src/lib/runpod-schemas.ts`).
- **Cold start** is real (~10–30 s when a worker spins up). Mitigations: warm-up before demos; cache the model on a **network volume** (`HF_HOME=/runpod-volume/.cache/huggingface`); set min-active-workers above 0 for the demo.
- Local development: `mod/dev/runpod_proxy.py` plus `docker-compose.dev.yml` simulate the RunPod API. The proxy implements the same `/v2/{id}/run` + webhook contract so the app code is identical between local and prod.

### Silero VAD

[silero-team/silero-vad](https://github.com/snakers4/silero-vad). Tiny (~2 MB), CPU-fast (~10 ms per 30 s clip), 16 kHz. We use it as the very first step of `assess()`: if it finds no speech segments, return `status: "no_speech"` and skip POWSM entirely. Saves 1–3 s per silent submission.

### Drizzle + Neon Postgres

Schema lives in `app/src/db/schema.ts`. Migrations are in `app/drizzle/`. Generate with `pnpm db:generate`, push with `pnpm db:push`. Neon provides a serverless Postgres with branching — we use one main branch for prod and short-lived feature branches for migration testing.

Key V1 tables you'll touch in V2:
- `practice_texts` — the 25 validation sentences (plus old V1 texts)
- `authors` — voice talents (V1 used ElevenLabs voices; V2 adds Fiverr GenAm + RP)
- `reference_speeches` — links a text + author + audio storage key; V2 adds `dialect` and `phone_timings_json` columns
- `user_recordings` — uploaded learner audio
- `analyses` — per-submission result (score, target/recognized phones); V2 adds `abstention_reason` and reuses unused `confidence` for overall GOP
- `phoneme_errors` — normalized per-error rows with timestamps; V2 adds `gop_score`, `entropy`, `uncertain`
- `audio_quality_metrics` — SNR/silence/clipping from `check_signal_quality`

### Cloudflare R2

S3-compatible object store. Holds: reference WAVs (`references/{dialect}/{ref_id}.wav`), user recordings (`recordings/{user_id}/{uuid}.{ext}`), and validation-study recordings. Public URLs via `getPublicUrl(storageKey)` in `app/src/lib/r2.ts`.

### Clerk + TanStack Start

Clerk handles auth (regular users + an `app_admin` role for the admin panel). TanStack Start is the React + server-functions framework. Server functions in `app/src/lib/server-*.ts` and the API routes in `app/src/routes/api/` are the only places that touch the DB or call RunPod — never from a route's `loader` directly.

---

## 4. Domain: Turkish L1 → English L2 phonetics

This is the operational substance of the project. Anyone writing validation sentences, designing the frontend feedback, recruiting users, or interpreting model errors should internalize this section.

Turkish has 8 vowels and ~21 consonants and is largely **phonemic** (one letter, one sound). English has 12+ pure vowels, 8 diphthongs, and a much denser consonant inventory including sounds Turkish lacks. The result is predictable, replicable error patterns:

### 4.1 Consonants Turkish lacks

| English phone | Turkish substitution (typical) | Example mispronunciation |
|---|---|---|
| `/θ/` (voiceless `th`, *think*) | `[t]` or `[s]` | *think* → "tink" / "sink" |
| `/ð/` (voiced `th`, *this*) | `[d]` or `[z]` | *this* → "dis"; *brother* → "brodder" |
| `/w/` | `[v]` (no /w/ in Turkish; `v` is the closest grapheme) | *wine* / *vine* both produced as `[vajn]` |
| `/ŋ/` (the *ng* in *sing*) | `[ng]` cluster | *sing* → "sing" with a real `[ɡ]`; *singer* → "sin-ger" |
| `/ɹ/` (English approximant *r*) | Turkish tapped/trilled `[ɾ]` or `[r]` | *red*, *car* — sounds Spanish-ish; final-position *r* may also drop |

### 4.2 Vowel collapses

| Contrast | What collapses | Example |
|---|---|---|
| `/æ/` vs `/ɛ/` vs `/ʌ/` | All three may merge toward Turkish `[a]` or `[ɛ]` | *bat*, *bet*, *but* all sound similar |
| `/ɪ/` vs `/iː/` | Length distinction lost; both `[i]` | *ship* and *sheep* indistinguishable |
| `/ʊ/` vs `/uː/` | Both `[u]` | *full* and *fool* |
| Schwa `/ə/` | Replaced with the written vowel (no vowel reduction in Turkish) | *about* → "ah-bout"; *photograph* fully pronounces every vowel |
| Diphthongs (`/eɪ/`, `/aɪ/`, `/oʊ/`, `/aʊ/`, `/ɔɪ/`) | Often split into two syllables | *pain* → "pa-een"; *go* → "go-uh" |

### 4.3 Phonotactics — epenthesis in clusters

Turkish syllable structure dislikes onset clusters and certain coda clusters. Turkish speakers insert epenthetic vowels (`[ɯ]` or `[i]`) to break them up.

| English word | Likely Turkish epenthesis |
|---|---|
| *school* | "is-kul" or "se-kul" |
| *strict* | "is-trikt" |
| *sprint* | "si-print" |
| *film* | "fi-lim" |
| *spring* | "si-pring" |

This is one of the strongest signals to design sentences around — initial /sC/ and /sCC/ clusters are nearly diagnostic.

### 4.4 Final-position devoicing

Turkish devoices final obstruents (a final `b/d/g/v/z/ʒ/dʒ` is realized voiceless). Carries straight into English:

| Word | Turkish-L2 output |
|---|---|
| *bed* | "bet" |
| *dog* | "dok" |
| *have* | "haf" |
| *buzz* | "bus" |
| *bridge* | "britch" |

Minimal pairs like *bed/bet*, *dog/dock*, *prize/price* are diagnostic.

### 4.5 Notes for whoever writes the 25 validation sentences (Issue #24)

The point of the corpus is to **provoke the model into producing meaningful per-phone scores on the error categories above**, while staying **natural enough that a learner can shadow them without sounding silly**. Concretely:

- **Each sentence should target at least one category above**, ideally two, but cleanly — not eight error vectors crammed into a tongue-twister.
- **Avoid wordplay, alliteration, and obvious phonetic showpieces.** "The thing there is theirs though" is exactly the kind of sentence we don't want — a learner reading it knows they're being tested on `/θ ð/` and self-corrects. Better: *"I think both brothers will be there tomorrow."* — natural, still hits `/θ ð/` twice.
- **5–12 words per sentence.** Enough to capture multi-phone context; short enough for a shadowing session (the recording UI caps at 20 s).
- **Use everyday vocabulary.** A learner who has to look up *anaphylaxis* isn't going to pronounce it consistently.
- **Mix it up:** 20 sentences spread across the categories above, plus 5 natural-flow daily-use lines for general fluency baseline.
- **Number them `ref_001` … `ref_025`** — Fiverr deliverables must use these exact filenames.
- Output formats: `doc/validation_sentences.md` (source) and `doc/validation_sentences.pdf` (Fiverr-ready brief, both committed).

Example seeds (style, not final wording):
- `/θ/ /ð/`: *"I think both brothers will be there tomorrow."*
- `/w/ vs /v/`: *"We were both very tired by Wednesday evening."*
- final devoicing: *"He had a good dog and a small bird in his bag."*
- /s/-cluster epenthesis: *"She studied Spanish at school last spring."*
- diphthongs: *"They flew over the bay at five in the morning."*
- schwa / reduction: *"I was about to call her again about the photograph."*
- `/ŋ/` vs `/n+g/`: *"Singing in the morning is a nice thing."*
- `/ɪ/` vs `/iː/`: *"The ship was full of sheep and bags of cheap tea."*

Stop at category coverage — do not chain them; one or two per line.

---

## 5. File map

A quick "where do I go for X" cheat-sheet:

| You want to… | Look at |
|---|---|
| Understand the current /assess flow | `mod/assessment/assess.py` (1150-line V1 monolith; E3·#19 reduces it) |
| See the existing webhook → DB mapping | `app/src/routes/api/webhook/assessment.ts` |
| See the request submission to RunPod | `app/src/lib/assessment-submission.ts` |
| Add/modify DB tables | `app/src/db/schema.ts` + `pnpm db:generate` |
| Edit phoneme rendering | `app/src/components/diff-viewer.tsx` + `app/src/lib/diff-viewer.ts` |
| Edit the practice page (record/upload UI) | `app/src/routes/practice/$textId.tsx` |
| Edit the analysis result page | `app/src/routes/practice/$textId.analysis.$analysisId.tsx` |
| Add a script for evaluation or ingest | `scripts/` (new file) or `mod/` for inference scripts |
| Sanity-check audio | `mod/shared/audio.py` |
| Run the local RunPod simulator | `scripts/runpod.py` → `docker compose -f docker-compose.dev.yml up` |
| Explore/verify audio offline (no DB) | `data/README.md` — fixtures + `manifest.json`; `mod/dev/verify.py` runs POWSM phone-recog/alignment/GOP on committed clips; `scripts/split_audio.py` cuts long takes |
| Existing tests | `mod/tests/test_edit_operations.py` (the only test file) |

---

## 6. Conventions

- **Python**: Black-style formatting; no MFA/Kaldi references in new code. Singleton-load models at container start, not per request.
- **TypeScript**: Biome (`biome.json`); imports follow path aliases (`@/db/...`, `@/lib/...`). All DB access goes through `app/src/db/*.ts` helpers; all RunPod calls through `app/src/lib/assessment-submission.ts` or equivalent.
- **Schema**: Drizzle migrations are append-only; never edit existing migration files. Add a new file via `pnpm db:generate`.
- **Issue/PR**: Reference the issue number (`Fixes #N`) in PR descriptions. Cross-link epic parent.
- **Phone tokens** in our codebase are stored *without* the POWSM `/.../` slashes — strip on the way in, the DB stores them space-separated (e.g. `"h ɛ l oʊ"`) or as a JSON list depending on the column. See `phoneme_errors.expected` (space-separated string) vs. the planned `reference_speeches.phone_timings_json` (JSON list with timing).
- **Sample rate** is 16 kHz everywhere in the ML path. WAV uploads can be 16k or 48k mono; `librosa.load(..., sr=16000, mono=True)` normalizes.

---

## 7. Acronym + jargon glossary

- **PR** — Phone Recognition (POWSM task: audio → IPA).
- **G2P** — Grapheme-to-Phoneme (POWSM task: text [+ audio] → IPA).
- **P2G** — Phoneme-to-Grapheme (POWSM task: phones [+ audio] → text). Unused in V2.
- **ASR** — Automatic Speech Recognition (audio → graphemes).
- **CTC** — Connectionist Temporal Classification. Frame-level alignment loss + decoder; our forced-alignment path uses POWSM's CTC head.
- **PER** — Phone Error Rate (edit distance ÷ reference length); the primary intrinsic metric in E6·D1/D2.
- **PFER** — Phone *Feature* Error Rate, used by the POWSM paper; treats phones as feature bundles so near-misses count partially. Don't confuse with PER.
- **GOP** — Goodness of Pronunciation (see §3).
- **VAD** — Voice Activity Detection (Silero, §3).
- **L1 / L2** — first / second language. Here L1 = Turkish, L2 = English.
- **IPA** — International Phonetic Alphabet.
- **Abstention** — a `/assess` response that refuses to score (low SNR, no speech, model not confident). UI surfaces a banner, not a score.
- **Reference** — a (text, dialect, native-speaker recording) tuple, precomputed once into `reference_speeches`.

---

## 8. Citations

- Li, C.-J. et al. *POWSM: A Phonetic Open Whisper-Style Speech Foundation Model.* [arXiv:2510.24992](https://arxiv.org/abs/2510.24992) — primary model paper.
- ESPnet POWSM model card: [huggingface.co/espnet/powsm](https://huggingface.co/espnet/powsm).
- ESPnet POWSM recipe (forced alignment): [github.com/espnet/espnet/tree/master/egs2/powsm/s2t1](https://github.com/espnet/espnet/tree/master/egs2/powsm/s2t1).
- Zhu, J. et al. *ZIPA: A family of efficient models for multilingual phone recognition.* ACL 2025. [aclanthology.org/2025.acl-long.961](https://aclanthology.org/2025.acl-long.961/) — comparison baseline.
- Witt, S.M. & Young, S.J. (2000). *Phone-level pronunciation scoring and assessment for interactive language learning.* Speech Communication 30(2–3) — original GOP formulation.
- MFA: [montreal-forced-aligner.readthedocs.io](https://montreal-forced-aligner.readthedocs.io/) — V1 legacy; deprecated in V2.
- RunPod Serverless docs: [docs.runpod.io/serverless](https://docs.runpod.io/serverless/overview).
- Silero VAD: [github.com/snakers4/silero-vad](https://github.com/snakers4/silero-vad).
- Turkish-L1 English-L2 phonetics (background reading): [Yavuz & Şenel, *English Pronunciation Problems Encountering Turkish EFL Learners*](https://dergipark.org.tr/tr/download/article-file/1438929); [TALK Schools blog summary](https://blog.talk.edu/learn-english/common-pronunciation-errors-turkish-speakers/).

---

*If you're an LLM agent picking up a V2 issue: read §3 + §4 + §6 carefully, then skim the issue you've been assigned. If your task touches the phoneme schema or the assessment contract, also read §2 and the file map in §5. If anything in this document conflicts with what you observe in the current code, trust the code and leave a comment here flagging the drift.*
