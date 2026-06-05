# Fine-tune corpus — QC gates

Manual inspection criteria for the Turkish-L1 English corpus (`corpus/raw` or `CORPUS_RAW_DIR` → POWSM fine-tune → Nounce deploy). **Do not advance to the next gate until the current gate passes.**

Related: `corpus/README.md`, `doc/V2_CONTEXT.md` §3 (POWSM), V2 issue **A6**, plan gates **D1/D2**.

**Source layout (typical drop):**

| Folder | Task | Label tier |
|--------|------|------------|
| `TASK1 audio&textgrids` | Read-aloud | `phones` |
| `TASK2 audio&textgrids` | Elicited interview | `REF-phones` |

Keep a simple log per gate: date, reviewer, PASS/FAIL, notes.

---

## Gate 0 — Corpus intake

**Do:** Open the corpus folder; confirm pairing and README.

| Check | Pass | Fail → |
|-------|------|--------|
| File pairing | Every `S{n}T1.wav` has `S{n}T1.TextGrid` (same for T2); 60 pairs | Re-export missing pair |
| TASK1 phones | 29/30 TextGrids have non-empty `phones`; only **S27T1** may be empty | Re-annotate S27T1 or exclude spk 27 |
| TASK2 labels | All 30 have non-empty `REF-phones` (IPA symbols, not English words) | Re-export correct tier |
| Audio sanity | Spot-listen 3 files: speech clear, no heavy clip/noise | Re-record or exclude |
| Speaker IDs | `S1`…`S30`, no duplicate stems | Rename consistently |

**Artifact:** `corpus/processed/corpus_inventory.csv` (file, duration_s, tier_ok, notes).

---

## Gate 1 — Audio normalization (16 kHz mono)

**Do:** Resample; verify format before batch.

| Check | Pass | Fail → |
|-------|------|--------|
| Sample rate | **16000 Hz** on outputs | Re-run resampler |
| Channels | **Mono** (1 ch) | Downmix; never train L/R separately |
| Peak level | 10 random clips: peak **−18 to −3 dBFS** | Gain-normalize or exclude |
| Duration | Resampled dur within **±50 ms** of source | Fix trim bug |
| Listening | 5 clips: no chipmunk/warble vs original | Wrong SR / corrupt write |

**Artifact:** `corpus/processed/wav16k/` + `gate1_audio_qc.json`.

---

## Gate 2 — Segmentation (≤20 s)

**Do:** Chunk on word tiers (`words` / `REF-words-matched`).

| Check | Pass | Fail → |
|-------|------|--------|
| Max length | **No chunk > 20.0 s** (target ≤18 s) | Split or lower `max_s` |
| Min length | **≥95%** of chunks **≥ 1.5 s**; log drops | Merge TASK2 turns or drop listed utts |
| Boundaries | **20 random chunks:** cuts on word edges, not mid-word | Fix word tier / chunker |
| Phone span | **10 chunks:** all phone intervals ⊆ chunk window | Fix extraction overlap |
| Count sanity | TASK1 ≈ **150–250** chunks; TASK2 ≈ **2000–2800** (after merge) | Re-tune merge rules |
| S27T1 | Excluded or fixed — no empty-label chunks from spk 27 | Gate 0 blocker |

**Manual:** Play 20 chunks; rough match to heard speech.

**Artifact:** `corpus/processed/manifest_chunks.tsv` (utt_id, spk, wav_path, t0, t1, dur_s, n_phones).

---

## Gate 3 — Phone labels per chunk

**Do:** Concatenate phone intervals inside each chunk.

| Check | Pass | Fail → |
|-------|------|--------|
| Non-empty | **100%** rows: **≥ 3** phones | Drop or re-annotate |
| No word leakage | **Zero** tokens like `his`, `the`, `retn` in phone field | Fix parser / clean list |
| Tier source | TASK1 ← `phones`; TASK2 ← `REF-phones` (column `label_tier`) | Fix wiring |
| Style | Per speaker, stable symbol style (e.g. `ej` not mixed with `eɪ`) | Note per-speaker rules |
| `spn` | If **>2%** of all phones, list utterances | Map to silence or drop |

**Manual:** **10 random rows** in PRAAT/Audacity: boundaries match manifest phone count.

**Artifact:** `manifest_chunks.tsv` with `phone_str`.

---

## Gate 4 — IPA → POWSM tokens

**Do:** Alias map, Unicode NFD, vocab filter against `espnet/powsm` `token_list`.

| Check | Pass | Fail → |
|-------|------|--------|
| NFD | All labels normalized (NFD) | Re-normalize |
| Aliases | **≥98%** tokens pass after alias table; OOV **<2%** | Extend `alias_map.yaml` |
| OOV list | Every OOV: map / drop / fix — none ignored | Block training |
| POWSM vocab | **100%** training tokens ∈ `token_list` | Map or drop utt |
| Slash format | ESPnet text: `/h//ɛ//l//oʊ/` (POWSM slashes, no spaces) | Fix formatter |
| L2 preserved | θ/ð/w/ŋ/ɹ errors stay **L2 surface** (e.g. `t`/`d̪` for θ), not dictionary-native θ | Do not canonicalize to native IPA |
| CTC vs decoder | CTC targets strip `ː ˑ`; decoder keeps if multitask | Match POWSM recipe |

**Manual:** Review **30** `phone_str` → `phone_powsm` pairs; sign off **5** Turkish-critical examples.

**Artifact:** `corpus/processed/oov_report.csv`, `alias_map.yaml`, `text_powsm` column.

---

## Gate 5 — QC manifest

**Do:** Automated filters + human sample.

| Check | Pass | Fail → |
|-------|------|--------|
| Garbage | **0** English-like garbage tokens in labels | Remove utts |
| Dedup | No duplicate `(spk, t0, t1)` | Dedupe script |
| Phone rate | **99%** of clips: **5–25** phones/s (flag outliers) | Inspect alignment |
| Leak | No test speaker in train manifest | Fix split |

**Manual sample:** **50 utterances** (10 TASK1, 40 TASK2; include 10 with θ/ð/w/ŋ/ɹ if possible). Mark OK / borderline / wrong. **Pass:** ≥90% OK, **0% wrong** on critical phones.

**Artifact:** `corpus/processed/qc_sample_review.csv` (signed).

---

## Gate 6 — ESPnet manifests

**Do:** Write `wav.scp`, `text`, `utt2spk`.

| Check | Pass | Fail → |
|-------|------|--------|
| Paths | Every `wav.scp` path exists | Regenerate |
| Line counts | Equal lines in `wav.scp`, `text`, `utt2spk` | Fix join |
| UTF-8 | Valid UTF-8; IPA displays correctly | Re-encode |
| Dry-run | ESPnet loads **100** random entries | Fix format |
| Spot listen | **5** scp lines: audio density matches label length | Parser bug |

**Artifact:** `corpus/processed/espnet/{train,dev,test}/` + `gate6_manifest_checksums.txt`.

---

## Gate 7 — Speaker-disjoint split

**Do:** Split by speaker; align with Ömer Faruk’s eval split.

| Check | Pass | Fail → |
|-------|------|--------|
| Disjoint | `train ∩ dev ∩ test` speakers empty pairwise | Re-split |
| Size | Train **≥22 spk**, dev **≥3**, test **≥3** (of 30) | Rebalance |
| Hours | Train **≥~4 h** chunk audio; dev **≥~20 min** | Add data or accept |
| External eval | **No speaker overlap** with teammate’s prior 10 h split (written OK) | Align splits |
| Test coverage | Test includes **≥2 speakers** with θ/ð/w in labels | Move speakers |

**Manual:** Print `spk2utt` per split; no `S{n}` in two splits.

**Artifact:** `corpus/processed/split_spk.tsv` + confirmation from Ömer Faruk.

---

## Gate 8 — Baseline eval (pretrained POWSM)

**Do:** Run `espnet/powsm` PR on **test manifest only** (before fine-tune).

| Check | Pass | Fail → |
|-------|------|--------|
| Completes | PER/PFER finite | Fix env/checkpoint |
| Sanity | Test PER not 0% or 100% (unless tiny set) | Label/format bug |
| L2 note | On **10 L2 clips:** baseline often predicts native where label has `t` for `θ` | Documents motivation; if inverted, check labels |
| Repro | Same command → PER ±0.1% | Seed/env |

**Artifact:** `corpus/processed/baseline_test_metrics.json` + 10-clip error sheet.

---

## Gate 9 — Fine-tune training

**Do:** `init_param` from `espnet/powsm`, `<pr>` task, low LR (e.g. 1e-5–5e-5).

| Check | Pass | Fail → |
|-------|------|--------|
| Config | Logs: `token_list`, `ctc_type: builtin`, stride **40 ms** from config | Wrong checkpoint |
| Loss | Train loss ↓ first **3 epochs**; dev not NaN | LR/batch/data |
| Overfit smoke (opt.) | 8-utt batch → loss ~0 | Labels broken |
| Checkpoint | Best `valid.loss` saved; baseline untouched | Backup `exp/` |
| No leak | Logs show train+dev speakers only | Stop; fix split |

**Manual @ epoch ~5:** Decode **5 dev clips** — closer to labels than baseline on **≥3/5**? Continue if yes.

**Artifact:** `exp/powsm_finetune/` + loss curves.

---

## Gate 10 — Post fine-tune eval

**Do:** Same test set as Gate 8.

| Check | Pass | Fail → |
|-------|------|--------|
| PER/PFER | Fine-tuned **≤ baseline** on test (or L2 recall up with small overall regression) | Tune epochs/LR/data |
| Turkish-critical | Per-phone recall **up** for θ, ð, w, ŋ, ɹ on test | Confusion review; oversample |
| Regression cap | “Easy” subset: **<5% relative** PER increase vs baseline | Earlier stop / freeze decoder |
| L2 acceptance | Fewer forced native matches when label is L2 (e.g. accept `t` for θ) | Primary Nounce criterion |
| Listening | **10 test clips:** predictions plausible vs labels | Do not deploy |

**Sign-off:** Teammate reviews confusion matrix + listens.

**Artifact:** `corpus/processed/finetuned_test_metrics.json`, confusion figure (D2).

---

## Gate 11 — Checkpoint packaging

| Check | Pass | Fail → |
|-------|------|--------|
| Bundle | `config.yaml`, weights, token list | Incomplete export |
| Inference | `Speech2Text` + **3 WAVs** → IPA, no crash | Fix `lang_sym` / `task_sym` |
| Version tag | e.g. `powsm-tr-l1-v1` in `CHECKPOINT.md` | — |

**Artifact:** HF Hub / RunPod path + `CHECKPOINT.md`.

---

## Gate 12 — Nounce integration (A6)

| Check | Pass | Fail → |
|-------|------|--------|
| Aligner | `POWSMAligner` asserts token_list / ctc / stride at startup | V2_CONTEXT §3 |
| Assess | **3** ref/user pairs: sensible JSON, **<3 s** warm RunPod | Profile worker |
| References | A2 on **5 refs** with new model; sensible diff vs baseline on L2 clip | Re-run precompute |
| App contract | DB phones without slashes; `app/src/lib/ipa.ts` unchanged behavior | Fix strip path |
| Deploy | Worker uses new tag only; rollback documented | — |

**Manual:** Browser practice flow: record → analysis → phoneme errors plausible.

---

## Order and hard stops

```
0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10 → 11 → 12
```

**Hard stop (do not proceed):** Gate 0 (pairing / S27T1), Gate 4 (unresolved OOV), Gate 7 (speaker leak), Gate 10 (listening fail).

---

## Per-gate log template

```text
Gate #: ___
Date: ___
Reviewer: ___
PASS / FAIL: ___

Automated: ___
Manual sample: ___

Notes:
___

Next gate allowed: YES / NO
```

---

## Symbol normalization (reference)

Start here for Gate 4; extend after OOV report.

| Corpus | POWSM-oriented |
|--------|----------------|
| `ej` | `eɪ` |
| `ow` | `oʊ` |
| `aj` | `aɪ` |
| `aw` | `aʊ` |
| `oy` / `ɔj` | `ɔɪ` |
| `i:` | `iː` |

Always: Unicode **NFD**; strip slashes only at DB/UI boundary (`app/src/lib/ipa.ts`), not in ESPnet `text` field.

---

## Analysis scripts

From repo root (`CORPUS_RAW_DIR` or `corpus/raw` symlink):

```bash
python corpus/scripts/analyze_corpus.py
python corpus/scripts/analyze_corpus_deep.py
python corpus/scripts/analyze_corpus_chunks.py
```

Optional report: `python corpus/scripts/analyze_corpus.py > corpus/reports/inventory.txt`
