# Nonce: English Pronunciation Assessment Platform


**Nonce** is an advanced, web-based English pronunciation assessment tool that helps language learners improve their pronunciation through automated speech analysis and personalized feedback. The system enables users to record speech, receive detailed pronunciation assessments at the phonetic level, and gain insights into English phonology.

![Nonce Project Cover Image](app/public/og-image.png)

> **Author**: Ümit Can Evleksiz  
> **Advisors**: Lale Akarun, Murat Saraçlar
> **Institution**: Boğaziçi University, Computer Engineering  
> **Project Type**: Senior Project

---

## Project Overview

Nonce combines signal processing and machine learning to provide pronunciation feedback. The system focuses on English with US accent (potentially including UK), with initial development targeting Turkish-native English speakers.

### Core Functionality

- **Speech Recording**: Capture and process user speech recordings through a web interface
- **Phonetic Analysis**: Analyze pronunciation accuracy at the phonetic level using machine learning models
- **Target Comparison**: Compare actual pronunciation against target acoustic patterns
- **Educational Feedback**: Provide detailed guidance on English phonology and pronunciation errors

---

## Architecture

The project is organized as a monorepo with the following components:

### **`app/`** - Full-Stack Web Application
Modern web application built with:
- **Frontend**: TanStack Start (React), TanStack Router, TanStack Query
- **Styling**: Tailwind CSS with Shadcn UI components
- **Authentication**: Clerk
- **Database**: Neon Serverless PostgreSQL with Drizzle ORM
- **Storage**: AWS S3 (Cloudflare R2) for audio files
- **Deployment**: Docker-ready with Nitro v2

**Features**:
- User authentication and session management
- Text management (CRUD operations)
- Audio recording interface
- Pronunciation practice workflow
- Real-time feedback display

See [`app/README.md`](app/README.md) for detailed setup and development instructions.

### **`mod/`** - Backend ML Services (RunPod Endpoints)
Two separate serverless endpoints deployed on RunPod:

1. **Assessment Endpoint** (`mod/assessment/`)
   - Evaluates pronunciation by comparing user audio to target IPA
   - Returns detailed error analysis (substitutions, insertions, deletions)
   - Provides pronunciation scores and timestamps

2. **IPA Generation Endpoint** (`mod/ipa_generation/`)
   - Generates IPA transcription from English text
   - Optional audio input for improved accuracy
   - Uses POWSM (Phonetic Word Segmentation Model) for phonetic transcription

Both endpoints are containerized and deployed as separate Docker images.

See [`mod/README.md`](mod/README.md) for API documentation and deployment details.

### **`sig/exp/`** - Signal Processing Experiments
Jupyter notebooks for research and experimentation:
- **POWSM Integration**: Testing and evaluating phonetic word segmentation
- **MFA (Montreal Forced Aligner)**: Phoneme alignment experiments
- **G2P (Grapheme-to-Phoneme)**: Text-to-IPA conversion research
- **Audio Analysis**: Signal processing and feature extraction

### **`doc/`** - Documentation
- **`report/`**: Academic report and system design documentation
- **`runpod/`**: RunPod deployment guides and API documentation
- **`learning/`**: Research notes and learning materials
- **`mfa/`**: MFA documentation and reference materials

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and **pnpm**
- **Docker** and **Docker Compose** (for containerized deployment)
- **Python** 3.9+ (for backend services)
- **Neon PostgreSQL** account (or local PostgreSQL)
- **Clerk** account (for authentication)
- **AWS S3** or **Cloudflare R2** (for audio storage)

---

## Current Status

### Completed

- [x] Web application foundation with TanStack Start
- [x] User authentication with Clerk
- [x] Database schema and ORM setup (Drizzle + Neon PostgreSQL)
- [x] Text management system (CRUD operations)
- [x] Audio recording interface
- [x] RunPod endpoint structure for assessment and IPA generation
- [x] Edit distance algorithm for phoneme comparison
- [x] Unit tests for core assessment logic
- [x] Docker containerization for all services
- [x] Signal processing experiments with POWSM and MFA
- [ ] Integration of POWSM model for actual IPA generation (currently using placeholder)
- [ ] MFA integration for precise phoneme alignment
- [ ] Real-time pronunciation assessment with actual ML models
- [ ] UI improvements for recording and feedback display
- [ ] Reference speech playback functionality
- [ ] Database tables for recording results

### Research

Active research areas (see [`meeting.md`](meeting.md) for details):

- **POWSM vs G2P**: Evaluating bias in grapheme-to-phoneme conversion
- **ASR Context**: Understanding how ASR models consider sentence context
- **MFA Alignment**: Exploring grapheme vs phoneme alignment precision
- **Pronunciation Reference**: Comparing CMUdict, G2P, and TTS-generated references
- **Dialect Variation**: Supporting multiple English dialects and IPA variations

---

## Repository Structure

```
senior/
├── app/                    # Full-stack web application
├── mod/                    # Backend ML services
├── sig/exp/                # Signal processing notebooks and experiments
├── doc/                    # Documentation, learning materials, meeting notes, todo list
├── meeting.md              # Meeting notes and research questions
├── todo.md                 # Current task list
└── README.md               # This file
```

---

## Technology Stack

### Frontend
- **React 19** with **TanStack Start** (SSR framework)
- **TanStack Router** (file-based routing)
- **TanStack Query** (data fetching)
- **TanStack Form** (form management)
- **Tailwind CSS** + **Shadcn UI** (styling)
- **Zustand** (client state management)

### Backend
- **Python 3.9+** (ML services)
- **RunPod** (serverless GPU inference)
- **Docker** (containerization)

### Database & Storage
- **Neon PostgreSQL** (serverless database)
- **Drizzle ORM** (type-safe database access)
- **AWS S3 / Cloudflare R2** (audio file storage)

### ML/AI Models
- **POWSM** (Phonetic Word Segmentation Model)
- **MFA** (Montreal Forced Aligner)
- **G2P** (Grapheme-to-Phoneme conversion)

### DevOps
- **Docker Compose** (local development)
- **Biome** (linting and formatting)
- **Vitest** (testing)

---

## Documentation

- **[App Documentation](app/README.md)**: Detailed setup, database, and development guide
- **[Backend API Documentation](mod/README.md)**: Endpoint specifications and deployment
- **[Meeting Notes](meeting.md)**: Research questions and discussions
- **[Todo List](todo.md)**: Current tasks and priorities
- **[RunPod Deployment](doc/runpod/)**: Deployment guides and API documentation
- **[Academic Report](doc/report/)**: System design and project documentation

---

## Testing

```bash
# Backend tests
cd mod/
python -m unittest discover -s tests -v

# Frontend tests (when implemented)
cd app/
pnpm test
```

---

## License

See [LICENSE](license) file for details.

---

## Contributing

This is an academic senior project. For questions or collaboration, please contact the author.

---

## Citations

If you use this work or the underlying models, please cite the following papers:

```bibtex
@article{powsm,
  title={POWSM: A Phonetic Open Whisper-Style Speech Foundation Model},
  author={Chin-Jou Li and Kalvin Chang and Shikhar Bharadwaj and Eunjung Yeo and Kwanghee Choi and Jian Zhu and David Mortensen and Shinji Watanabe},
  year={2025},
  eprint={2510.24992},
  archivePrefix={arXiv},
  primaryClass={cs.CL},
  url={https://arxiv.org/abs/2510.24992},
}

@inproceedings{zhu-etal-2025-zipa,
  title = "{ZIPA}: A family of efficient models for multilingual phone recognition",
  author = "Zhu, Jian  and  Samir, Farhan  and  Chodroff, Eleanor  and  Mortensen, David R.",
  booktitle = "Proceedings of the 63rd Annual Meeting of the Association for Computational Linguistics (Volume 1: Long Papers)",
  month = jul,
  year = "2025",
  publisher = "Association for Computational Linguistics",
  url = "https://aclanthology.org/2025.acl-long.961/",
}
```

---

## Acknowledgments

- **POWSM**: Phonetic Word Segmentation Model
- **Montreal Forced Aligner (MFA)**: Forced alignment toolkit
- **TanStack**: Modern React framework ecosystem
- **Neon**: Serverless PostgreSQL platform
- **RunPod**: GPU cloud infrastructure

---

**Last Updated**: December 2025
