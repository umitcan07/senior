# Nounce Project Presentation Content

## Introduction

### Problem Statement

Language learners seek to improve their pronunciation to articulate sounds more accurately. However, accessing authentic pronunciations from native speakers in real-world contexts presents significant challenges. Obtaining detailed, granular feedback on pronunciation accuracy is equally difficult.

**Challenges:**
- Limited access to supervising native speakers
- Fear of judgment when practicing with others
- Generic feedback that lacks specificity
- Missing detailed analysis at the phonetic level

### Solution

Nounce provides a comprehensive platform for learners to improve their pronunciation through listening and imitation exercises. The system delivers detailed, actionable feedback on pronunciation attempts, enabling accelerated learning.

The platform performs phonetic analysis on user speech recordings, generating precise insights into pronunciation errors and how to correct them. To support this process, we curate practice texts paired with reference audio recordings, allowing users to select their preferred speaker and practice matching their pronunciation.

---

## Phonetic Foundation

### IPA and Phonetic Concepts

Speech and pronunciation are fundamentally composed of phonemes and phones. While there is no single "correct" pronunciation, language learners typically select a widely recognized dialect as their target and practice mimicking it.

The International Phonetic Alphabet (IPA) serves as the standard system for describing speech sound units, encompassing hundreds of distinct phones. Languages vary in how they abstract these sounds into broader phonemic categories.

**Key Concepts:**
- **Grapheme**: Written representation (e.g., "The")
- **Phoneme**: Abstract sound unit (e.g., /ðə/)
- **Phone**: Actual acoustic realization (e.g., [ðə], [ðı], [ðiː])

A core educational objective is to help learners understand and adopt concepts such as IPA notation, dialectal variation, and speaker-specific phonetic realizations.

### Limitations

Pure phone-level analysis presents significant technical challenges. The model operates in a hybrid space between phonemic and phonetic representation, which introduces complexity. Additionally, we currently lack sufficient allophone-level training data, which would enable more language-independent phonetic analysis.

While similar commercial products exist in the market, Nounce distinguishes itself through its open-source approach and focus on educational transparency.

---

## Deep Learning Model

### POWSM (Phonetic Open Whisper-Style Model)

Nounce leverages POWSM (Phonetic Open Whisper-Style Model) for Phone Recognition (PR) and Grapheme-to-Phoneme (G2P) tasks. This foundation model demonstrates strong performance across multiple languages and diverse phonetic tasks.

**Technical Architecture:**

POWSM is an attention-based deep learning acoustic model built on an encoder-decoder architecture:
- **Architecture**: Attention-based encoder-decoder (AED) following the OWSM (Open Whisper-style Speech Model) framework
- **Encoder**: E-Branchformer with ~350M parameters, operating at 40ms stride
- **Decoder**: Transformer decoder for sequence generation
- **Training**: Hybrid CTC/attention loss (30% CTC, 70% attention)
- **Vocabulary**: 40k tokens including ~6k phone tokens, language markers, and BPE tokens
- **Training Data**: IPAPack++ dataset with 17,000+ hours of multilingual speech
- **Input Format**: 16kHz audio, padded/truncated to 20 seconds

**POWSM Capabilities:**
- Phone Recognition (PR): Audio → IPA phonemes
- Automatic Speech Recognition (ASR): Audio → text
- Audio-guided Grapheme-to-Phoneme conversion (G2P): Text + optional audio → IPA
- Audio-guided Phoneme-to-Grapheme conversion (P2G): IPA + optional audio → text

Within the platform, we specifically utilize the G2P and PR model variants to generate IPA transcriptions and analyze pronunciation accuracy.

### Model Limitations

POWSM operates in a hybrid representation space that is neither strictly phonemic nor purely phonetic. This design choice introduces some ambiguity in phonetic categorization. Furthermore, the current implementation lacks comprehensive allophone-level training data, which would enhance the model's ability to generalize across languages and dialects.

---

## Core Components

### Technical Stack

**Phonetic Model:**
- POWSM (espnet)

**Time Alignment:**
- Montreal Forced Aligner (MFA)

**GPU Infrastructure:**
- RunPod Serverless

**Application:**
- TanStack App deployed on Fly.io

**Object Storage:**
- Cloudflare R2

**Database:**
- PostgreSQL (Neon serverless)

### Engineering & Workflow

**Development without GPU:**
- Local development environment simulates RunPod Serverless Endpoints through a GPU proxy server, enabling development and testing without direct GPU access.

**Dataset & Customization:**
- Fine-tuning the model with speech data from native Turkish speakers will improve accuracy for the target user population, addressing pronunciation patterns specific to Turkish-native English learners.

---

## Functionalities

### Learning Board

The Learning Board provides an interactive reference for English sounds, featuring comprehensive IPA representations with markers and diacritics to help learners understand phonetic distinctions.

### Practice Texts

Users can select reference speech recordings, view corresponding IPA transcriptions, record their own pronunciation attempts, and receive detailed phonetic analysis comparing their speech to the target pronunciation.

**Example:**
- Text: "She regularly exercises at the gym."
- IPA: "ʃiɹɛɡjələ˞liɛksə˞saɪzəzætðətʃɪ̃m"

### Summary and History

The platform aggregates data from past pronunciation attempts, identifying common mistakes and tracking progress over time to provide personalized learning insights.

### Admin Panel

Administrators can perform full CRUD operations on practice texts and generate reference speech recordings through two methods: uploading native speaker audio files or synthesizing speech using ElevenLabs text-to-speech technology.

---

## Future Work & Considerations

### Language Support

Nounce is currently designed exclusively for English to streamline initial development and ensure high-quality pronunciation assessment. Future development will expand support to additional languages, leveraging the multilingual capabilities of the underlying POWSM model.

### Accents & Variations in Language

**Bias Towards:** The system focuses on US English pronunciation, which may appear prescriptive. However, it is crucial to emphasize that all dialects, accents, and language variants are linguistically valid. US English is chosen not to minimize or devalue other accents, but because it is widely adopted and in high demand globally, particularly in professional and academic contexts.

The system aims to improve comprehensibility and communication effectiveness rather than eliminate linguistic diversity. Users are encouraged to understand that accent reduction is optional and that the primary goal is clear communication, not accent elimination.

### Acoustic Model Fine-tuning

Fine-tuning the acoustic model with speech data from native Turkish speakers will improve pronunciation assessment accuracy for the primary target user population, addressing specific phonetic transfer patterns from Turkish to English.

---

## Branding

Nounce - English Pronunciation Assessment Platform

**Website:** www.nounce.pro

