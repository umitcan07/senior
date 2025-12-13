# Learning Documentation

## Table of Contents
1. [Machine Learning and Deep Learning](#machine-learning-and-deep-learning)
2. [Signal Processing Fundamentals](#signal-processing-fundamentals)
3. [Meetings](#meetings)
4. [Resources & References](#resources--references)

---

## Machine Learning and Deep Learning

### Fundamental Machine Learning Algorithms
- Linear Regression

### Fundamental Deep Learning Algorithms
- Neural Networks

### Audio Processing Pipeline

**Input:** Audio Input (Turkish speaker)

**Step 1: Phonetic Transcription**
- **Tools:**
  - Wav2Vec 2.0 (via HuggingFace: `facebook/wav2vec2-large-xlsr-53`)
  - POWSM (Phonetic Open Whisper-Style Speech Model) - `espnet/owsm_v4_medium_1B`
  - WavLM - `microsoft/wavlm-large`
  - Allosaurus
- **Output:** Phonetic IPA transcription
- **Approach:** Fine-tune pre-trained models with custom data (Turkish speakers) for better performance

**Example output:**

```
həloʊ ɛvɹɪwʌn, aɪɐm ɛmɪkænd ænd ðɪs ɪz ðə dɛmənstɹeɪʃən vɪdɪoʊ fɔːɹ pɑːɹʃəl ɪmplɪmənteɪʃən. tuː taɪmz aʊɚ sɪstəm ɪz ɹᵻspɑːnsᵻbəl fɔːɹ piəɹɪɑːdɪkli tʃɛkɪŋ ðə lɪst lɛvəl ʌv beɪbi ænd ɐlɜːɾɪŋ ðə kɛɹɾeɪkɚ ɔːɹ ɐlɜːɾɪŋ ðə pɜːsənəl ɪntɹɛst vaɪə waɪɚləs kəmjuːnɪkeɪʃən ɪn keɪs ʌv ɛni deɪndʒɚ. soʊ wiː ɑːɹ æktʃuːəli ɐbstɹæktᵻd ðə weɪ ðə kælkjʊleɪʃən ʌv lɪst lɛvəl ɪnstɛd wiː juːz tuː swɪtʃᵻz. ðɪs ɪz ɡoʊɪŋ təbi ɹᵻpleɪst baɪ æktʃuːəl ælɡɚɹɪθəm ænd ænəlɑːɡ ɪnpʊt ɪnðə piːaɪ faɪv. soʊ wiː hæv tuː swɪtʃᵻz hɪɹ. aʊɚɹ aʊtpʊt kəmpoʊnənts ɑːɹ ɛliːdiː ænd bʌzɚɹ ænd wiː ɔːlsoʊ hæv ɐnʌðɚ swɪtʃ. ðɪs ɪz dʒʌst wɜːkɪŋ ᵻlɛktɹɪkli tə tɑːɡəl bᵻtwiːn saʊnd ænd saɪlənt moʊd. ænd lɛts tɔːk ɐbaʊt ðə ɹoʊlaʊt taɪmɚɹ ɪn aʊɚ piːaɪ. wiː hæv tuː taɪmɚz fɔːɹ ðɪs piːaɪ. wʌn fɔːɹ piəɹɪɑːdɪkli tʃɛkɪŋ baɪ tʃɛkɪŋ aɪ miːn tʃɛkɪŋ ðɪ ɪnpʊts ʌv aʊɚ swɪtʃᵻz, tʃɛkɪŋ ðə lɪst lɛvəl ænd ɐnʌðɚ taɪmɚɹ ɪz fɔːɹ ɐdʒʌstɪŋ ðə fɹiːkwənsi ʌv aʊtpʊt kəmpoʊnənts iːðɚɹ ɛliːdiː ɔːɹ bʌzɚ. oʊkeɪ, lɛts siː ɛvɹɪθɪŋ ɪn ækʃən. kɜːɹəntli deɪndʒɚ lɛvəl ɪz sɛt tə ziəɹoʊ ænd wiː ɑːɹ ɪn saʊnd moʊd. lɛts siː wʌt hæpənz wɛn ðə deɪndʒɚ lɛvəl ɪz wʌn. deɪndʒɚ lɛvəl tuː. deɪndʒɚ lɛvəl θɹiː. lɛts siː ðə saɪlənt moʊd. wʌn, tuː, θɹiː. aɪ wɔnt tʊ ɛmfɐsaɪz ðæt ðɛɹ ɪz ɐ nɑːks bʌt ðə lɛɡ bᵻtwiːn ðə tʃeɪndʒ ʌv ɪnpʊts ænd tʃeɪndʒ ʌv aʊtpʊts. ðɪs ɪz ɛɡzædʒɚɹeɪɾᵻd ɪn dɛmənstɹeɪʃən ɔn pɜːpəs bɪkʌz wiː wɔntᵻd tʊ ɛmfɐsaɪz ðə ɹoʊlaʊt fɜːst taɪm, ðə ɹoʊlaʊt piəɹɪɑːdɪk tʃɛkɪŋ. ænd æz aɪ sɛd, ɪts ɡoʊɪŋ təbi ɹᵻpleɪst ɪn piːaɪ faɪv wɪð æktʃuːəl ælɡɚɹɪθəm ænd wɪð pɑːsᵻbli mɔːɹ fɹiːkwənt tʃɛkɪŋz. θæŋks fɔːɹ wɑːtʃɪŋ.
```

**Step 2: Alignment**
- **Tools:**
  - Montreal Forced Aligner (MFA) - industry standard, English out-of-the-box
  - Wav2TextGrid - deep learning-based, trainable forced aligner
- **Output:** Phone-level timestamps

**Step 3: Mispronunciation Detection**
- Compare with canonical IPA
- Compute GOP scores
- Classify error types:
  - Substitution (θ→t)
  - Deletion
  - Insertion

**Output:** Phoneme-level errors + timestamps

### Database Architecture

1. **User Upload**
   - User uploads audio file -> .webm codecs/opus

2. **Storage Layer**
   - **Action:** Store .wav files in S3 -> 16bit 16kHz mono -> ~1.8MB per second
   - **Purpose:** Long-term storage (S3/filesystem)

3. **Database Layer**
   - **Action:** Store path + metadata in database
   - **Purpose:** Metadata only

### Audio Quality Metrics

**Critical frequencies for phonetics:**
- Fricatives (θ, s, ʃ): 4-8 kHz
- Formants: 200-3000 Hz

**Preprocessing Audio:**
- Audio to Visualization: UI-Friendly Waveform
- Light Noise Reduction
- Sound Quality Test: SNR, THD, etc. → Reject analysis if quality is too low.

| Metric              | Accept | Warning         | Reject      |
| ------------------- | ------ | --------------- | ----------- |
| SNR                 | ≥15 dB | 12-15 dB        | <12 dB      |
| Spectral Flatness   | <0.4   | 0.4-0.5         | >0.5        |
| Speech Energy Ratio | >0.4   | 0.3-0.4         | <0.3        |
| Clipping Ratio      | <0.1%  | 0.1-1%          | >1%         |
| Silence Ratio       | 10-50% | 5-10% or 50-70% | <5% or >70% |

---

## Signal Processing Fundamentals

### Time Analysis
- Envelope Detection

### Frequency Analysis
- FT, DFT, DTFT

### Time-Frequency Analysis
- STFT (Short Time Fourier Transform) for Time-Frequency Analysis
- Windowing 
- Rectangular Window → Sinc as Fourier
- Han Window → (1 - cos(2πt/T))/2

---

## Meetings

### Initial Discussion with Murat Saraclar
- Understanding the core signal processing techniques and their applications in the field of phonetics
- Deep Learning becoming the industry standard for many tasks in the field of phonetics

### Office Hours with Stephano (22 October 2025)
- Phonetics vs Phonology distinction. Importance of phonetic transcription for pronunciation assessment
- Deep Learning models could be trained to "fix" little nuances and might not be optimized to distinguish between allophones
- Focus on `target: English` and `audience: Turkish speakers`
- Bias in models that would make it harder to identify phonetic characteristics of English utterances by Turkish speakers (Fine-tuning? Providing Context?)
- Correct vs User IPA transcription: Diffing should be relatively easy → Consider inserted or deleted sounds
- Error rate: (insertions + deletions + 2 * corrections) / total sounds

---

## Resources & References

### Deep Learning Models & Libraries for Phonetic Transcription/Assessment

#### Foundation Models
- **Wav2Vec 2.0**: Self-supervised model for speech representation learning
  - HuggingFace: `facebook/wav2vec2-large-xlsr-53`
  - [Fine-tuning guide](https://huggingface.co/blog/fine-tune-wav2vec2-english)
  - Can be fine-tuned for phonetic recognition tasks
  - Available via HuggingFace Transformers library

- **POWSM (Phonetic Open Whisper-Style Speech Model)**: Open-source foundation model specifically engineered for phonetic transcription
  - HuggingFace: `espnet/owsm_v4_medium_1B`
  - Direct alternative to Whisper for phonetic tasks
  - Open-source transparency

- **WavLM**: Microsoft's extension of Wav2Vec with gated relative position bias
  - HuggingFace: `microsoft/wavlm-large`
  - State-of-the-art performance on speech understanding tasks

- **Whisper**: OpenAI's general-purpose ASR model
  - While primarily for text transcription, has potential for phonetic output
  - Not open-source (training data/code not released)

#### Libraries
- **HuggingFace Transformers**: Provides access to pre-trained models and facilitates fine-tuning
  - Convenient API for loading and fine-tuning models
  - Supports wav2vec 2.0, WavLM, and other speech models

### Architectural Approaches & Concepts

#### Two-Stage Approach
- First: Speech-to-phoneme transcription using acoustic models
- Second: Forced alignment for temporal alignment
- Allows independent optimization of transcription accuracy and alignment precision

#### End-to-End Approach
- Direct mapping from audio to phonetic sequences or mispronunciation labels
- Often uses CTC (Connectionist Temporal Classification) for sequence alignment
- Enables training without explicit frame-level labels

#### CTC (Connectionist Temporal Classification)
- Useful for fine-tuning models like wav2vec 2.0 for sequence tasks
- Alignment not explicit in training data
- Enables training on sequences without frame-level annotations

#### LCS-CTC
- Two-stage framework combining similarity-aware local alignment with constrained CTC
- Uses modified Longest Common Subsequence algorithm
- Improves robustness on both fluent and non-fluent speech
- Paper: [LCS-CTC: Leveraging Soft Alignments to Enhance Phonetic Transcription Robustness](https://arxiv.org/pdf/2508.03937)

#### IPA (International Phonetic Alphabet)
- Standard for representing phonetic symbols
- Crucial for consistent output and comparison
- Enables accurate diffing between target and actual pronunciations

#### Fine-tuning with Custom Data
- Critical for adapting models to specific accents/languages
- Example: Using Turkish user recordings to improve performance for Turkish-native English speakers
- Can significantly improve accuracy for target population

### Tools for Time Alignment (Phonetic Level)

- **Montreal Forced Aligner (MFA)**: Industry-standard tool for phoneme-level time alignment
  - [Documentation](https://montreal-forced-aligner.readthedocs.io/en/latest/index.html)
  - Supports English out-of-the-box
  - Trainable for other languages
  - Uses acoustic models trained on phonetically transcribed corpora

- **Wav2TextGrid**: Deep learning-based, trainable forced aligner
  - End-to-end trainable
  - Potentially higher accuracy with custom training data
  - Suitable for non-standard accents or specialized speech domains

### Pronunciation Assessment Metrics

- **Phoneme Error Rate (PER)**: Quantifies discrepancy between target and actual transcriptions
- **Duration Analysis**: Examines temporal characteristics of phonemes
- **Articulation Quality Scores**: Assesses acoustic properties using GOP (Goodness of Pronunciation) metrics
- **Error Classification**: Substitution, deletion, insertion

### Phonetic Transcription Models
- [PAST](https://github.com/lizhen18THU/PAST)
- [MultIPA](https://github.com/ctaguchi/multipa?tab=readme-ov-file)

### Commercial Applications

- **ELSA Speak**: SaaS application for pronunciation assessment
  - [Website](https://elsaspeak.com/en/)
  - Real-time pronunciation feedback for English language learners
  - Industry-grade reference for pronunciation assessment systems

### Relevant Research Papers

- **LCS-CTC**: [LCS-CTC: Leveraging Soft Alignments to Enhance Phonetic Transcription Robustness](https://arxiv.org/pdf/2508.03937) - Ye et al., 2025
- Additional papers referenced in the report's Related Work section

---

## Codebase Architecture

### Database Layer Pattern
- **DB functions** (`src/db/*.ts`): Pure database operations, no server/client logic
- **Server functions** (`src/lib/*.ts`): Use `createServerFn` for RPC, call DB functions
- **Loaders**: Call server functions (not DB directly) - loaders are isomorphic
- **Components**: Use `useServerFn` hook with TanStack Query for data fetching

### TanStack Start Best Practices
- Loaders run on both server and client → use server functions for DB access
- Server functions execute server-only → safe for `process.env`, DB connections
- Query invalidation: Use `queryClient.invalidateQueries()` after mutations
- Initial data: Loader data → `initialData` in `useQuery` for SSR hydration


## Minimum Edit Distance (Levenstein Distance)

### Alignment w Whisper 

## Kiel Convention

## CMUDict:

[Link](http://www.speech.cs.cmu.edu/cgi-bin/cmudict?in=nonce)

## PostgreSQL Database

Supports UTF-8 encoding. -> IPA symbols (ð, ɝ, æ, ŋ, ɹ, ɜ˞, etc.) are tested and working.