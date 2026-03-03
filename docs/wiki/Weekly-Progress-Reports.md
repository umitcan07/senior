# Weekly Progress Reports

This page tracks our progress week-by-week.

## Week 1: Orientation and Setup (Feb 9 - Feb 15)
- **Repo Walkthrough**: Ümitcan provided an initial walkthrough of the monorepo structure and shared key insights into the current implementation.
- **Environment Configuration**: 
  - Successfully configured the local development environment.
  - Set up the **RunPod serverless simulator** via Docker and Python.
  - Verified local database connection to the **Neon PostgreSQL** cluster.

## Week 2: Exploration and Initial Scripting (Feb 16 - Feb 22)
- **ML Investigation**: Investigated the **POWSM** architecture, focusing on the differences between **Phone Recognition (PR)** and **Grapheme-to-Phoneme (G2P)** models.
- **Initial Script Runnings**: Ran initial scripts for audio conversion and model inference to understand the pipeline.
- **Dataset Inspection**: 
  - Began reviewing the **L2-ARCTIC** and **TIMIT** datasets for suitability in Turkish-native speaker assessment.
  - Performed compatibility checks with current audio preprocessing scripts.

## Week 3: Dataset Acquisition and Preprocessing (Feb 23 - Mar 1)
- **CORPTES Meeting**: Met with researchers from **Eskişehir Technical University** regarding the **CORPTES** dataset, which is specifically designed for Turkish-native English speakers.
- **Data Preprocessing Experiments**: 
  - Experimented with audio normalization and resampling for the new dataset samples.
  - Conducted initial evaluation of transcription quality using current models on Turkish L1 speakers.
- **Feature Outlining**: Started outlining the requirements for "Praat-like" visualizations in the frontend.

## Week 4: Comparative Analysis and UI Prototyping (Mar 2 - Mar 8) [Planned]
- **Model Comparison**: Conduct a side-by-side comparison between **POWSM** and **POWSM-CTC** on our target dataset to measure performance and accuracy.
- **UI Prototyping**: 
  - Prototyping spectrogram and pitch contour visualizations using **Wavesurfer.js**.
  - Designing the interface for fine-grained phoneme alignment and manual correction.
