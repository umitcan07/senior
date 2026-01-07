# Nonce Project Poster Specification

**Poster Size:** A0 (Horizontal Orientation)
**Estimated Word Count:** ~500 words
**Design Style:** Clean, grid-based layout. Light background, dark text for high contrast.

---

## 1. Header Section (Top Full Width)

*   **Title:** Nonce: Pronunciation Assessment System for English Language Learners
*   **Author:** Ümit Can Evleksiz
*   **Advisors:** Prof. Lale Akarun, Prof. Murat Saraçlar
*   **Affiliation:** Boğaziçi University, Department of Computer Engineering
*   **Logos:** [Boğaziçi University Logo] (Left), [Nonce App Logo] (Right)

---

## 2. Introduction & Objective (Left Column)

**Problem:**
Language learners practicing alone often lack immediate, specific feedback on their pronunciation. Traditional tools focus on vocabulary, neglecting phonetic accuracy.

**Objective:**
To develop a web-based platform that provides:
*   Real-time, phoneme-level pronunciation assessment.
*   Visual feedback on specific articulation errors (e.g., substituting /θ/ with /t/).
*   Accessible learning for self-directed students.

---

## 3. Methodology (Left/Center Column)

**Signal Processing Pipeline:**
[GRAPHIC PLACEHOLDER: Flowchart showing Audio Input -> POWSM -> IPA Transcription -> MFA Alignment -> Edit Distance -> Error Output]

*   **Phonetic Transcription:** Utilizes **POWSM** (Phonetic Open Whisper-Style Speech Model) to convert audio to International Phonetic Alphabet (IPA) sequences.
*   **Comparison Algorithm:** Aligns user speech with target IPA using **Levenshtein Edit Distance**.
*   **Error Classification:**
    *   **Substitution:** Wrong sound used (e.g., /s/ for /z/)
    *   **Deletion:** Sound skipped
    *   **Insertion:** Extra sound added

---

## 4. System Architecture (Center Column)

**Full-Stack Implementation:**
[GRAPHIC PLACEHOLDER: System Architecture Diagram from Report (Fig 305)]

*   **Frontend:** React 19, TanStack Start, Tailwind CSS (Responsive Web App).
*   **Backend:** Python Services on RunPod (Serverless GPU).
*   **Database:** Neon Serverless PostgreSQL + Drizzle ORM.
*   **Infrastructure:** Dockerized services for consistent deployment.

---

## 5. Key Features (Right Column)

**Interactive Feedback:**
[GRAPHIC PLACEHOLDER: Screenshot of the Assessment Result Page showing red/green phonemes]
*   Visualizes errors directly on the IPA sequence.
*   Detailed breakdown of mispronounced phonemes.

**User & Admin Tools:**
[GRAPHIC PLACEHOLDER: Screenshot of Recording Interface or Dashboard]
*   **Recording Studio:** Real-time waveform feedback.
*   **Progress Tracking:** Historical data of past attempts.
*   **Content Management:** Admin dashboard to curate practice texts and target pronunciations.

---

## 6. Impact & Future Work (Bottom Right)

**Impact:**
*   Democratizes access to high-quality pronunciation coaching.
*   Demonstrates effective use of open-source speech models in educational tech.

**Future Work:**
*   Real-time streaming feedback.
*   Support for multiple accents and languages.
*   Native mobile application.

---

## 7. Acknowledgments (Footer)
Special thanks to my advisors and the open-source community (POWSM, MFA, TanStack).
*Supported by Boğaziçi University CmpE Department.*
