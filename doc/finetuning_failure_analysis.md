# Fine-tuning Failure Analysis

**Status:** Confirmed failure. Fine-tuned model performs worse than base POWSM on Turkish-L1 errors.
**Discovered:** 2026-06-07, prior to defense (2026-06-13).

---

## Background

V2 planned a fine-tune of `espnet/powsm` on ~10 hours of Turkish-L1 English speech, with the goal of reducing POWSM's tendency to auto-correct L2 substitutions back to canonical English phones. The base model, being trained on predominantly native English data, "hears" a Turkish `[t]` for `/θ/` and confidently outputs `/θ/` anyway — i.e., it normalizes away the error before it can be detected. Fine-tuning was intended to break this normalization bias.

The fine-tuned checkpoint was evaluated and found to be strictly worse than the base model on the error categories it was trained to address.

---

## Root cause 1: Canonical-label annotation

### What happened

The training corpus was annotated with **lexical (canonical) IPA** — the correct English pronunciation as found in a pronunciation dictionary — rather than **phonetic IPA** — a transcription of what the speaker actually produced.

For example, a Turkish speaker producing `[t]` for `/θ/` in *think* was labeled `/θ ɪ ŋ k/`, not `[t ɪ ŋ k]`. A speaker fully articulating a Turkish `[i]` in an unstressed position was labeled `/ə/`, because that is the canonical English vowel in that slot.

### What the model learned

The fine-tune saw Turkish-accented audio paired with canonical English targets. It therefore learned: "even when the audio sounds like a Turkish phone, the correct output is the English canonical phone." This is exactly the normalization behavior the base model already exhibited. The fine-tune did not reduce the bias — it reinforced it on Turkish-accented audio specifically.

### Observed symptom: schwa over-confidence

The most visible symptom is schwa (`/ə/`) over-generation. In unstressed positions the model now outputs `/ə/` with high confidence even when the speaker articulates a clear, full Turkish `[i]` (or `[ɯ]`). The base model would at least show uncertainty (lower posterior, higher entropy) in such cases. The fine-tuned model is falsely confident.

**Effect on GOP:** A learner who correctly (for their L1 background) produces a full vowel in an unstressed syllable receives a low GOP score — the model expects schwa and penalizes the deviation. The error signal is backwards.

### Why this is a known pitfall

Valid L2 fine-tuning requires **phonetic transcription** of what was produced, not what should have been said. This is the standard practice in L2 speech corpora (ISLE, ABI-1, etc.) and requires either trained phoneticians or a listen-and-correct workflow on top of forced alignment. Dictionary-derived labels are appropriate only for native-speaker ASR corpora; they are the wrong annotation target for a model being trained to *detect* deviations from those labels.

---

## Root cause 2: Transcription convention mismatch on diphthongs

### What happened

POWSM natively transcribes English diphthongs using a **vowel offglide** notation:

- `/aɪ/` (e.g. *my*, *time*, *five*)
- `/eɪ/` (e.g. *day*, *late*)
- `/oʊ/` (e.g. *go*, *stone*)

The annotators used **glide notation** for the same sounds:

- `/aj/` — `j` instead of `ɪ`
- `/ej/` — `j` instead of `ɪ`
- `/ow/` — `w` instead of `ʊ`

Both are valid IPA notations. They describe the same acoustic event. But they map to **different tokens** in POWSM's vocabulary (`/j/` ≠ `/ɪ/`, `/w/` ≠ `/ʊ/`). The fine-tune trained the model to produce token sequences it would never natively generate.

### Observed symptom: systematic diphthong misalignment

Concrete example: *my* → base POWSM outputs `/m aɪ/`; fine-tuned model outputs `/m a j/` or collapses to `/m ɑ/`. Forced alignment over diphthongs is now broken because the target token sequence diverges from what the encoder's CTC posteriors support. GOP scores for diphthong-containing phones are unreliable regardless of learner quality.

This also interacts badly with Turkish-L1 diphthong errors (§4.2 of V2_CONTEXT.md): a learner who splits `/eɪ/` into two syllables ("pa-een" for *pain*) would already stress the system; the convention mismatch means we can't tell apart a real error from an annotation artifact.

### The deeper lesson

Fine-tuning a model requires annotations in the **model's own output convention**, not in standard dictionary or linguist IPA. POWSM's tokenization preferences can only be discovered empirically — by running phone recognition (`<pr>`) on known utterances and reading what the model actually emits. Any annotation project for POWSM fine-tuning must begin with this empirical survey, not with a phonetics textbook.

---

## What was not wrong

- The **pipeline architecture** (VAD → CTC encode → forced alignment → GOP → phone diff) is sound and unaffected by the fine-tuning failure.
- The **base POWSM** still provides usable GOP scores for high-confidence phones (unambiguous consonants, clearly articulated vowels). It fails on the Turkish-specific error categories for the normalization reason described above, but it does so with visible uncertainty (entropy is higher) rather than false confidence.
- The **phoneme diff and feature-distance severity** (E7.6) layer is independent of the model checkpoint.

---

## Decision for V2 / defense

The fine-tuned checkpoint is discarded. The system ships with **base `espnet/powsm`** (`textnorm_retrained/` variant).

The fine-tuning attempt is presented as a methodological finding, not a system failure:

> We attempted fine-tuning on 10 hours of Turkish-L1 English speech. Analysis revealed two systematic annotation errors that invalidate the fine-tune: (1) canonical rather than phonetic labeling, which reinforces rather than corrects the base model's normalization bias; and (2) a transcription convention mismatch on diphthongs (glide `j/w` vs. vowel `ɪ/ʊ` offglide) that creates token-level misalignment. Both errors are predictable from first principles and constitute a methodological contribution: valid L2 fine-tuning requires phonetic annotation in the model's own output convention.

---

## Future work (if the project continues)

1. **Phonetic re-annotation:** Annotate what the speaker produced, not what they should have said. Requires listening to each clip and marking actual phones. For the diphthong convention: follow POWSM's native output (vowel offglide `ɪ/ʊ`, not glide `j/w`) — confirmed from empirical PR runs.
2. **POWSM convention survey:** Before any future annotation, run `<pr>` over a representative set of utterances covering all diphthongs, reduced vowels, and target error categories. Document the model's native token for each, and distribute that mapping to annotators as a required reference.
3. **Minimum corpus size:** 10 hours is likely insufficient for a 350M-parameter model to overcome a strong normalization prior. Published L2 fine-tuning work (e.g. ISLE-based Wav2Vec2 experiments) suggests 30–50+ hours for reliable phone-level behavior change in accented-speech regimes.
