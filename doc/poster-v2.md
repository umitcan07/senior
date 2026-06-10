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
[GRAPHIC: canonical vs perceived — **reuse the V1 poster's phone/phoneme diagram**]
The V1 poster's `one /wʌn/ → [wʌn] [wʌŋ] [wʌn̪]` graphic is already a perfect
explainer: relabel the dictionary form **canonical** and the realizations
**perceived**, highlight the differing phones in the red/blue scheme. Visual
continuity with V1, zero new asset work.

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

### "What changed since the prototype" delta table
Converts V1's *Limitations* column into V2's narrative spine — exactly what a
senior-project jury wants to see:

| V1 prototype (CMPE491) | V2 |
| --- | --- |
| MFA for timestamps | POWSM CTC forced alignment (one model, one phone inventory) |
| Two endpoints (G2P + PR) | One stateless worker |
| Exact-match phone diff | PanPhon articulatory feature distance |
| Scores any audio | Abstains on no-speech / noise / wrong sentence (VAD + SNR) |
| Off-the-shelf POWSM | + Turkish-deviation-aware LoRA adapter (deployed) |

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

[CHART C — frontier inset] `doc/report/figures/recall_vs_fpr_frontier.png`
Recall-vs-native-FPR scatter, three points: base (0.173 / 0.003), deployed
`l2a_ppl_long` (0.213 / 0.024), full-corpus `l2a_ppl_full` (0.362 / 0.203), with a
shaded "usable region" (FPR < 0.05). One glance explains why the highest-recall
adapter is *not* the deployed one — a tutor that flags 1-in-5 correct native phones
erodes trust. Strongest talking-point hook on the poster.

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
expert accuracy, ρ = **0.21** phone-level, **0.37 sentence-level** — the score
generalizes to a different L1. (The sentence-level 0.37 mirrors the human study's
0.37 — memorable symmetry, quote both.)

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

### Continuity with the V1 poster
Keep the V1 visual identity so anyone who saw the V1 poster reads the progression
instantly: nounce wordmark/branding, the `nounce.pro` QR, the red/blue
(canonical/perceived) accent palette already used in the report charts, and ideally
the same running example sentence — **"She regularly exercises at the gym."**
(reference IPA `ʃiɹɛɡjələ˞liɛksə˞saɪzəzætðətʃɪm`) — as the UI screenshot, so the
phone-level analysis is the visible bridge from V1's app tour to V2's finding. Use
whatever deviation the live analysis actually produces for the screenshot rather
than a scripted one.

> Note: the V1 phone-vs-phoneme explainer graphic (the `/wʌn/ → [wʌn] [wʌŋ] …`
> diagram) is **not a committed repo asset** — it lives in the V1 poster source.
> Recreate/relabel it (canonical vs perceived, red/blue) in the poster tool; it is
> not auto-generated like the result charts.

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
| recall-vs-FPR frontier inset       | Create (3 points: base / deployed / full-corpus)      |
| GOP-vs-accuracy box plot           | `doc/report/figures/gop_vs_accuracy.png`              |
| system vs human scatter            | `doc/report/figures/scatter_system_vs_human.png`      |
| phone/phoneme (canonical vs perceived) graphic | Adapt from V1 poster (`one /wʌn/` diagram) |
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
| Validation                    | 100   |
| Future Work                   | 110   |
| Footer & References           | 45    |
| **Total**                     | ~660  |

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
- **The recall/precision trade-off**: walk the frontier inset (Chart C) — why we
  deployed the *focused* adapter, not the highest-recall one (native FPR 0.20 vs 0.024).
- **Honest validation**: ρ=0.37 with α=0.11 — what weak inter-rater agreement means
  and why more raters is the priority.
- **The data flywheel**: how an expert-in-the-loop app would solve the corpus
  scarcity that gates the whole field.
