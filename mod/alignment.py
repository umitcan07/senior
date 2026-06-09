"""
POWSMAligner — reusable CTC alignment module for POWSM phone recognition.

Provides forced and free alignment of audio to IPA phone sequences using
the POWSM model's CTC encoder. Used by assess.py (E3), precompute (E4),
and eval harness (E6).

Optionally loads a Turkish-L1 fine-tuned PEFT LoRA adapter on top of the
baseline POWSM weights (E5). The adapter targets the multi-headed-attention
linears (linear_q/k/v/out), which exist in the *encoder*, so the fine-tuned
weights affect model.encode() / ctc.log_softmax() — the CTC path this aligner
uses for free/forced alignment and GOP — not just the seq2seq decoder. Gated by
``adapter_dir`` / ``POWSM_ADAPTER_DIR``; defaults to the baseline model (no adapter).
"""

import dataclasses
import logging
import os
from typing import Optional

import numpy as np

log = logging.getLogger(__name__)

TARGET_SR = 16000
PAD_SECONDS = 20


@dataclasses.dataclass
class PhoneSegment:
    token: str
    start_ms: float
    end_ms: float
    confidence: float

    def to_dict(self) -> dict:
        return {
            "token": self.token,
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "confidence": self.confidence,
        }


@dataclasses.dataclass
class AlignerOutput:
    logprobs: np.ndarray  # [T, V] float32
    n_frames: int
    frame_stride_ms: float
    blank_id: int
    vocab: list[str]

    def to_dict(self) -> dict:
        return {
            "n_frames": self.n_frames,
            "frame_stride_ms": self.frame_stride_ms,
            "blank_id": self.blank_id,
            "vocab_size": len(self.vocab),
        }


_aligner: Optional["POWSMAligner"] = None


def get_aligner(
    model_tag: str | None = None,
    device: str | None = None,
    adapter_dir: str | None = None,
) -> "POWSMAligner":
    global _aligner
    if _aligner is None:
        _aligner = POWSMAligner(
            model_tag=model_tag, device=device, adapter_dir=adapter_dir
        )
    return _aligner


class POWSMAligner:
    def __init__(
        self,
        model_tag: str | None = None,
        device: str | None = None,
        adapter_dir: str | None = None,
    ):
        import torch
        from espnet2.bin.s2t_inference import Speech2Text

        self.model_tag = model_tag or os.environ.get(
            "POWSM_MODEL_TAG", "espnet/powsm"
        )

        # Turkish-L1 fine-tuned LoRA adapter (E5). Resolution order:
        #   explicit arg > POWSM_ADAPTER_DIR env > baked-in mod/assessment/adapter.
        # Set POWSM_ADAPTER_DIR="" to force the baseline POWSM model.
        self.adapter_dir = self._resolve_adapter_dir(adapter_dir)

        if device is None:
            device = "cuda" if torch.cuda.is_available() else "cpu"
        self.device = device

        # lang/task syms only prime the decoder prompt; the CTC encoder path this aligner
        # uses is prompt-independent, so this does NOT change phone output. We still mirror
        # the training value for provenance / a possible future decode path. The 2026-06-09
        # adapters were trained with lang_sym="<eng>" (scripts/train_adapter.py); the V1
        # adapter used "<unk>". Default to <eng>; override with POWSM_LANG_SYM if needed.
        # See doc/adapters.md (Pitfall #1).
        lang_sym = os.environ.get("POWSM_LANG_SYM", "<eng>")

        log.info(
            "Loading %s on %s (lang_sym=%s, adapter=%s)",
            self.model_tag,
            self.device,
            lang_sym,
            self.adapter_dir or "none",
        )
        self.s2t = Speech2Text.from_pretrained(
            self.model_tag,
            device=self.device,
            lang_sym=lang_sym,
            task_sym="<pr>",
        )

        if self.adapter_dir:
            self._attach_lora(self.adapter_dir)
        else:
            self.model = self.s2t.s2t_model

        assert self.model.ctc.ctc_type == "builtin", (
            f"Expected builtin CTC, got {self.model.ctc.ctc_type}"
        )

        self.blank_id = getattr(self.model, "blank_id", 0)
        self.token_list = self.s2t.converter.token_list
        assert len(self.token_list) > 0, "Empty token list"
        assert self.blank_id is not None, "blank_id is None"

        pconf = getattr(self.s2t.s2t_train_args, "preprocessor_conf", {})
        self.frame_sec = float(pconf.get("speech_resolution", 0.04))
        log.info(
            "frame_sec=%s, blank_id=%s, vocab_size=%d",
            self.frame_sec,
            self.blank_id,
            len(self.token_list),
        )
        assert self.frame_sec == 0.04, (
            f"Expected frame_sec=0.04, got {self.frame_sec}"
        )

    @staticmethod
    def _resolve_adapter_dir(explicit: str | None) -> str | None:
        if explicit is not None:
            cand = explicit
        elif "POWSM_ADAPTER_DIR" in os.environ:
            cand = os.environ["POWSM_ADAPTER_DIR"]  # set to non-empty path to enable adapter
        else:
            return None  # baseline model by default
        cand = cand.strip() if isinstance(cand, str) else cand
        if not cand:
            return None
        if not os.path.isdir(cand):
            log.warning(
                "POWSM adapter dir %r not found; using baseline model", cand
            )
            return None
        return cand

    def _attach_lora(self, adapter_dir: str) -> None:
        """Wrap the POWSM model with the PEFT LoRA adapter, in place.

        PEFT injects the LoRA modules directly into the target linears of the base
        model, so model.encode() / ctc.log_softmax() pick up the fine-tuned weights.
        The aligner never runs beam search, so (unlike the old assess.py loader) no
        decoder/CTC scorer surgery is needed. We keep ``self.model`` pointed at the
        plain ESPnetS2TModel (via get_base_model) so the existing .encode/.ctc calls
        avoid PeftModel attribute-forwarding edge cases.
        """
        from peft import PeftModel

        peft_model = PeftModel.from_pretrained(self.s2t.s2t_model, adapter_dir)
        self.s2t.s2t_model = peft_model
        self.model = peft_model.get_base_model()
        log.info("Attached LoRA adapter from %s", adapter_dir)

    def _pad_20s(self, audio: np.ndarray) -> np.ndarray:
        max_samples = TARGET_SR * PAD_SECONDS
        if len(audio) > max_samples:
            log.warning(
                "Audio has %d samples (%.1fs), truncating to %ds",
                len(audio),
                len(audio) / TARGET_SR,
                PAD_SECONDS,
            )
        padded = np.zeros(max_samples, dtype=np.float32)
        n = min(len(audio), max_samples)
        padded[:n] = audio[:n]
        return padded

    def _tokenize_ipa(self, canonical_ipa: list[str]) -> list[int]:
        ipa_str = "".join(f"/{p}/" for p in canonical_ipa)
        tokens = self.s2t.tokenizer.text2tokens(ipa_str)
        tokens = [t for t in tokens if t != "▁"]
        ids = self.s2t.converter.tokens2ids(tokens)
        unk_id = self.s2t.converter.tokens2ids(["<unk>"])[0]
        unk_tokens = [t for t, i in zip(tokens, ids) if i == unk_id]
        if unk_tokens:
            raise ValueError(
                f"Unknown tokens in POWSM vocab: {unk_tokens}. "
                f"POWSM uses monophthongs — diphthongs like 'oʊ' must be "
                f"split into separate phones ['o', 'ʊ']. "
                f"Input was: {canonical_ipa}"
            )
        assert all(i != self.blank_id for i in ids), (
            f"Target IDs must not contain blank ({self.blank_id}): {ids}"
        )
        return ids

    def _encode_audio(self, audio: np.ndarray):
        """Shared encoder forward pass. Returns (enc, enc_lens, log_probs, speech tensor)."""
        import torch

        padded = self._pad_20s(audio)
        speech = torch.from_numpy(padded).unsqueeze(0).to(self.device)
        speech_lengths = torch.tensor([len(padded)], device=self.device)

        with torch.no_grad():
            enc, enc_lens = self.model.encode(speech, speech_lengths)
            log_probs = self.model.ctc.log_softmax(enc)

        return enc, enc_lens, log_probs

    def encode(self, audio: np.ndarray) -> AlignerOutput:
        _, enc_lens, log_probs = self._encode_audio(audio)
        n_frames = int(enc_lens[0])
        return AlignerOutput(
            logprobs=log_probs[0, :n_frames].cpu().numpy(),
            n_frames=n_frames,
            frame_stride_ms=self.frame_sec * 1000,
            blank_id=self.blank_id,
            vocab=list(self.token_list),
        )

    def forced_alignment(
        self, audio: np.ndarray, canonical_ipa: list[str]
    ) -> list[PhoneSegment]:
        import torch
        import torchaudio.functional as AF

        ids = self._tokenize_ipa(canonical_ipa)
        _, enc_lens, log_probs = self._encode_audio(audio)

        targets = torch.tensor([ids], dtype=torch.int32, device=self.device)
        target_lengths = torch.tensor(
            [len(ids)], dtype=torch.int32, device=self.device
        )

        align_path, align_scores = AF.forced_align(
            log_probs.float(),
            targets,
            enc_lens.to(torch.int32),
            target_lengths,
            blank=self.blank_id,
        )

        spans = AF.merge_tokens(align_path[0], align_scores[0].exp())

        segments = []
        for s in spans:
            if s.token == self.blank_id:
                continue
            tok = self.token_list[s.token]
            bare = tok.strip("/")
            segments.append(
                PhoneSegment(
                    token=bare,
                    start_ms=round(s.start * self.frame_sec * 1000, 1),
                    end_ms=round((s.end + 1) * self.frame_sec * 1000, 1),
                    confidence=round(float(s.score), 4),
                )
            )

        return segments

    def free_alignment(self, audio: np.ndarray) -> list[PhoneSegment]:
        enc, enc_lens, log_probs = self._encode_audio(audio)
        argmax = self.model.ctc.argmax(enc)

        n_frames = int(enc_lens[0])
        segments = []
        prev_token = None
        start_frame = 0

        for f in range(n_frames):
            tok_id = int(argmax[0, f])
            if tok_id != prev_token:
                if prev_token is not None and prev_token != self.blank_id:
                    bare = self.token_list[prev_token].strip("/")
                    span_probs = log_probs[0, start_frame:f, prev_token].exp()
                    conf = float(span_probs.mean())
                    segments.append(
                        PhoneSegment(
                            token=bare,
                            start_ms=round(
                                start_frame * self.frame_sec * 1000, 1
                            ),
                            end_ms=round(
                                f * self.frame_sec * 1000, 1
                            ),
                            confidence=round(conf, 4),
                        )
                    )
                start_frame = f
                prev_token = tok_id

        if prev_token is not None and prev_token != self.blank_id:
            bare = self.token_list[prev_token].strip("/")
            span_probs = log_probs[0, start_frame:n_frames, prev_token].exp()
            conf = float(span_probs.mean())
            segments.append(
                PhoneSegment(
                    token=bare,
                    start_ms=round(start_frame * self.frame_sec * 1000, 1),
                    end_ms=round(n_frames * self.frame_sec * 1000, 1),
                    confidence=round(conf, 4),
                )
            )

        return segments
