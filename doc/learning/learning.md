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
- **Tool:** Wav2Vec 2.0 / Allosaurus
- **Output:** Phonetic IPA transcription

**Step 2: Alignment**
- **Tool:** Montreal Forced Aligner (MFA)
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

**1. User Upload**
- User uploads audio file

**2. Storage Layer**
- **Action:** Store FLAC in S3
- **Purpose:** Long-term storage (S3/filesystem)

**3. Database Layer**
- **Action:** Store path + metadata in database
- **Purpose:** Metadata only

**4. Processing Layer**
- **Action:** Convert to WAV (16kHz mono)
- **Purpose:** Temporary, can be cached

**5. ML Pipeline**
- Process the converted audio through ML models

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

### Phonetic Transcription Models
- [PAST](https://github.com/lizhen18THU/PAST)
- [Wav2Vec 2.0](https://huggingface.co/blog/fine-tune-wav2vec2-english)
- [MultIPA](https://github.com/ctaguchi/multipa?tab=readme-ov-file)

### Alignment Tools
- Align Voice recording with IPA transcription → [MFA](https://montreal-forced-aligner.readthedocs.io/en/latest/index.html)
