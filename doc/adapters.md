# Fine-tuned POWSM adapters — generation, usage, validation

Reference for the 7 LoRA/DoRA adapters trained 2026-06-09. Read this before evaluating,
deploying, or re-training. Companion docs: `doc/finetuning_plan.md` (the experiment design),
`doc/finetuning_failure_analysis.md` (why the V1 Turkish fine-tune is dead),
`doc/model_versioning.md` (artifact/runtime contract). Training code: `scripts/train_adapter.py`,
orchestrated by `scripts/train_all.sh`.

## TL;DR

- 7 PEFT adapters on top of frozen base `espnet/powsm`. They are **not** a new model — they're
  small attention-layer deltas selected at runtime; base ships if none is selected.
- The point is a **controlled ablation**, not a single "better model": `l2a_cpl` vs `l2a_ppl`
  (canonical vs perceived labels on identical audio) is the thesis result. The rest are
  secondary ablations (LoRA vs DoRA; +Turkish via LOSO).
- **Do not read quality off training dev-loss.** cpl and ppl were trained against different
  label sets; their losses are not comparable. Only **PER + substitution recall on the held-out
  Turkish set** decides anything.
- **`lang_sym` (now aligned, not a result bug):** these adapters trained with `lang_sym="<eng>"`;
  the aligner used to hardcode `<unk>` when an adapter was attached. For this **CTC-encoder**
  aligner that is *cosmetic* — lang/task symbols prime the *decoder* prompt, which this path never
  runs — so it does **not** change phone output. It was a provenance mismatch, now defaulted to
  `<eng>` (override `POWSM_LANG_SYM`). See Pitfall #1.

## The 7 adapters

| Name | Method | Train data | Label target | Role |
|---|---|---|---|---|
| `l2a_cpl` | LoRA | L2-ARCTIC | **canonical** (CPL) | Control — reproduces the normalization failure on clean data |
| `l2a_ppl` | LoRA | L2-ARCTIC | **perceived** (PPL) | Corrected approach; the other half of the core ablation |
| `l2a_ppl_dora` | **DoRA** | L2-ARCTIC | perceived (PPL) | LoRA-vs-DoRA ablation, identical data to `l2a_ppl` |
| `l2a_ppl_tr_fold1` | LoRA | L2-ARCTIC PPL + 3 TR speakers | perceived | LOSO fold; held-out speaker = `loso_fold1_eval` |
| `l2a_ppl_tr_fold2` | LoRA | L2-ARCTIC PPL + 3 TR speakers | perceived | LOSO fold 2 |
| `l2a_ppl_tr_fold3` | LoRA | L2-ARCTIC PPL + 3 TR speakers | perceived | LOSO fold 3 |
| `l2a_ppl_tr_fold4` | LoRA | L2-ARCTIC PPL + 3 TR speakers | perceived | LOSO fold 4 |

> Note: only `l2a_ppl_dora` is DoRA. `cpl`, `ppl`, and all 4 folds are **plain LoRA**
> (`train_all.sh` passes `--no-use-dora`; the script default is DoRA, so this is easy to get
> backwards — check the flag, not the default).

## How they were generated

**Recipe** (`scripts/train_adapter.py`, defaults overridden by `train_all.sh`):
- Base: `espnet/powsm`, loaded `lang_sym="<eng>"`, `task_sym="<pr>"`, frozen.
- Adapter: PEFT `LoraConfig`, `r=32`, `lora_alpha=64`, `lora_dropout=0.1`, `bias="none"`,
  `target_modules=["linear_q","linear_k","linear_v","linear_out"]` (**attention only**, no FFN),
  `use_dora` per-adapter (see table).
- Objective: CTC loss, `reduction="sum"` divided by total target tokens (deliberately *not*
  `reduction="mean"` — that's torch-version-dependent and over-clips on torch 2.1.0; see the
  comment in `run_epoch`).
- Optim: AdamW `lr=2e-5`, `weight_decay=0.01`, LinearLR warmup (0.1→1.0), grad-clip 5.0, fp16.
- Schedule: 30 epochs, `batch_size=4`, `accum_grad=4`, **early stop patience=5** on dev loss.
- Audio: 16 kHz mono, per-batch padding to batch-max (not a fixed 20 s — saves the encoder from
  processing 5–8× silence), 20 s hard cap.
- Targets: slash-delimited POWSM IPA (`/h//ɛ//l//oʊ/`), tokenized via the POWSM tokenizer.
  **Utterances with any OOV token or a `<blank>` in the target are silently skipped.**

**Per adapter the output dir contains:** `checkpoint-epoch-{1..30}/`, `best/` (lowest dev loss),
and a top-level `adapter_*` = the **final epoch** (not necessarily best). Each is
`adapter_config.json` + `adapter_model.safetensors` (~21 MB) in PEFT format.

**Environment:** trained on a RunPod GPU pod, repo at `/workspace`, `train_all.sh` run the 7
sequentially (~1.7 h each). The pod was a **web-terminal-only pod (no sshd)** — see §Pitfalls #6.

## Where they live & how to fetch

Weights are **off-git** (per `model_versioning.md`). Three locations:

| Location | Contents | Fetch |
|---|---|---|
| GitHub release `adapters-2026-06-09` | `best/` only, single tarball | `gh release download adapters-2026-06-09` |
| GitHub release `adapters-2026-06-09-all-epochs` | all 31 epochs + best, 1 tarball/adapter | `gh release download adapters-2026-06-09-all-epochs` |
| Local `artifacts/release/` (gitignored) | extracted, all epochs | already present on the training box |

```bash
gh release download adapters-2026-06-09-all-epochs -D artifacts/release --clobber
for f in artifacts/release/l2a_*.tgz; do tar xzf "$f" -C artifacts/release; done
```
(All tarballs are split per-adapter because the combined all-epochs tar is 2.8 GB > GitHub's
2 GB/asset limit. Verify each with `gzip -t` after download — the pod link truncated transfers
more than once.)

## How to load one

Selection happens in **one place**, the aligner (`mod/alignment.py`); `assess` and `verify.py`
inherit it. Point `POWSM_ADAPTER_DIR` at an adapter's `best/`:

```bash
POWSM_ADAPTER_DIR=artifacts/release/l2a_ppl/best   # or any checkpoint-epoch-N
```
Empty/unset/missing → baseline POWSM (never crashes on a missing adapter). The aligner defaults
`lang_sym="<eng>"` (matching training); override with `POWSM_LANG_SYM` only if you know you need to.

## What they're for

1. **The thesis** (defense): `l2a_cpl` vs `l2a_ppl` proves that valid L2 mispronunciation-detection
   fine-tuning needs *perceived* (produced) labels, not *canonical* ones. Same audio, opposite
   supervision, opposite GOP behavior.
2. **Secondary ablations:** `l2a_ppl_dora` (does DoRA beat LoRA at equal rank?) and the 4 LOSO
   folds (does adding a little in-domain Turkish help, measured speaker-independently?).
3. **Deployment candidate:** if a perceived-label adapter beats base on the Turkish held-out set
   without regressing native speech, it ships behind the model-version contract (#29/#74).
   Otherwise base ships and these stand as the analysis.

## Validation plan (the eval matrix)

Use each adapter's `best/` (and optionally sweep epochs — see Pitfall #4).

| Model | TR in training | Eval on the 4 TR speakers |
|---|---|---|
| base | no | all 4 (unseen) |
| `l2a_cpl`, `l2a_ppl`, `l2a_ppl_dora` | no | all 4 (unseen) |
| `l2a_ppl_tr_foldK` | yes | **only** its held-out `loso_foldK_eval` speaker, then average the 4 |

**Metrics:**
- **PER** on the Turkish held-out set.
- **Substitution recall** on the ~15 Turkish-L1 error pairs (θ→t/s, ð→d/z, w→v, ɹ→ɾ, ŋ→n,
  æ/ɛ/ʌ→a). This is the clinically relevant number.
- **Native false-positive rate** on the Fiverr reference clips — a deployable adapter must not
  penalize correct pronunciation more than base.

**Reading the LOSO arm:** fold *K*'s number is valid **only** on speaker *K* (the others were in
its training set). Report mean ± range across the 4 folds; compare each speaker's fold-K result to
base and to `l2a_ppl` to see whether the Turkish data earned its place — speaker-independently.

**Promotion gate:** ship the best adapter iff it beats base on Turkish PER + substitution recall
*and* does not raise native FPR. Else base ships.

## Common pitfalls

1. **`lang_sym` provenance (NOT a result bug).** These adapters trained with `lang_sym="<eng>"`
   (`train_adapter.py`); the aligner used to force `<unk>` when an adapter was attached (correct for
   the V1 adapter). Because this aligner only runs the CTC **encoder** path, and lang/task symbols
   prime the **decoder** prompt, `lang_sym` does **not** change phone output here — it does not
   invalidate eval. It was a train/inference provenance mismatch only; the aligner now defaults to
   `<eng>` (override `POWSM_LANG_SYM`). This *would* matter if a decoder/beam-search path is ever
   added — revisit then.
2. **Dev loss is not a quality metric across adapters.** Lower dev loss on `l2a_cpl` does **not**
   mean it's better — canonical targets are an easier label distribution. cpl's dev loss falls
   below ppl's by construction. Only the held-out **PER/recall** comparison is meaningful.
3. **`best/` is best *dev loss*, which may not be best PER.** Early epochs can win on PER while a
   later epoch wins on dev loss (and vice-versa). That's exactly why we kept all 31 epochs — sweep
   a few checkpoints during eval rather than trusting `best/` blindly.
4. **`best/` vs the top-level dir.** The output-dir root holds the **final epoch**; `best/` holds
   the lowest-dev-loss epoch. They are usually different. Always select `.../best` (or an explicit
   `checkpoint-epoch-N`), never the dir root, unless you mean "last epoch".
5. **Annotation conventions are load-bearing.** Targets must be in POWSM's own output convention:
   monophthong-split diphthongs (`eɪ oʊ aɪ aʊ`, **not** `ej ow aj aw`), and OOV tokens are silently
   dropped (whole utterance skipped) — so a convention slip doesn't error, it just shrinks your
   data. This is the V1 failure mode; see `finetuning_failure_analysis.md` and
   `phone_inventory_corpus_vs_model.md`.
6. **The training pod was ephemeral and SSH-less.** It was a web-terminal RunPod pod (no sshd), so
   artifacts could only be pushed *out* (HTTP server on the one exposed TCP port → pull from a
   laptop). Large single transfers truncated repeatedly; per-adapter (~420 MB) tarballs with a
   `gzip -t` check were reliable. **Get weights off the pod before freeing it** — `/workspace` does
   not survive pod termination. (The network volume does; weigh that for the next run.)
7. **GitHub 2 GB/asset limit.** The combined all-epochs tar (2.8 GB) is rejected as a single asset;
   split per-adapter. (Per-file LFS-free pushes >100 MB are also rejected by `git push`, which is a
   separate reason weights stay in releases, not the repo.)
8. **Only `l2a_ppl_dora` is DoRA.** Don't assume the others are, just because the script's default
   is `use_dora=True`. `train_all.sh` overrides with `--no-use-dora` everywhere else.

## Contributor must-knows (short list)

- `lang_sym` is cosmetic for this CTC aligner (now defaults to `<eng>`) — don't chase it as a bug (#1).
- Compare on held-out Turkish PER/recall, never dev loss (#2).
- Select `best/` or an explicit epoch, never the dir root (#4).
- Targets in POWSM convention or they vanish silently (#5).
- Weights live in releases / volume / R2, never in git (`model_versioning.md`).
- A LOSO fold is only valid on its own held-out speaker (§Validation).

## Report

Eval ran 2026-06-10 on the training pod (A5000), git `20ad79e`, via `scripts/eval_adapters.py`
(epoch-30 `best/` checkpoints). Raw artifacts in `artifacts/eval/` (gitignored): `summary.json`,
`raw/*.csv`, `figs/*.png`, `eval_report.md`. **These are the epoch-30 numbers; a 60-epoch
re-train (`l2a_*_long`) is in flight because dev loss had not plateaued — update if it sharpens.**

### Turkish held-out set (4 speakers, 53 utts) — gate metrics

| Model | TR-PER | Sub-recall | Native FPR | Schwa-collapse | Notes |
|---|---|---|---|---|---|
| base | 0.435 | 0.033 | 0.003 | 0.090 | ships (see decision) |
| l2a_cpl | 0.427 | 0.016 | 0.007 | 0.081 | ≈ base; no real change |
| l2a_ppl | 0.420 | 0.025 | 0.008 | 0.088 | best non-fold PER |
| l2a_ppl_dora | 0.419 | 0.025 | 0.008 | 0.088 | ≈ ppl (DoRA≈LoRA) |
| l2a_ppl_tr (LOSO mean ± range) | 0.421 (0.402–0.455) | 0.026 | 0.009 | — | fold k on held-out speaker k only |

> **TR sub-recall and native FPR are tiny-sample / noisy** — TR sub-recall is 2–4 true events out
> of ~122; native FPR is a handful of phones over 100 clips. Do not over-read them. PER is the
> robust TR number; the clean thesis signal is the L2-ARCTIC arm below.

LOSO folds (held-out speaker, the speaker-independent number): erem 0.402, omer 0.455, umit 0.422,
ibrahim 0.406. Adding 3 TR speakers helps slightly on average (0.421 < base 0.435) but with high
between-speaker variance (omer regresses).

### L2-ARCTIC cpl-vs-ppl (the thesis, held-out dev split, 600 utts, 4 L1 groups)

Annotated CPL **and** PPL on identical audio (no proxy). Deviation recall = fraction of annotated
canonical→produced substitutions the model reproduces.

| Model | PER vs PPL | PER vs CPL | Deviation recall |
|---|---|---|---|
| base | 0.240 | 0.181 | 0.173 |
| l2a_cpl | 0.238 | 0.179 | **0.173** (= base) |
| l2a_ppl | 0.227 | 0.172 | 0.186 |
| l2a_ppl_dora | 0.227 | 0.172 | 0.188 |

**Finding (directionally confirms the thesis, modest magnitude):**
- **Canonical supervision is a no-op.** `l2a_cpl` ≈ base on every metric (deviation recall
  identical to 4 d.p.). Base already emits canonical-leaning phones, so training on canonical
  labels teaches nothing and cannot build a deviation detector.
- **Perceived supervision helps, consistently.** `l2a_ppl` beats base on PER-vs-PPL and deviation
  recall in **all 4 L1 groups** (Hindi/Mandarin/Spanish/Vietnamese) — small (recall 0.173→0.186)
  but uniform, so it is signal, not noise.
- **DoRA ≈ LoRA** at equal rank (0.188 vs 0.186).
- Magnitude is bounded by training budget: dev loss was still falling at the 30-epoch cap
  (adapters under-trained) — hence the 60-epoch re-train below.

### 60-epoch re-train (`l2a_*_long`, release adapters-2026-06-10-long) — thesis sharpens

Same config, 60 epochs (dev loss was still falling at 30). The contrast **widens ~4×** and the
strong form of the thesis appears:

| Model | TR-PER | TR sub-recall | native FPR | L2A PER vs PPL | L2A dev-recall |
|---|---|---|---|---|---|
| base | 0.435 | 0.033 | 0.003 | 0.240 | 0.173 |
| l2a_cpl (30ep) | 0.426 | 0.016 | 0.007 | 0.238 | 0.173 (= base) |
| **l2a_cpl_long (60ep)** | 0.400 | 0.008 | 0.027 | 0.217 | **0.163 (BELOW base)** |
| l2a_ppl (30ep) | 0.420 | 0.025 | 0.008 | 0.227 | 0.186 |
| **l2a_ppl_long (60ep)** | **0.392** | **0.057** | 0.024 | **0.205** | **0.213** |

- **Canonical supervision *actively harms*** (the strong claim): `l2a_cpl_long` deviation recall
  falls **below base** (0.163 < 0.173) — at 30 epochs cpl was a no-op (= base); more canonical
  training normalizes harder and *loses* produced deviations.
- **Perceived supervision clearly helps:** `l2a_ppl_long` recall 0.213 (vs base 0.173), and it now
  beats base on **TR-PER (0.392) and TR sub-recall (0.057 vs 0.033)** — no adapter did at 30 epochs.
- **Cost:** native FPR rises to ~0.024 (vs 0.003 base) — longer training drifts native-speech
  output ~3× more than at 30 epochs. This is the deploy trade-off.

### Promotion gate (re-applied @60) + decision

`l2a_ppl_long` beats base on **TR-PER, TR sub-recall, and L2-ARCTIC deviation recall**, but **raises
native FPR** (0.024 vs 0.003). It clears the detection criteria decisively while failing the strict
"no native-FPR regression" clause. So:
- **Thesis result (defense):** report `l2a_*_long` — canonical actively harms vs perceived clearly
  helps, on identical audio. This is the empirical centerpiece.
- **Deployment:** trade-off call — `l2a_ppl_long` (best detection, +2.4% native drift) vs
  `l2a_ppl`@30 (currently live, lower drift) vs base. Currently **`l2a_ppl`@30 is deployed**; swap to
  `l2a_ppl_long` only if the native-drift cost is acceptable (would require re-bake + reference
  re-precompute).

### External validation — speechocean762 (#96, full 2500-utt test set, deployed model)

GOP vs expert human phoneme-accuracy: **mean GOP −6.80 / −4.65 / −1.37 for accuracy 0/1/2**
(monotonic, 47k phones); Spearman ρ_phone **0.213**, ρ_sentence **0.367**. Independent confirmation
on the standard benchmark that the GOP tracks human judgement (general, Mandarin-L1).

**Reference dev losses** (provenance only — *not* comparable across adapters): `l2a_cpl` reached
dev≈0.59 (canonical, easy); `l2a_ppl_tr_fold4` best dev=0.7609. Captured from `train_all.log` /
`folds.log` on the pod. Note: every `best/` is the **final (epoch-30)** checkpoint — dev loss never
plateaued, confirming under-training rather than a checkpoint-selection artifact.
