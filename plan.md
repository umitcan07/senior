# POWSM LoRA Fine-tuning for Turkish Phone Recognition

## Context

POWSM (`espnet/powsm`, 350M params) already produces "decent but not great" Turkish phone recognition. The goal is to improve PR accuracy on Turkish by fine-tuning with LoRA adapters on 60 Turkish recordings (~11 hours total). We avoid full fine-tuning to prevent catastrophic forgetting of POWSM's multilingual knowledge.

**Approach:** LoRA via PEFT library applied to POWSM's underlying PyTorch modules, loaded through ESPnet's Python API. Training runs in Google Colab (T4/A100) via the VS Code Colab extension. This extends the existing notebook pattern in `sig/exp/powsm.ipynb`.

**Data:**
- `C:\Users\faruq\Downloads\senior\task-1\` — 30 × ~2 min recordings (S1T1–S30T1), WAV + TextGrid
- `C:\Users\faruq\Downloads\senior\task-2\` — 30 × ~20 min recordings (S1T2–S30T2), WAV + TextGrid
- TextGrid tiers: phone tier (IPA) + word tier (Turkish orthography)
- `textgrid` Python library already installed in `sig/environment.yml`

**Reuse from existing codebase:**
- `mod/assessment/edit_distance.py` — `edit_operations()` for PER computation
- `sig/exp/powsm.ipynb` — existing ESPnet loading pattern (`Speech2Text.from_pretrained`)
- Audio preprocessing pattern from `sig/exp/powsm.ipynb` (librosa resample + 20s pad/trim)

---

## Step 1 — Inspect TextGrid Tier Names

Before data prep, verify exact tier names in the TextGrid files (phone tier may be named "IPA", "phones", "MAU", etc.).

```python
import textgrid
tg = textgrid.TextGrid.fromFile("path/to/S1T1.TextGrid")
for tier in tg:
    print(tier.name, tier.__class__.__name__)
```

Adjust `PHONE_TIER_NAME` and `WORD_TIER_NAME` constants in the data prep notebook accordingly.

---

## Step 2 — Data Preparation Notebook

**File:** `sig/exp/01_data_prep_turkish.ipynb`  
**Runs locally** (no GPU needed). Output goes to `sig/exp/data/turkish_chunks/`.

### 2a. Parse TextGrid + chunk into 20s segments

```python
import textgrid, librosa, soundfile as sf, numpy as np, json
from pathlib import Path

PHONE_TIER_NAME = "MAU"       # adjust after Step 1
DATA_DIRS = {
    "task1": Path(r"C:\Users\faruq\Downloads\senior\task-1"),
    "task2": Path(r"C:\Users\faruq\Downloads\senior\task-2"),
}
OUT_DIR = Path("data/turkish_chunks")
OUT_DIR.mkdir(parents=True, exist_ok=True)
CHUNK_DUR = 20.0
SR = 16000

def chunk_recording(wav_path, tg_path, speaker, task):
    audio, _ = librosa.load(str(wav_path), sr=SR, mono=True)
    tg = textgrid.TextGrid.fromFile(str(tg_path))
    phone_tier = next(t for t in tg if t.name == PHONE_TIER_NAME)

    chunks = []
    start = 0.0
    while start < len(audio) / SR:
        end = min(start + CHUNK_DUR, len(audio) / SR)
        phones = [
            iv.mark.strip() for iv in phone_tier
            if iv.minTime >= start and iv.maxTime <= end
            and iv.mark.strip() not in ("", "sp", "sil", "SIL", "<p:>")
        ]
        if phones:
            a = audio[int(start * SR):int(end * SR)]
            a = np.pad(a, (0, max(0, int(CHUNK_DUR * SR) - len(a))))
            chunk_id = f"{speaker}_{task}_{int(start):04d}"
            sf.write(OUT_DIR / f"{chunk_id}.wav", a, SR, subtype="PCM_16")
            chunks.append({"id": chunk_id, "speaker": speaker,
                           "task": task, "phones": phones})
        start += CHUNK_DUR
    return chunks

manifest = []
for task, d in DATA_DIRS.items():
    for wav in sorted(d.glob("*.wav")):
        tg = wav.with_suffix(".TextGrid")
        speaker = wav.stem  # e.g. "S1T1" -> use wav.stem
        manifest += chunk_recording(wav, tg, wav.stem, task)

with open(OUT_DIR / "manifest.json", "w") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
print(f"Total chunks: {len(manifest)}")
```

Expected output: ~180 chunks from task-1, ~1800 from task-2 = ~1980 total.

### 2b. Speaker split (no leakage)

Speakers S1–S16 (both tasks) → **train**  
Speakers S17–S18 → **val**  
Speakers S19–S20 → **test**

```python
def speaker_num(chunk):
    # S1T1 -> 1, S20T2 -> 20
    import re
    return int(re.search(r"S(\d+)", chunk["speaker"]).group(1))

train = [c for c in manifest if speaker_num(c) <= 16]
val   = [c for c in manifest if speaker_num(c) in (17, 18)]
test  = [c for c in manifest if speaker_num(c) in (19, 20)]

for split, data in [("train", train), ("val", val), ("test", test)]:
    with open(OUT_DIR / f"{split}.json", "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"{split}: {len(data)} chunks")
```

### 2c. Phone normalization

POWSM encodes each phone as a special token wrapped in slashes: `/p//ɛ//r//ʃ//i/`. The phones in your TextGrid may include diacritics/compound symbols that need to match POWSM's vocabulary exactly. 

After loading POWSM in Step 3, run:
```python
vocab = set(s2t.converter.token2id.keys())
tg_phones = set(p for c in manifest for p in c["phones"])
unknown = tg_phones - {p.strip("/") for p in vocab if p.startswith("/")}
print("Phones not in POWSM vocab:", unknown)
```
Map any unknown phones to the nearest PanPhon entry. Log all mappings in a `phone_map.json` file.

---

## Step 3 — Upload to Google Drive

Upload `sig/exp/data/turkish_chunks/` to Google Drive under `MyDrive/senior/turkish_chunks/`.  
This folder contains: all `.wav` chunk files + `train.json`, `val.json`, `test.json`.

---

## Step 4 — LoRA Fine-tuning Notebook (Colab)

**File:** `sig/exp/02_finetune_lora.ipynb`  
**Runs on Colab** (T4 or A100). Connect via VS Code Colab extension.

### 4a. Colab setup cell

```python
!pip install -q espnet espnet-model-zoo peft soundfile
from google.colab import drive
drive.mount("/content/drive")
DATA_DIR = "/content/drive/MyDrive/senior/turkish_chunks"
```

### 4b. Load POWSM and inspect LoRA targets

```python
from espnet2.bin.s2t_inference import Speech2Text
import torch

s2t = Speech2Text.from_pretrained("espnet/powsm", device="cuda",
                                   lang_sym="<unk>", task_sym="<pr>")
model = s2t.s2t_model.to("cuda")

# Inspect linear layer names (run once, then set target_modules)
linear_names = [n for n, m in model.named_modules()
                if isinstance(m, torch.nn.Linear)]
print(linear_names[:20])  # identify attention projection names
```

Expected ESPnet Whisper attention names: `encoder.encoders.0.self_attn.linear_q` etc.  
Target pattern: `linear_q`, `linear_k`, `linear_v`, `linear_out` (encoder + decoder self/cross-attn).

### 4c. Apply LoRA

```python
from peft import LoraConfig, get_peft_model

lora_cfg = LoraConfig(
    r=8,
    lora_alpha=16,
    target_modules=["linear_q", "linear_k", "linear_v", "linear_out"],
    lora_dropout=0.1,
    bias="none",
)
model = get_peft_model(model, lora_cfg)
model.print_trainable_parameters()
# Expected: ~1-3% of total params trainable
```

### 4d. Dataset and DataLoader

```python
import json, soundfile as sf, numpy as np
from torch.utils.data import Dataset, DataLoader

class TurkishPRDataset(Dataset):
    def __init__(self, manifest_path):
        self.items = json.load(open(manifest_path))
        self.tokenizer = s2t.tokenizer
        self.converter = s2t.converter

    def __len__(self): return len(self.items)

    def __getitem__(self, idx):
        item = self.items[idx]
        audio, _ = sf.read(f"{DATA_DIR}/{item['id']}.wav")
        audio = torch.tensor(audio, dtype=torch.float32)

        # Build target token sequence: <unk><pr><notimestamps> /p//ɛ//r/...
        phone_str = "".join(f"/{p}/" for p in item["phones"])
        text = f"<unk><pr><notimestamps> {phone_str}"
        tokens = self.converter.tokens2ids(self.tokenizer.text2tokens(text))
        return audio, torch.tensor(tokens, dtype=torch.long)

def collate(batch):
    audios, labels = zip(*batch)
    audio_t = torch.stack(audios)  # all already 20s = 320000 samples
    max_l = max(l.size(0) for l in labels)
    label_t = torch.full((len(labels), max_l), -100, dtype=torch.long)
    for i, l in enumerate(labels): label_t[i, :l.size(0)] = l
    return audio_t, label_t

train_ds = TurkishPRDataset(f"{DATA_DIR}/train.json")
val_ds   = TurkishPRDataset(f"{DATA_DIR}/val.json")
train_dl = DataLoader(train_ds, batch_size=8, shuffle=True, collate_fn=collate)
val_dl   = DataLoader(val_ds,   batch_size=8, shuffle=False, collate_fn=collate)
```

### 4e. Training loop

```python
from torch.optim import AdamW
from torch.optim.lr_scheduler import OneCycleLR

optimizer = AdamW(filter(lambda p: p.requires_grad, model.parameters()),
                  lr=1e-4, weight_decay=0.01)
scheduler = OneCycleLR(optimizer, max_lr=1e-4,
                        steps_per_epoch=len(train_dl), epochs=15)

CKPT_DIR = "/content/drive/MyDrive/senior/lora_checkpoints"

best_val_loss = float("inf")
for epoch in range(15):
    model.train()
    for audio, labels in train_dl:
        audio  = audio.to("cuda")
        labels = labels.to("cuda")
        lengths = torch.full((len(audio),), audio.size(1), device="cuda")
        label_lens = (labels != -100).sum(dim=1)

        loss, *_ = model(speech=audio, speech_lengths=lengths,
                         text=labels, text_lengths=label_lens)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
        optimizer.step(); scheduler.step(); optimizer.zero_grad()

    # Validation
    model.eval()
    val_losses = []
    with torch.no_grad():
        for audio, labels in val_dl:
            audio = audio.to("cuda"); labels = labels.to("cuda")
            lengths = torch.full((len(audio),), audio.size(1), device="cuda")
            label_lens = (labels != -100).sum(dim=1)
            loss, *_ = model(speech=audio, speech_lengths=lengths,
                             text=labels, text_lengths=label_lens)
            val_losses.append(loss.item())
    val_loss = sum(val_losses) / len(val_losses)
    print(f"Epoch {epoch+1} | val_loss={val_loss:.4f}")

    if val_loss < best_val_loss:
        best_val_loss = val_loss
        model.save_pretrained(f"{CKPT_DIR}/best")
        print("  → saved best checkpoint")
```

---

## Step 5 — Evaluation Notebook

**File:** `sig/exp/03_eval_lora.ipynb`  
Runs locally or in Colab. Compares fine-tuned vs. baseline.

```python
import sys
sys.path.insert(0, "../../mod")
from assessment.edit_distance import edit_operations  # reuse existing!
from peft import PeftModel

# Load base POWSM + LoRA adapter
s2t_base = Speech2Text.from_pretrained("espnet/powsm", device="cpu",
                                        lang_sym="<unk>", task_sym="<pr>")
base_model = s2t_base.s2t_model
lora_model = PeftModel.from_pretrained(base_model, "path/to/lora_checkpoints/best")
lora_model.eval()

def compute_per(pred_phones, ref_phones):
    ops = edit_operations(pred_phones, ref_phones)
    errors = sum(1 for op in ops if op[0] != "equal")
    return errors / max(len(ref_phones), 1)

# Run on test split, collect per-phoneme confusion matrix
# Compare PER: baseline s2t_base vs lora_model on same test chunks
```

Per-phoneme analysis: build confusion matrix specifically for Turkish-specific phones
(`ɯ`, `œ`, `ɟ`, `ç`, `ɰ`) where POWSM is expected to struggle most.

---

## File Structure Summary

```
sig/exp/
├── 01_data_prep_turkish.ipynb    ← NEW: local, TextGrid → chunks
├── 02_finetune_lora.ipynb        ← NEW: Colab, LoRA training
├── 03_eval_lora.ipynb            ← NEW: local/Colab, PER evaluation
├── data/turkish_chunks/          ← NEW: chunk wav files + manifests
│   ├── manifest.json
│   ├── train.json
│   ├── val.json
│   └── test.json
│   └── S1T1_0000.wav ... (1980 files)
└── lora_checkpoints/             ← NEW: saved on Google Drive
    └── best/
        ├── adapter_config.json
        └── adapter_model.bin
```

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| `<tur>` not in POWSM vocab | Use `<unk>` lang token (verified via `converter.token2id`) |
| Phone tier name varies per file | Inspect first 3 TextGrids in Step 1 before batch processing |
| TextGrid phones not in POWSM vocab | Build `phone_map.json` after vocab comparison in Step 2c |
| Overfitting on 1980 chunks | LoRA keeps most params frozen; early stopping on val loss |
| ESPnet forward() signature mismatch | Inspect `s2t_model.forward` signature before training loop |
| Colab session timeout on long task-2 prep | Save intermediate manifest chunks, resume from checkpoint |

---

## Verification

1. **Data prep**: `len(manifest)` ≈ 1980, audio loads at exactly 320000 samples, no empty phone lists
2. **LoRA**: `model.print_trainable_parameters()` shows ~1–3% trainable
3. **Training**: Loss decreasing each epoch, no NaN; val loss tracks train (no wild divergence)
4. **Eval**: Baseline PER on test split → Fine-tuned PER on test split, expect improvement on Turkish-specific phones
5. **Sanity check**: Run both models on a single known Turkish chunk, print phone outputs side-by-side