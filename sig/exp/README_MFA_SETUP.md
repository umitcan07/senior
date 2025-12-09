# MFA Setup for Pronunciation Assessment Demo

## Current Status

- ✅ MFA Python package installed in venv (`sig/exp/.venv`)
- ❌ Kaldi/kalpy missing (requires conda installation)

## The Issue

MFA requires **Kaldi** and **kalpy** (Python bindings for Kaldi), which are only available as conda packages, not via pip. The MFA Python package is installed, but it cannot run without these dependencies.

## Solutions

### Option 1: Use Conda Environment (Recommended)

Since you already have MFA working in your conda shell, the easiest solution is to use conda for the entire workflow:

```bash
# Activate your conda environment with MFA
conda activate aligner

# Install other dependencies
pip install espnet2 torch soundfile librosa numpy

# Run the notebook from conda environment
jupyter notebook pronunciation_assessment_demo.ipynb
```

### Option 2: Hybrid Approach (Conda + Venv)

Keep using the venv for most packages, but use conda MFA via subprocess:

1. Make sure your conda environment with MFA is activated or in PATH
2. The notebook will detect MFA via the `mfa` command
3. MFA alignment will work via subprocess calls

```bash
# In your conda shell (where MFA works)
conda activate aligner

# Then in your venv (for other packages)
cd sig/exp
source .venv/bin/activate
jupyter notebook pronunciation_assessment_demo.ipynb
```

### Option 3: Create New Conda Environment with Everything

Create a conda environment that has both MFA and Python packages:

```bash
# Create conda environment with MFA
conda create -n pronunciation -c conda-forge montreal-forced-aligner python=3.13

# Activate it
conda activate pronunciation

# Install other Python packages
pip install espnet2 torch soundfile librosa numpy jupyter

# Run notebook
jupyter notebook pronunciation_assessment_demo.ipynb
```

## How the Notebook Handles This

The notebook has been updated to:
- Check for MFA via the `mfa` command (not Python import)
- Work even if MFA Python package import fails
- Use subprocess to call MFA commands
- Provide helpful error messages if MFA is not available

## Testing MFA Availability

To test if MFA is available in your current environment:

```bash
mfa --version
```

If this works, the notebook will be able to use MFA for alignment.

## Downloading MFA Models

Once MFA is working, download the required models:

```bash
mfa model download dictionary english_us_mfa
mfa model download acoustic english_mfa
```

These models are needed for the alignment step in the notebook.

