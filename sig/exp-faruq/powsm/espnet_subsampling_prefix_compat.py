"""Patch ESPnet Conv2dSubsampling to match the upstream architecture expected by POWSM-CTC.

ESPnet 202511 (PyPI) defines Conv2dSubsampling with:
    self.out = Sequential(Linear, PositionalEncoding)
    forward(self, x, x_mask)           # no prefix_embeds

The upstream ESPnet (master) restructured it to:
    self.out = Linear
    self.pos_enc = PositionalEncoding   # separate attribute
    forward(self, x, x_mask, prefix_embeds=None)

POWSM-CTC checkpoints are saved with the upstream key layout (``out.weight``),
which silently fails to load into the old layout (expects ``out.0.weight``).
This causes the Linear projection to stay at random init → garbage CTC output.

This patch replaces __init__ and forward on Conv2dSubsampling (and related
classes) to match the upstream architecture **before** the model is loaded,
so checkpoint keys align and prefix_embeds works natively.

Conv2dSubsampling8 already has the correct layout and is NOT patched.
"""

from __future__ import annotations

import torch

_PATCHED = False


def apply_subsampling_prefix_compat() -> None:
    """Idempotent: patch subsampling classes once per process.

    Must be called BEFORE ``Speech2TextGreedySearch.from_pretrained`` so the
    model is constructed with the correct architecture and checkpoint keys
    map correctly.
    """
    global _PATCHED
    if _PATCHED:
        return

    from espnet.nets.pytorch_backend.transformer import subsampling as sub
    from espnet.nets.pytorch_backend.transformer.embedding import PositionalEncoding

    # --- Conv2dSubsampling (4x) -------------------------------------------

    _orig_conv2d_init = sub.Conv2dSubsampling.__init__

    def _conv2d_init(self, idim, odim, dropout_rate, pos_enc=None):
        super(sub.Conv2dSubsampling, self).__init__()
        self.conv = torch.nn.Sequential(
            torch.nn.Conv2d(1, odim, 3, 2),
            torch.nn.ReLU(),
            torch.nn.Conv2d(odim, odim, 3, 2),
            torch.nn.ReLU(),
        )
        self.out = torch.nn.Linear(odim * (((idim - 1) // 2 - 1) // 2), odim)
        self.pos_enc = (
            pos_enc if pos_enc is not None else PositionalEncoding(odim, dropout_rate)
        )

    def _conv2d_forward(self, x, x_mask, prefix_embeds=None):
        x = x.unsqueeze(1)
        x = self.conv(x)
        b, c, t, f = x.size()
        x = self.out(x.transpose(1, 2).contiguous().view(b, t, c * f))
        if x_mask is not None:
            x_mask = x_mask[:, :, :-2:2][:, :, :-2:2]

        if prefix_embeds is not None:
            x = torch.cat([prefix_embeds, x], dim=1)
            if x_mask is not None:
                x_mask = torch.cat(
                    [
                        torch.ones(
                            x_mask.shape[0],
                            1,
                            prefix_embeds.size(1),
                            dtype=x_mask.dtype,
                            device=x_mask.device,
                        ),
                        x_mask,
                    ],
                    dim=-1,
                )

        x = self.pos_enc(x)
        return x, x_mask

    sub.Conv2dSubsampling.__init__ = _conv2d_init
    sub.Conv2dSubsampling.forward = _conv2d_forward

    _PATCHED = True
