# Project Plan & Roadmap

This page outlines the timeline, milestones, and strategic direction of the **Nounce** project.

## Project Timeline (Spring 2026)
- **Start Date**: February 9, 2026
- **Midterm Report**: March 30, 2026
- **Final Presentation**: June 11, 2026

## Project Roadmap

```mermaid
gantt
    title Nounce Development Roadmap (Spring 2026)
    dateFormat  YYYY-MM-DD
    section Research & Setup
    Introduction & Repo Walkthrough :done, w1, 2026-02-09, 2026-02-15
    Local Env Setup (Docker/RunPod) :done, w1_setup, 2026-02-09, 2026-02-15
    ML Architecture Investigation :done, w2, 2026-02-16, 2026-02-22
    Initial Script Runnings :done, w2_script, 2026-02-16, 2026-02-22
    CORPTES Dataset Meeting :done, w3, 2026-02-23, 2026-03-01
    Data Preprocessing & Evaluation :done, w3_data, 2026-02-23, 2026-03-01
    
    section Comparative Analysis
    POWSM vs POWSM-CTC Comparison :active, w4_ml, 2026-03-02, 2026-03-15
    CORPTES Integration & Validation :w5_data, 2026-03-16, 2026-03-30
    Midterm Report :milestone, mid_rep, 2026-03-30, 2d
    
    section Implementation
    Spectrogram & Pitch Prototype :w6_ui, 2026-03-31, 2026-04-15
    Alignment Issue Fixes :w7_align, 2026-04-16, 2026-04-30
    Praat-like Interface Implementation :w8_int, 2026-05-01, 2026-05-15
    
    section Finalization
    UI/UX Polish :w9_ui, 2026-05-16, 2026-05-31
    Final Report & Poster Prep :w10_fin, 2026-06-01, 2026-06-11
    Final Poster Presentation :milestone, final_rep, 2026-06-11, 1d
```

## Major Milestones

### 1. Midterm Focus (March 30, 2026)
The primary goal for the midterm is to complete the comparative analysis between **POWSM** and **POWSM-CTC** models. We also aim to successfully validate and integrate the **CORPTES** dataset from Eskişehir Technical University to improve our Turkish-native speaker assessment capabilities.

### 2. Implementation Phase (April - May 2026)
Post-midterm, we will focus on building more advanced interfaces for phonetic analysis. This includes:
- **Praat-like Visualizations**: Spectrograms and pitch contours.
- **Exakt-like Tools**: Fine-grained phonetic alignment and manual review interfaces.
- **Alignment Fixes**: Improving the forced alignment (MFA) to ensure accurate phoneme-to-audio synchronization.

### 3. Final Goal (June 11, 2026)
A production-ready full-stack application providing phonetic assessment for Turkish-native English speakers, presented in a final poster session at Boğaziçi University.
