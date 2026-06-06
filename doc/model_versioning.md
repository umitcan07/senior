# Model version management (POWSM base + fine-tuned adapters)

How we manage POWSM model versions across **local dev** and **RunPod**, given that
we re-fine-tune (LoRA) with augmented data, fine-tuning runs **on RunPod**, and a
**network volume** is attached there.

Status: design (E5). Tracking: #74. Aligner integration: #73. Parent epic: #7.

## Why this exists

V1's fine-tune baked the LoRA adapter into the Docker image (`mod/assessment/adapter/`),
so every re-fine-tune forced an image rebuild + redeploy, and there was no clean way to
run a specific version locally or roll back. We re-fine-tune with augmented data, so the
model must roll **independently of the code/image**.

## Decisions

- **Artifacts decoupled from the image.** No adapter baked in. The image ships code; the
  model is selected at runtime by env. If the selected adapter is missing, fall back to
  baseline `espnet/powsm` (never crash on a missing version).
- **RunPod network volume is the source of truth** for artifacts; **R2 mirrors** adapters
  (+ manifests) so local dev and CI can pull them without RunPod access.
- **Weights live off-git** (volume + R2). **Manifests (small JSON) are committed** for
  provenance.

## Layout

### RunPod network volume — `/runpod-volume/models/`
```
base/                  # HF cache for espnet/powsm (HF_HOME points here)
adapters/<version>/    # LoRA dir: adapter_config.json + adapter weights
manifests/<version>.json
ACTIVE                 # text pointer to the live version, e.g. "tr-l1-v2-aug"
```

### R2 mirror — `models/` prefix in the existing bucket
```
models/adapters/<version>.tar.zst   # packed adapter
models/manifests/<version>.json      # same manifest, for discovery
```

### Version manifest (`manifests/<version>.json`, committed to repo)
```json
{
  "version": "tr-l1-v2-aug",
  "base_tag": "espnet/powsm",
  "adapter": "adapters/tr-l1-v2-aug",
  "lang_sym": "<unk>",
  "train_data_manifest_hash": "<sha256 of the augmented corpus manifest>",
  "hyperparams": { "rank": 16, "alpha": 32, "epochs": 3, "lr": 1e-4 },
  "eval": { "per_baseline": 0.31, "per_finetuned": 0.24, "split": "E6 val" },
  "git_sha": "<training-code commit>",
  "created": "2026-06-07"
}
```
`lang_sym` matters: the existing adapter was trained with `lang_sym="<unk>"`; the aligner
must use the manifest's symbol when an adapter is attached (baseline uses `<eng>`).

## Runtime contract (identical local & prod)

| Env | Meaning | Local | RunPod |
|---|---|---|---|
| `POWSM_MODEL_TAG` | base model | `espnet/powsm` | `espnet/powsm` |
| `MODELS_DIR` | artifact root | `/models` (compose mount) | `/runpod-volume/models` |
| `POWSM_ADAPTER` | version id, `baseline`, or unset (→ read `ACTIVE`) | per-dev | per-endpoint |
| `HF_HOME` | base cache | local cache | `/runpod-volume/models/base` |

Model selection happens in **one place** — the aligner (`mod/alignment.py`, #73):
resolve `MODELS_DIR/adapters/$POWSM_ADAPTER`, attach the LoRA (using the manifest's
`lang_sym`), else fall back to baseline. `assess` and `verify.py` inherit it for free.

## Fine-tuning job (on RunPod)

A dedicated training pod/endpoint (GPU), **separate from the assess worker**:
1. Read the augmented corpus (versioned by `train_data_manifest_hash`) + base from `base/`.
2. Train the LoRA; write `adapters/<new-version>/` + `manifests/<new-version>.json`,
   including eval PER on the E6 validation split (#30/#31).
3. Push the packed adapter + manifest to the **R2 mirror**.
4. Do **not** touch the live worker — promotion is a separate, deliberate step.

## Promotion / rollback / A-B

- **Promote:** set `POWSM_ADAPTER=<version>` (or update `ACTIVE`) on the assess endpoint.
- **Rollback:** point it back to the previous version — instant, no rebuild.
- **A/B or demo:** run a second endpoint pinned to a specific version; the app targets it.
  This is E5.2's "model tag" (#29).
- **Gate:** only promote a version whose manifest PER beats the current on the E6 split.

## Local dev flow

```
# fetch a version from the R2 mirror into ./models (gitignored)
python scripts/pull_model.py tr-l1-v2-aug
# docker-compose.dev.yml mounts ./models -> /models; select it:
POWSM_ADAPTER=tr-l1-v2-aug   # or `baseline`
```
`docker-compose.dev.yml` gains a `./models:/models` mount and the env above. Base model
still comes from the HF cache (`HF_HOME`). `verify.py` picks up the same env, so the
offline matrix runs against the chosen version.

## Reproducibility & data

- Commit **manifests** (provenance: base + data hash + hyperparams + PER + git SHA);
  keep weights off-git.
- Version the **augmented corpus** with a manifest hash so version → training data is
  traceable. Lock the baseline + splits per #28.
- `.gitignore`: `app/models/`, `/models/`, `*.tar.zst` adapter packs.

## Phased implementation (tracked in #74)

1. Aligner adapter-loading + `MODELS_DIR`/`POWSM_ADAPTER` contract + baseline fallback (#73).
2. `scripts/pull_model.py` (R2 → `./models`) + compose mount + `.gitignore`.
3. RunPod fine-tune job: train → write volume → mirror to R2 → manifest with PER.
4. Promotion runbook (env flip / `ACTIVE`) + rollback; wire E5.2 model tag (#29).
5. First augmented re-fine-tune; gate promotion on E6 PER (#30/#31).
