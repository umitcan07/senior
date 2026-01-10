# Nounce: Pronunciation Assessment System for English Language Learners

## Presentation Scripts

---

## Short Presentation (3 Minutes)

### Opening (30 seconds)

"Have you ever struggled with English pronunciation? Maybe you've wondered if you're saying a word correctly, but had no one to ask? That's the problem Nounce solves.

Nounce is a web-based pronunciation assessment platform that helps English language learners improve their pronunciation through automated speech analysis and personalized, phonetic-level feedback."

### The Problem (30 seconds)

"Traditional language learning faces three major challenges:

1. **Limited access to native speakers** – not everyone has a tutor or native-speaking friends
2. **Fear of judgment** – learners often feel embarrassed practicing pronunciation
3. **Lack of specific feedback** – generic apps say 'try again' but don't explain *what* is wrong

Nounce addresses all three by providing a private, judgment-free environment with detailed, actionable feedback."

### How It Works (45 seconds)

"Here's how Nounce works:

1. **Select a practice text** – choose from various difficulty levels and categories
2. **Record your speech** – directly in the browser with real-time audio visualization
3. **Get instant analysis** – powered by POWSM, a state-of-the-art open-source phonetic transcription model
4. **Review detailed feedback** – see exactly which phonemes you pronounced differently, with error classification as substitutions, insertions, or deletions

The system uses the International Phonetic Alphabet (IPA) to give you precise feedback on each sound, not just whole words."

### Technology Overview (30 seconds)

"Under the hood, Nounce combines:

- **Modern web technologies**: React with TanStack Start for a responsive UI
- **Serverless ML infrastructure**: Python services on RunPod for GPU-powered inference
- **Cloud-native architecture**: Neon PostgreSQL for data, Cloudflare R2 for audio storage

Everything is containerized with Docker for reliable deployment."

### Impact and Closing (45 seconds)

"Who benefits from Nounce?

- **Self-directed learners** who want to practice independently
- **Non-native speakers** preparing for speaking tests or professional settings
- **Anyone** who wants to understand their pronunciation at a technical level

Our focus is on US English, initially targeting Turkish-native speakers, with plans to expand.

Importantly, Nounce doesn't judge accents – all dialects are valid. We focus on **comprehensibility**, helping you communicate clearly while respecting linguistic diversity.

Thank you. I'd be happy to demonstrate the platform or answer questions."

---

## Long Presentation (10 Minutes)

### Opening and Motivation (1 minute)

"Good [morning/afternoon]. I'm Ümit Can Evleksiz, and today I'm presenting Nounce – a pronunciation assessment system for English language learners.

Let me start with a question: How do you know if you're pronouncing English correctly?

For most learners, the answer involves human feedback – a teacher, a friend, or just hoping for the best. But what if you don't have access to these resources? What if you want to practice at 2 AM? What if you're embarrassed to make mistakes in front of others?

That's why I built Nounce – to democratize access to detailed pronunciation feedback using modern speech technology."

### Problem Statement (1 minute 30 seconds)

"The challenges in pronunciation learning are significant:

**Access barriers**: Quality pronunciation instruction requires either expensive tutoring or access to native speakers. Not everyone has this privilege.

**Psychological barriers**: Speaking in a new language can be intimidating. Learners often avoid practice because they fear judgment or embarrassment.

**Feedback quality**: Most language apps provide only surface-level feedback – 'Good job!' or 'Try again.' They don't tell you *what* went wrong at the phonetic level.

**Linguistic misconceptions**: Many people believe there's one 'correct' way to speak English. This prescriptive approach discourages learners and ignores the reality that all accents are valid.

Nounce addresses these issues by providing:
- 24/7 accessible practice
- A private, judgment-free environment
- Phoneme-level feedback using IPA
- An emphasis on comprehensibility rather than accent elimination"

### System Architecture (2 minutes)

"Let me walk you through the system architecture.

**The Frontend (app/)**

Nounce uses a modern React application built with TanStack Start, which provides:
- Server-side rendering for fast initial loads
- File-based routing with TanStack Router
- Efficient data fetching with TanStack Query
- Beautiful UI components from Shadcn UI with Tailwind CSS
- Secure authentication through Clerk

Users can:
- Browse and select practice texts by difficulty and category
- Record speech directly in the browser with real-time waveform visualization
- View detailed analysis results with phoneme-level error highlighting
- Track their progress over time

**The Backend ML Services (mod/)**

The machine learning components are deployed as serverless endpoints on RunPod:

1. **IPA Generation Endpoint** – Converts English text to IPA phonetic transcription using POWSM
2. **Assessment Endpoint** – Compares user audio against target pronunciation, returning:
   - Accuracy scores
   - Error classification (substitution, insertion, deletion)
   - Timestamp alignment for each phoneme

Both services are containerized with Docker, enabling:
- Scalable GPU inference on demand
- Cost-effective serverless pricing
- Independent deployment and updates

**Data Layer**

- **Neon PostgreSQL**: Serverless database for user recordings, analyses, and metadata
- **Cloudflare R2**: Object storage for audio files
- **Comprehensive schema**: Designed for tracking phoneme errors, word errors, audio quality metrics, and user progress"

### The POWSM Model Deep Dive (2 minutes)

"At the heart of Nounce is POWSM – the Phonetic Open Whisper-Style Speech Model.

**What makes POWSM special?**

POWSM is the first unified framework capable of jointly performing multiple phone-related tasks:
- **Phone Recognition (PR)**: Audio → IPA phonemes
- **Automatic Speech Recognition (ASR)**: Audio → text
- **Grapheme-to-Phoneme (G2P)**: Text → IPA (with optional audio context)
- **Phoneme-to-Grapheme (P2G)**: IPA → text

**Why POWSM for Nounce?**

1. **Audio-guided transcription**: Unlike dictionary-based G2P, POWSM listens to actual audio, capturing variations in pronunciation, accents, and even errors.

2. **State-of-the-art accuracy**: POWSM outperforms or matches specialized models like Wav2Vec2Phoneme and ZIPA while supporting multiple tasks.

3. **Language-agnostic design**: Trained on 17,000+ hours of multilingual data, it generalizes well to unseen languages and socio-phonetic variations.

4. **Open source**: Fully reproducible with publicly available code, data, and model checkpoints.

**Technical Architecture**

POWSM uses an attention-based encoder-decoder (AED) architecture:
- E-Branchformer encoder with ~350M parameters
- Hybrid CTC/attention loss for training
- 40k token vocabulary including ~6k phone tokens
- Trained on IPAPack++ dataset

The key insight is that the encoder captures general acoustic patterns through CTC supervision, while the decoder handles language-specific output formatting. This separation enables robust performance on both in-domain and out-of-domain data."

### Full-Stack Application Features (2 minutes)

"Let me demonstrate the key features of the application.

**User Features**

1. **Practice Workflow**
   - Browse texts by difficulty (beginner, intermediate, advanced)
   - Filter by category (daily, professional, academic, phonetic challenge)
   - Select a text and view reference pronunciation with IPA
   - Record your speech with real-time visual feedback
   - Submit for analysis

2. **Analysis Results**
   - Overall pronunciation score (0-100%)
   - Side-by-side comparison: target IPA vs. recognized IPA
   - Color-coded error highlighting
   - Error classification with timestamps
   - Audio playback synchronized with analysis

3. **Learning Resources**
   - IPA chart with audio examples
   - Phoneme descriptions and articulatory features
   - Common error patterns for Turkish speakers

4. **Progress Tracking**
   - Recording history with timestamps
   - Score trends over time
   - Frequently missed phonemes

**Admin Features**

1. **Text Management**
   - Create, edit, delete practice texts
   - Set difficulty levels and categories
   - Add notes and pronunciation tips

2. **Reference Speech Management**
   - Upload native speaker audio
   - Generate TTS references
   - Set IPA transcriptions

The entire system emphasizes:
- Clean, intuitive UI design
- Responsive layouts for mobile and desktop
- Accessibility compliance
- Fast, asynchronous processing"

### Ethical Considerations (1 minute)

"I want to address the ethical dimensions of this project.

**Linguistic Diversity**

Nounce focuses on US English pronunciation, but I want to be clear: this is not about accent elimination. All dialects and accents are linguistically valid. We chose US English because it's widely demanded, particularly in professional contexts.

The goal is **comprehensibility** – helping learners communicate clearly, not conforming to a single 'correct' pronunciation.

**Data Privacy**

User speech is sensitive data. Nounce implements:
- Clear consent mechanisms for recording
- Explicit opt-in for any use beyond immediate analysis
- Secure storage with encryption
- Transparent data usage policies

**Accessibility**

Educational technology shouldn't gatekeep learning. We're committed to:
- Maintaining a free tier with core functionality
- Educational discounts
- Open-source components that others can build upon"

### Demo and Results (30 seconds)

"Let me briefly show the application in action...

[Note: Presenter demonstrates recording, analysis flow, and results display]

Users consistently report that the phoneme-level feedback helps them understand *specifically* what to improve, rather than just repeating attempts blindly."

### Conclusion and Future Work (30 seconds)

"To summarize, Nounce provides:
- Accessible, 24/7 pronunciation practice
- State-of-the-art phonetic analysis using POWSM
- Detailed, actionable feedback at the phoneme level
- A respectful approach that values linguistic diversity

**Future directions include:**
- Fine-tuning POWSM for Turkish-native speakers
- Adding reference audio playback with the user's cloned voice
- Expanding to British English
- Mobile app development

Thank you. I'm happy to take questions and demonstrate any feature in detail."

---

## Q&A Preparation

### Anticipated Questions

**Q: Why not use commercial solutions like ELSA Speak?**
A: Nounce is open-source, academically grounded, and allows full customization. We also provide phonetic-level (IPA) feedback rather than just word-level scoring.

**Q: How accurate is the phonetic transcription?**
A: POWSM achieves state-of-the-art performance on standard benchmarks. For English, phonetic feature error rates are around 2.85 PFER, comparable to or better than specialized models.

**Q: Why focus on Turkish speakers initially?**
A: My native language provides domain expertise for identifying common error patterns. The architecture is language-agnostic and can be extended to other L1 backgrounds.

**Q: What about prosody (stress, intonation)?**
A: The current system focuses on segmental (phoneme-level) pronunciation. Prosodic features are a valuable future direction.

**Q: How is user data protected?**
A: Audio is stored encrypted, with explicit consent for any use beyond immediate analysis. We follow GDPR-compliant principles for data handling.
