# Nounce Poster Design Specification (V2 / CMPE 492)

## CMPE 492 Senior Project

**Format**: A0 Horizontal (1189mm × 841mm)
**Word Count Target**: 300–800 words

> This is the V2 (CMPE492) poster spec. The earlier `doc/poster.md` describes the
> V1 (CMPE491) prototype and is kept only for historical reference. V2 reworks the
> system around two themes — **reliability** and **deviation-awareness** — and adds
> a fine-tuning study whose central claim is the poster's headline.

---

## Poster Layout Structure

A 4-column horizontal layout with clear visual hierarchy. Unlike V1, the research
finding (Column 3) is the visual centerpiece, not the system demo.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HEADER SECTION                                  │
│  [BOUN Logo]   TITLE: Nounce — Pronunciation Assessment        [QR → demo]   │
│                Authors, Advisors, Institution                                │
├───────────────┬───────────────────┬───────────────────┬─────────────────────┤
│ COLUMN 1      │ COLUMN 2          │ COLUMN 3          │ COLUMN 4            │
│ Problem &     │ System &          │ THE FINDING       │ Validation &        │
│ the Data Gap  │ Architecture      │ (cpl vs ppl)      │ Future Work         │
└───────────────┴───────────────────┴───────────────────┴─────────────────────┘
```

---

## Section 1: Header

### Title
**Nounce: Perceived-Label Fine-Tuning for English Pronunciation Assessment**
*Detecting what learners say — not what the dictionary says.*

Font: Sans-serif (Inter/Roboto), 85pt minimum. Bold, high contrast.

### Authors and Affiliations
Ümit Can Evleksiz · Ömer Faruk Bayram
**Advisors**: Lale Akarun, Murat Saraçlar
**Department of Computer Engineering**, Boğaziçi University

Font: 36pt for names, 24pt for affiliations.

### Logos
- **Boğaziçi University Logo**: top-left.
- **QR Code**: top-right → live demo (`nounce.pro`) / repository.

---

## Section 2: Problem & the Data Gap (Column 1)

### Heading
**The Challenge** (36pt, bold)

### Content (~110 words)
Turkish-native learners of English lack accessible, specific pronunciation feedback:

• **Limited access** to native speakers and quality instruction
• **Generic feedback** — "try again," with no phonetic detail

The deeper obstacle is technical. Phonetic foundation models such as **POWSM** are
trained on **canonical** (dictionary) transcriptions, so they *normalize away* the
very errors a tutor must surface.

**The data gap:** almost no public corpus provides the **perceived** (produced)
phone sequence for L2 English — the one signal a deviation detector needs to learn
from. We bridge it with **L2-ARCTIC** (canonical + perceived on identical audio) and
a small expert-annotated Turkish set.

### Visual Placeholder
[GRAPHIC: canonical vs perceived] Same waveform, two transcripts — the dictionary
form vs. what a listener actually hears — with the differing phones highlighted.

---

## Section 3: System & Architecture (Column 2)

### Heading
**How Nounce Works** (36pt, bold)

### Content (~150 words)
A reliable, deviation-aware pipeline reworked from the V1 prototype:

**Frontend** — React + TanStack Start (SSR); browser recording with per-phone
playback and goodness-of-pronunciation colouring.

**ML backend — a single endpoint**
- **POWSM** CTC: phone recognition **and** forced alignment from one model
  (replaces V1's Montreal Forced Aligner — one phone inventory, real timestamps)
- **Audio-quality abstention** (Silero VAD + SNR): refuses no-speech / noisy /
  wrong-sentence input instead of returning a misleading score
- **Articulatory feature-vector** diff & feedback (PanPhon) — *how far* a phone is
  from the target, not exact-match
- The V1 second (G2P) endpoint was removed: **one stateless worker** serves the
  whole path

**We curate the reference data ourselves** — running the model offline to produce
each reference's IPA + phone timings, paired with a human native recording, ingested
directly into the database.

**Compute** — RTX 4060 Ti (8 GB) for local dev/eval; a RunPod GPU pod for the full
training/eval sweep; the existing **serverless** endpoint (scales to zero) for
on-demand inference.

**Data layer** — Neon PostgreSQL · Cloudflare R2 · Docker.

### Visual Placeholder
[DIAGRAM: System Architecture]
```
User → Record → Web App → RunPod serverless (POWSM, one worker) → Feedback
                   ↓             ↑ self-curated references (IPA + timings)
              Neon DB / R2 ──────┘
```

---

## Section 4: The Finding (Column 3) — centerpiece

### Heading
**Supervision Convention Decides Everything** (36pt, bold)

### Content (~120 words)
A controlled ablation: **same audio, same LoRA recipe** (r=32, α=64) — only the
**label target** changes.

• **Canonical** supervision → deviation recall drops *below* baseline
  (**0.163 < 0.173**): it *actively harms* the detector.
• **Perceived** supervision → recall rises to **0.213**, plus the best Turkish
  PER (**0.392**) of any model.
• The gap **widens with training budget** — identical audio, opposite behaviour.

Scaling the same recipe to **full L2-ARCTIC** (6 first languages, ~900 utterances)
cut phone error rate **−19.5pp**, improving all six L1 groups. But maximum recall
came from *over-firing* (native false-positive rate **0.20**), so we deploy the
**focused** adapter (FPR **0.024**) — a deliberate point on the recall-precision
frontier.

### Visual Placeholders (the two must-have charts)
[CHART A — headline] `doc/report/figures/l2arctic_cpl_vs_ppl_long.png`
Caption: "Canonical supervision falls below baseline; perceived rises above. Same
audio, opposite supervision target."

[CHART B — inset] `doc/report/figures/deviation_recall_by_budget.png`
Caption: "The contrast widens from 30 → 60 epochs."

---

## Section 5: Validation & Future Work (Column 4)

### Heading
**Does It Track Humans? What's Next?** (36pt, bold)

### Content — Validation (~90 words)
**Human raters (blind, 0–10 intelligibility):** system vs. mean human rating
Spearman ρ = **0.37** — encouraging but *preliminary*: inter-rater agreement is
weak (Krippendorff α = **0.11**), so the human ground truth itself is noisy with
few raters. Reported honestly; more raters is the bottleneck.

**Public benchmark (speechocean762, 47k phones):** GOP rises monotonically with
expert accuracy, ρ = **0.21** — the score generalizes to a different L1.

### Visual Placeholders
[CHART: GOP vs accuracy] `doc/report/figures/gop_vs_accuracy.png`
[CHART: scatter] `doc/report/figures/scatter_system_vs_human.png` (optional, if space)

### Content — Future Work (~110 words)
**The single most important win — a perceived-annotated L2 corpus.** Every result
here is gated on data scarcity: public L2-English resources give canonical labels
or holistic scores, almost never the *perceived* phones a detector needs. Building
that corpus would let this recipe scale directly.

**Per-accent adapters.** A family of small adapters — one per L1 (Turkish, Arabic,
Mandarin…) over a single frozen POWSM backbone, selected by the learner's L1 —
generalizes the Turkish result cheaply.

**Expert-in-the-loop data flywheel (industry-standard).** Turn the app into a
labelling tool: surface learner recordings + the system's auto-annotations to expert
linguists, who correct them in the model's convention; corrected pairs become new
training data → better adapters → better auto-annotations. Directly attacks the
bottleneck while improving the deployed model.

### Conclusion Callout Box
> **Convention beats quantity: *what* you label as the training target decides
> whether fine-tuning builds a deviation detector or just a better transcriber.**

---

## Section 6: Footer

### Acknowledgments
"This project uses POWSM (CMU), L2-ARCTIC, speechocean762, PanPhon, TanStack, and
Neon PostgreSQL. Turkish-native English corpus kindly contributed by
Öğr. Gör. Dr. Kardelen Kılınç, Eskişehir Technical University."

### References (18pt, compact)
- Li et al. (2025). POWSM: A Phonetic Open Whisper-Style Speech Foundation Model. arXiv.
- Zhao et al. (2018). L2-ARCTIC: A Non-native English Speech Corpus. Interspeech.
- Hu et al. (2022). LoRA: Low-Rank Adaptation. ICLR.

### Contact/Links
GitHub: github.com/umitcan07/senior · Live demo: [QR Code]

---

## Design Guidelines

### Color Palette
| Element          | Color                         |
| ---------------- | ----------------------------- |
| Background       | White (#FFFFFF) or Light Gray |
| Primary Accent   | Deep Blue (#1E3A8A)           |
| Perceived (good) | Blue (#4F81BD)                |
| Canonical (bad)  | Red (#C0504D)                 |
| Highlight/CTA    | Orange (#F97316)              |
| Text (primary)   | Dark Gray (#1F2937)           |

> Reuse the cpl-vs-ppl chart colours (perceived = blue, canonical = red) consistently
> across the poster so the finding reads at a glance.

### Typography
| Element         | Font           | Size  |
| --------------- | -------------- | ----- |
| Title           | Inter Bold     | 85pt+ |
| Section Headers | Inter SemiBold | 36pt  |
| Body Text       | Inter Regular  | 24pt  |
| Captions        | Inter Italic   | 18pt  |

### Readability Distances
- Title: 15+ ft · Headers: 10 ft · Body: 5 ft · Captions: 3 ft

---

## Visual Asset Checklist

| Asset                              | Source/Action                                         |
| ---------------------------------- | ----------------------------------------------------- |
| Boğaziçi University Logo           | Institutional site                                    |
| cpl-vs-ppl recall chart (headline) | `doc/report/figures/l2arctic_cpl_vs_ppl_long.png`     |
| recall-by-budget chart             | `doc/report/figures/deviation_recall_by_budget.png`   |
| GOP-vs-accuracy box plot           | `doc/report/figures/gop_vs_accuracy.png`              |
| system vs human scatter            | `doc/report/figures/scatter_system_vs_human.png`      |
| Recording UI screenshot            | `doc/report/images/screen/nounce-ss-recording.png`    |
| Intelligibility-rating screenshot  | `doc/report/images/screen/nounce-ss-intelligibility.png` |
| System Architecture Diagram        | Create (Figma/Draw.io)                                |
| QR Code (Demo/Repo)                | Generate                                              |

---

## Word Count Estimate

| Section                       | Words |
| ----------------------------- | ----- |
| Title + Authors               | 25    |
| Problem & Data Gap            | 110   |
| System & Architecture         | 150   |
| The Finding                   | 120   |
| Validation                    | 90    |
| Future Work                   | 110   |
| Footer & References           | 45    |
| **Total**                     | ~650  |

✓ Within 300–800 word guideline

---

## Three Key Questions (Poster Preparation)

### 1. What is the most important/interesting finding?
**The annotation *convention* of the training target — not the amount of data —
decides whether fine-tuning helps.** Trained on canonical labels, an adapter gets
*worse* at detecting deviations (recall drops below baseline); trained on perceived
labels over identical audio, it improves. The contrast widens with training budget.

### 2. How can I visually share it?
- **cpl-vs-ppl recall chart** — the whole thesis in one image (red below, blue above baseline).
- **recall-by-budget chart** — shows the effect strengthening with training.
- **GOP-vs-accuracy box plot** — external benchmark validation.
- **Architecture diagram + UX screenshots** — proves it's a real, deployed product.

### 3. What can I add in the talk?
- **Live demo**: record speech, show real-time per-phone feedback.
- **The recall/precision trade-off**: why we deployed the *focused* adapter, not the
  highest-recall one (native FPR 0.20 vs 0.024).
- **Honest validation**: ρ=0.37 with α=0.11 — what weak inter-rater agreement means
  and why more raters is the priority.
- **The data flywheel**: how an expert-in-the-loop app would solve the corpus
  scarcity that gates the whole field.
