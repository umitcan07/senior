# Nounce Project Presentation Scripts

## 3-Minute Short Pitch
**Target Audience:** General Engineering / Customer / High-level Overview
**Goal:** Explain the *What*, *Why*, and *How* briefly.

---

**(0:00 - 0:45) Introduction & Problem**
"Hello everyone, I'm Ümit Can Evleksiz, and this is **Nounce**, a modern pronunciation assessment platform.
Learning proper English pronunciation is challenging, especially for self-directed learners who lack constant access to native speakers or tutors. Existing tools effectively focus on *vocabulary* or *grammar*, but feedback on **phonetics**—the actual sounds of speech—is often missing or generic."

**(0:45 - 1:30) The Solution: Nounce**
"Nounce solves this by providing precise, phonetic-level feedback.
The application allows users to verify their pronunciation against standard acoustic models.
Here’s how it works: detailed **IPA (International Phonetic Alphabet)** mappings break down every word you speak.
If you mispronounce a vowel or substitute a consonant, the system detects it and visually highlights the error. It's not just a 'Pass/Fail'; it shows you *exactly* which sound was incorrect and how to fix it."

**(1:30 - 2:30) Technology & Architecture**
"Under the hood, Nounce is a robust full-stack application.
On the **Frontend**, we use **React** with TanStack Start for a fast, responsive experience.
The **Backend** leverages **Python** for machine learning services, deployed on **RunPod** serverless GPU infrastructure.
We use open-source models like **POWSM** for phonetic transcription, enabling us to adapt specific models for different native language backgrounds, starting with Turkish speakers.
This separation of concerns—fast UI vs. heavy ML processing—ensures the app remains responsive even during complex analysis."

**(2:30 - 3:00) Conclusion**
"In summary, Nounce bridges the gap between self-study and professional tutoring. By combining advanced signal processing with a user-friendly web interface, we empower learners to master English phonology confidently. Thank you."

---
---

## 10-Minute Technical Deep Dive
**Target Audience:** Engineering Team / Technical Judges
**Goal:** Thorough explanation of implementation, models, stack, and features.

---

**(0:00 - 1:30) Detailed Introduction**
"Good morning/afternoon. My name is Ümit Can Evleksiz.
Today I will present **Nounce**, A web-based English pronunciation assessment tool.
The core problem we address is the **'Feedback Loop'** in language learning. When you practice alone, you don't know if you're saying it right.
Nounce provides that missing feedback loop using signal processing and deep learning. It’s designed specifically for the phonetic nuances of English, initially optimized for Turkish native speakers."

**(1:30 - 3:30) Methodology: The ML Pipeline**
"Let's dive into the core methodology.
The heart of our system is the **Signal Processing Pipeline**.
1.  **Input**: We capture audio directly from the browser (WebM) and convert it to 16kHz WAV format.
2.  **Phonetic Transcription**: Unlike standard Speech-to-Text which gives you *words*, we need *phonemes*. We utilize **POWSM (Phonetic Open Whisper-Style Speech Model)**. This model is specifically fine-tuned to recognize phonetic symbols (IPA).
3.  **Alignment**: We use techniques similar to the **Montreal Forced Aligner (MFA)** to align these phonemes with time boundaries in the audio. This lets us point to a specific millisecond where an error occurred.
4.  **Comparision**: We compare the user's produced IPA sequence against a 'Target' canonical pronunciation using **Levenshtein Edit Distance**. This classifies errors into Substitutions, Insertions, or Deletions."

**(3:30 - 5:30) System Architecture (Full Stack)**
"This isn't just a model in a notebook; it's a production-ready web application organized as a monorepo.
*   **The Application Layer (`app/`)**: Built with **React 19** and **TanStack Start**. This gives us Server-Side Rendering (SSR) for performance and SEO. We use **Shadcn UI** and **Tailwind CSS** for a premium, accessible design.
*   **The Database**: We use **Neon Serverless PostgreSQL** with **Drizzle ORM**. This ensures type safety from the database query all the way to the React component.
*   **The Model Layer (`mod/`)**: The heavy lifting happens here. We deploy Python services as Docker containers on **RunPod**. This serverless GPU architecture allows us to run inference only when needed, keeping costs low while maintaining high performance."

**(5:30 - 7:30) User & Admin Features**
"Let's look at the features we've implemented.
*   **For Learners**:
    *   **Interactive Recorder**: Real-time waveform visualization ensures the user knows their mic is working.
    *   **Feedback UI**: After analysis, users see their sentence with color-coded phonemes. Clicking a red phoneme reveals the error (e.g., 'You said /d/ instead of /t/').
    *   **Progress Tracking**: Sessions are saved, allowing users to revisit past attempts.
*   **For Admins**:
    *   We built a comprehensive dashboard to manage the learning content.
    *   Admins can create 'Practice Texts' and define custom target pronunciations if the dictionary default isn't suitable."

**(7:30 - 9:00) Challenges & Solutions**
"This project came with significant technical challenges:
1.  **Real-time Latency**: Audio processing is heavy. We solved this by using asynchronous job queues. The UI updates instantly to 'Processing' state, and the result is pushed when the GPU is done.
2.  **Browser Audio Compatibility**: Browsers record in varied formats. We implemented robust audio conversion logic in the backend to normalize everything to standard formats expected by our ML models.
3.  **Accent Bias**: Standard models are biased towards native speakers. By choosing open models like POWSM, we paved the way for fine-tuning on non-native datasets in the future."

**(9:00 - 10:00) Conclusion & Future Work**
"Nounce stands as a modern solution to an age-old problem. It combines the latest in web development patterns with specialized speech AI.
Moving forward, we plan to implement fully real-time streaming feedback and expand support to other target languages.
Thank you for listening. I'm happy to take any questions."
