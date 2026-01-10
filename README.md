# Nounce (Nounce.pro): English Pronunciation Assessment Platform


**Nounce** is an advanced, web-based English pronunciation assessment tool that helps language learners improve their pronunciation through automated speech analysis and personalized feedback. The system enables users to record speech, receive detailed pronunciation assessments at the phonetic level, and gain insights into English phonology.

![Nounce Project Cover Image](app/public/og-image.png)

> **Author**: Ümit Can Evleksiz  
> **Advisors**: Lale Akarun, Murat Saraçlar
> **Institution**: Boğaziçi University, Computer Engineering  
> **Project Type**: Senior Project

---

## Project Overview

Nounce combines signal processing and machine learning to provide pronunciation feedback. The system focuses on English with US accent (potentially including UK), with initial development targeting Turkish-native English speakers.

### Core Functionality

- **Speech Recording**: Capture and process user speech recordings through a web interface
- **Phonetic Analysis**: Analyze pronunciation accuracy at the phonetic level using machine learning models
- **Target Comparison**: Compare actual pronunciation against target acoustic patterns
- **Educational Feedback**: Provide detailed guidance on English phonology and pronunciation errors

---

## Architecture

The project is organized as a monorepo:

### **`app/`** - Full-Stack Web Application
Modern web application built with **TanStack Start**, **React**, **Tailwind CSS**, **Clerk** (Auth), **Neon PostgreSQL**, and **AWS S3/R2**.

See [`app/README.md`](app/README.md) for detailed setup and development instructions.

### **`mod/`** - Backend ML Services
Serverless endpoints deployed on RunPod for **Assessment** and **IPA Generation**.

See [`mod/README.md`](mod/README.md) for API documentation and deployment details.

### **`sig/exp/`** - Signal Processing
Jupyter notebooks for research (POWSM, MFA, G2P).

### **`doc/`** - Documentation
Reports, deployment guides, and learning materials.

---

## Quick Start

### Prerequisites
- Node.js 18+ & pnpm
- Docker & Docker Compose
- Python 3.9+
- Neon PostgreSQL, Clerk, Cloudflare R2 accounts

---

## License

See [LICENSE](license) file for details.

---

## Contributing

This is an academic senior project. For questions or collaboration, please contact Ümit Can Evleksiz (umit.evleksiz@std.bogazici.edu.tr).

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

- **POWSM**, **MFA**, **TanStack**, **Neon**, **RunPod**, **Clerk**, **Cloudflare**, **Fly.io**

