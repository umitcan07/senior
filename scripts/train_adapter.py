"""
DoRA adapter training for POWSM phone recognition.

Loads POWSM, applies a DoRA (weight-decomposed LoRA) adapter via PEFT, trains
with CTC loss on ESPnet-style manifests (wav.scp + text), and saves the adapter
in PEFT format (compatible with mod/alignment.py's _attach_lora).

Usage examples:

  # Smoke test — 1 epoch on TR speakers only (local, no L2-ARCTIC needed)
  python scripts/train_adapter.py \\
      --train-wav  data/finetune/tr_speakers/all/wav.scp \\
      --train-text data/finetune/tr_speakers/all/text \\
      --dev-wav    data/finetune/tr_speakers/all/wav.scp \\
      --dev-text   data/finetune/tr_speakers/all/text \\
      --output-dir exp/smoke_adapter \\
      --epochs 2 --batch-size 2 --accum-grad 4

  # Full run — l2a_ppl adapter (L2-ARCTIC perceived labels)
  python scripts/train_adapter.py \\
      --train-wav  data/finetune/l2a_ppl/train/wav.scp \\
      --train-text data/finetune/l2a_ppl/train/text \\
      --dev-wav    data/finetune/l2a_ppl/dev/wav.scp \\
      --dev-text   data/finetune/l2a_ppl/dev/text \\
      --output-dir exp/l2a_ppl \\
      --epochs 30

  # l2a_ppl+tr fold 1 (mix L2-ARCTIC PPL + 3 TR speakers)
  python scripts/train_adapter.py \\
      --train-wav  data/finetune/l2a_ppl/train/wav.scp \\
                   data/finetune/tr_speakers/loso_fold1_train_tr/wav.scp \\
      --train-text data/finetune/l2a_ppl/train/text \\
                   data/finetune/tr_speakers/loso_fold1_train_tr/text \\
      --dev-wav    data/finetune/l2a_ppl/dev/wav.scp \\
      --dev-text   data/finetune/l2a_ppl/dev/text \\
      --output-dir exp/l2a_ppl_tr_fold1 \\
      --epochs 30
"""

import argparse
import logging
import os
import sys
import time
from typing import List, Optional

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, Dataset

logging.basicConfig(
    format="%(asctime)s %(levelname)s %(name)s  %(message)s",
    level=logging.INFO,
    handlers=[logging.StreamHandler(sys.stdout)],
)
log = logging.getLogger("train_adapter")

TARGET_SR = 16000
PAD_SAMPLES = TARGET_SR * 20  # 20 s padded length (POWSM requirement)


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

class PhoneDataset(Dataset):
    """
    Reads ESPnet-style wav.scp + text manifests.
    Returns (audio_tensor [320000], token_ids_tensor [S]).
    All audio is loaded at 16kHz mono and zero-padded to 20s.
    """

    def __init__(
        self,
        wav_scps: List[str],
        text_files: List[str],
        tokenizer,
        converter,
        blank_id: int,
    ):
        import librosa

        self.tokenizer = tokenizer
        self.converter = converter
        self.blank_id = blank_id
        self._librosa = librosa

        # Read wav.scp files
        wav_map = {}
        for scp in wav_scps:
            with open(scp, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    utt_id, wav_path = line.split(None, 1)
                    wav_map[utt_id] = wav_path

        # Read text files
        text_map = {}
        for tf in text_files:
            with open(tf, encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    parts = line.split(None, 1)
                    if len(parts) == 2:
                        text_map[parts[0]] = parts[1]

        # Keep only utterances present in both
        common = sorted(set(wav_map) & set(text_map))
        self.items = [(uid, wav_map[uid], text_map[uid]) for uid in common]
        log.info("Dataset: %d utterances", len(self.items))

    def __len__(self):
        return len(self.items)

    def _tokenize(self, espnet_text: str) -> Optional[List[int]]:
        """Convert '/h//ɛ//l//oʊ/' style text to POWSM token IDs."""
        try:
            tokens = self.tokenizer.text2tokens(espnet_text)
            tokens = [t for t in tokens if t != "▁"]
            ids = self.converter.tokens2ids(tokens)
            unk_id = self.converter.tokens2ids(["<unk>"])[0]
            if any(i == unk_id for i in ids):
                unk_toks = [t for t, i in zip(tokens, ids) if i == unk_id]
                log.warning("OOV tokens %s in %r — skipping utterance", unk_toks, espnet_text[:40])
                return None
            if any(i == self.blank_id for i in ids):
                log.warning("blank in target ids — skipping utterance")
                return None
            return ids
        except Exception as exc:
            log.warning("Tokenize error: %s — skipping", exc)
            return None

    def __getitem__(self, idx):
        utt_id, wav_path, text = self.items[idx]
        try:
            audio, _ = self._librosa.load(wav_path, sr=TARGET_SR, mono=True)
        except Exception as exc:
            log.warning("Failed to load %s: %s", wav_path, exc)
            # Return silence + a dummy single-phone target so collation doesn't crash
            audio = np.zeros(TARGET_SR, dtype=np.float32)
            text = "/ə/"

        # Truncate to a 20s cap (bounds memory) but do NOT pad here — padding to a
        # fixed 20s would force the encoder to process ~5-8x silence on typical
        # 2-4s clips.  collate_fn pads each batch to its own max length instead, and
        # the true per-clip length is passed to encode() so the encoder masks padding.
        n = min(len(audio), PAD_SAMPLES)
        audio = np.ascontiguousarray(audio[:n], dtype=np.float32)

        ids = self._tokenize(text)
        if ids is None:
            ids = [1]  # single non-blank token fallback; loss for this item will be large

        return torch.from_numpy(audio), torch.LongTensor(ids)


def collate_fn(batch):
    # Pad speech to the batch's max length (not a fixed 20s) and report true lengths.
    speech_list = [b[0] for b in batch]
    speech_lengths = torch.LongTensor([s.shape[0] for s in speech_list])
    max_s = int(speech_lengths.max())
    speech = torch.zeros(len(batch), max_s, dtype=torch.float32)
    for i, s in enumerate(speech_list):
        speech[i, : s.shape[0]] = s

    targets = [b[1] for b in batch]
    target_lengths = torch.LongTensor([len(t) for t in targets])
    max_len = max(len(t) for t in targets)
    padded = torch.zeros(len(targets), max_len, dtype=torch.long)
    for i, t in enumerate(targets):
        padded[i, : len(t)] = t
    return speech, speech_lengths, padded, target_lengths


# ---------------------------------------------------------------------------
# Training
# ---------------------------------------------------------------------------

def run_epoch(model, loader, optimizer, device, accum_grad, blank_id, train=True):
    model.train(train)
    total_loss = 0.0
    n_batches = 0
    if train:
        optimizer.zero_grad()

    for step, (speech, speech_lengths, targets, target_lengths) in enumerate(loader):
        speech = speech.to(device)
        speech_lengths = speech_lengths.to(device)
        targets = targets.to(device)
        target_lengths = target_lengths.to(device)

        with torch.set_grad_enabled(train):
            enc, enc_lens = model.encode(speech, speech_lengths)
            log_probs = model.ctc.log_softmax(enc)      # [B, T, V]
            log_probs_t = log_probs.transpose(0, 1)     # [T, B, V] for ctc_loss

            # Normalize per target token EXPLICITLY rather than via reduction="mean".
            # F.ctc_loss(reduction="mean") is inconsistent across torch versions —
            # some divide by target length (per-token scale ~10 at init), torch 2.1.0
            # divides by batch only (per-utterance-sum scale ~hundreds). The latter
            # interacts badly with clip_grad_norm (over-clips, stalls training).
            # sum / total-tokens is deterministic and matches ESPnet's CTC convention.
            loss = F.ctc_loss(
                log_probs_t.float(),
                targets,
                enc_lens.to(torch.long),
                target_lengths,
                blank=blank_id,
                reduction="sum",
                zero_infinity=True,
            ) / target_lengths.sum().clamp(min=1)

        if train:
            (loss / accum_grad).backward()
            if (step + 1) % accum_grad == 0:
                torch.nn.utils.clip_grad_norm_(
                    (p for p in model.parameters() if p.requires_grad), 5.0
                )
                optimizer.step()
                optimizer.zero_grad()

        total_loss += loss.item()
        n_batches += 1

        if train and step % 50 == 0:
            log.info("  step %d  loss=%.4f", step, loss.item())

    # Flush remaining gradient accumulation steps
    if train and (len(loader) % accum_grad) != 0:
        torch.nn.utils.clip_grad_norm_(
            (p for p in model.parameters() if p.requires_grad), 5.0
        )
        optimizer.step()
        optimizer.zero_grad()

    return total_loss / max(n_batches, 1)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-wav",  nargs="+", required=True,
                    help="One or more wav.scp paths (concatenated as single train set)")
    ap.add_argument("--train-text", nargs="+", required=True)
    ap.add_argument("--dev-wav",    nargs="+", required=True)
    ap.add_argument("--dev-text",   nargs="+", required=True)
    ap.add_argument("--output-dir", required=True)
    ap.add_argument("--model-tag",  default="espnet/powsm")
    ap.add_argument("--epochs",     type=int,   default=30)
    ap.add_argument("--batch-size", type=int,   default=4)
    ap.add_argument("--accum-grad", type=int,   default=8)
    ap.add_argument("--lr",         type=float, default=2e-5)
    ap.add_argument("--lora-rank",  type=int,   default=32)
    ap.add_argument("--lora-alpha", type=int,   default=64)
    ap.add_argument("--use-dora",   action=argparse.BooleanOptionalAction, default=True,
                    help="Use DoRA (weight-decomposed LoRA). Pass --no-use-dora for plain LoRA. "
                         "Was previously store_true+default=True, which could never be disabled.")
    ap.add_argument("--target-modules", nargs="+",
                    default=["linear_q", "linear_k", "linear_v", "linear_out"])
    ap.add_argument("--patience",   type=int,   default=5,
                    help="Early stop if dev loss doesn't improve for N epochs")
    ap.add_argument("--fp16",       action="store_true", default=True)
    args = ap.parse_args()

    device = "cuda" if torch.cuda.is_available() else "cpu"
    log.info("Device: %s  fp16=%s", device, args.fp16)

    # --- Load POWSM ---
    log.info("Loading POWSM from %s ...", args.model_tag)
    from espnet2.bin.s2t_inference import Speech2Text
    s2t = Speech2Text.from_pretrained(
        args.model_tag,
        device=device,
        lang_sym="<eng>",
        task_sym="<pr>",
    )
    base_model = s2t.s2t_model

    blank_id = getattr(base_model, "blank_id", 0)
    log.info("blank_id=%d  vocab_size=%d", blank_id, len(s2t.converter.token_list))

    # --- Apply DoRA adapter ---
    from peft import get_peft_model, LoraConfig
    peft_config = LoraConfig(
        use_dora=args.use_dora,
        r=args.lora_rank,
        lora_alpha=args.lora_alpha,
        target_modules=args.target_modules,
        lora_dropout=0.1,
        bias="none",
        task_type=None,
        modules_to_save=None,
    )
    peft_model = get_peft_model(base_model, peft_config)
    peft_model.print_trainable_parameters()
    peft_model = peft_model.to(device)

    # --- Datasets ---
    train_ds = PhoneDataset(
        args.train_wav, args.train_text,
        s2t.tokenizer, s2t.converter, blank_id,
    )
    dev_ds = PhoneDataset(
        args.dev_wav, args.dev_text,
        s2t.tokenizer, s2t.converter, blank_id,
    )
    train_loader = DataLoader(
        train_ds, batch_size=args.batch_size,
        shuffle=True, collate_fn=collate_fn,
        num_workers=2, pin_memory=(device == "cuda"),
    )
    dev_loader = DataLoader(
        dev_ds, batch_size=args.batch_size,
        shuffle=False, collate_fn=collate_fn,
        num_workers=2, pin_memory=(device == "cuda"),
    )

    # --- Optimizer + scheduler ---
    trainable = [p for p in peft_model.parameters() if p.requires_grad]
    optimizer = torch.optim.AdamW(trainable, lr=args.lr, weight_decay=0.01)
    scheduler = torch.optim.lr_scheduler.LinearLR(
        optimizer, start_factor=0.1, end_factor=1.0,
        total_iters=max(1, len(train_loader) // args.accum_grad),
    )

    scaler = torch.cuda.amp.GradScaler() if (args.fp16 and device == "cuda") else None

    # --- Training loop ---
    os.makedirs(args.output_dir, exist_ok=True)
    best_dev_loss = float("inf")
    patience_count = 0

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss = run_epoch(
            peft_model, train_loader, optimizer, device,
            args.accum_grad, blank_id, train=True,
        )
        dev_loss = run_epoch(
            peft_model, dev_loader, None, device,
            args.accum_grad, blank_id, train=False,
        )
        scheduler.step()

        elapsed = time.time() - t0
        log.info(
            "Epoch %d/%d  train=%.4f  dev=%.4f  %.0fs",
            epoch, args.epochs, train_loss, dev_loss, elapsed,
        )

        # Save every epoch
        ckpt_dir = os.path.join(args.output_dir, f"checkpoint-epoch-{epoch}")
        peft_model.save_pretrained(ckpt_dir)

        # Track best
        if dev_loss < best_dev_loss:
            best_dev_loss = dev_loss
            patience_count = 0
            peft_model.save_pretrained(os.path.join(args.output_dir, "best"))
            log.info("  → new best (dev=%.4f)  saved to %s/best", best_dev_loss, args.output_dir)
        else:
            patience_count += 1
            log.info("  patience %d/%d", patience_count, args.patience)
            if patience_count >= args.patience:
                log.info("Early stopping at epoch %d", epoch)
                break

    # Final save (same as best if early stopped, otherwise last epoch)
    peft_model.save_pretrained(args.output_dir)
    log.info("Training complete. Best dev loss: %.4f", best_dev_loss)
    log.info("Adapter saved to %s", args.output_dir)


if __name__ == "__main__":
    main()
