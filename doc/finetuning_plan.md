# Fine-tuning plan — what to do now

**Defense:** 2026-06-13. **Window:** 3 working days + buffer.
**Context:** `doc/finetuning_failure_analysis.md` (why the original TR fine-tune is dead), `doc/model_versioning.md` (artifact/runtime contract). Tracking: #88, #87, #74, #29, #28.

## Thesis we are defending

Valid L2 mispronunciation-detection fine-tuning requires **phonetic (produced) annotation in the model's own output convention**. Canonical labels actively harm a deviation detector. We prove it with a same-data, opposite-supervision ablation (`cpl` vs `ppl`) on L2-ARCTIC, validated on a held-out Turkish-L1 set.

The original TR fine-tune failed for two annotation reasons (canonical-not-produced labels; `ej/ow/aj/aw` glide vs POWSM's `eɪ/oʊ/aɪ/aʊ` offglide). L2-ARCTIC fixes the first because it ships canonical (CPL) and perceived (PPL) as separate fields.

## Adapters to train (6 total)

Same DoRA config across all (per #78 recommended order); only the target field / data mix changes.

| Adapter | Data | Target | Folds | Purpose |
|---|---|---|---|---|
| `l2a-cpl` | L2-ARCTIC | canonical (CPL) | 1 | Control — should reproduce the normalization failure on clean data |
| `l2a-ppl` | L2-ARCTIC | perceived (PPL) | 1 | Corrected approach; all 4 TR speakers unseen |
| `l2a-ppl+tr` | L2-ARCTIC + Turkish | perceived (PPL) | 4 (LOSO) | Does in-domain Turkish help? |

## Turkish data + validation (LOSO)

Set: 4 speakers × 13 annotated sentences = 52 clips (`data/test_recordings/4-speakers-13-sentences.txt`).
Too few to train alone — it is an in-domain mix on top of L2-ARCTIC's 27h.

**Split by speaker, not sentence.** Sentence-level (12/1, 10/3) puts all 4 speakers in train and val → measures "new sentence from a known voice," not new users; violates the #28 speaker-disjoint rule; 1-sentence val is noise.

**Leave-One-Speaker-Out, 4 folds:** fold k trains on L2-ARCTIC + the other 3 TR speakers, evals on speaker k (all 13 sentences). Report mean ± range across folds.

**Fallback** if folds blow the budget: single 3-train/1-val speaker holdout, reported as n=1. Do **not** go sentence-level. Optional secondary: 10/3 sentence split reported as "seen-speaker, new-sentence" — never as the generalization result.

## Eval matrix (the headline table)

| Model | TR in training | Eval on 4 TR speakers |
|---|---|---|
| base | no | all 4 unseen |
| `l2a-ppl` | no | all 4 unseen (no folds) |
| `l2a-ppl+tr` | yes | LOSO, fold k held out |

Per speaker, compare base vs `l2a-ppl` vs `l2a-ppl+tr` (fold k) on:
- **PER**
- **Substitution recall** on the ~15 TR pairs (θ→t/s, ð→d/z, w→v, ɹ→ɾ, ŋ→n, æ/ɛ/ʌ→a)
- **Native false-positive rate** on the Fiverr reference clips (must not regress)

Two questions answered: cpl-vs-ppl proves the annotation thesis; ppl-vs-ppl+tr proves whether the Turkish data earns its place — both with speaker-independent numbers.

## Promotion gate

Ship the **best adapter as long as it does not regress vs base** (TR PER + substitution recall improve, native FPR no worse). If both regress, base `espnet/powsm` ships. Adapters are still presented as the ablation either way — the architecture does not depend on the adapter.

## Model versioning + DB (close before training)

1. **Reconcile runtime contract.** `model_versioning.md` uses `POWSM_ADAPTER` (version id → `MODELS_DIR/adapters/<v>`, reads `ACTIVE`); `mod/alignment.py` currently uses `POWSM_ADAPTER_DIR` (raw path) + a baked-in fallback. Adopt the version-id contract. Host adapters on the network volume (`adapters/l2a-cpl`, `l2a-ppl`, `l2a-ppl+tr-fold{1..4}`) + R2 mirror.
2. **Delete the baked-in `mod/assessment/adapter/`** (the failed V1 LoRA) so base is the true default fallback.
3. **Stamp provenance in the DB.** Add `model_version` (+ `lang_sym`) to assessment results and the reference precompute table — phones differ per adapter; without it an A/B is uninterpretable. Migration-gated (`schema.ts` → `db:generate` → inspect SQL → one commit; `IF NOT EXISTS`).
4. **Quarantine V1 precompute.** Re-run `precompute_references.py` with base, backfill `model_version`; treat null as "regenerate."

## Day-by-day

### Day 1 (Jun 9) — lock baseline + ship-safe base + harness
- [ ] Neutralize baked-in adapter; confirm endpoint runs base by default; redeploy (#29 prereq)
- [ ] Lock baseline PER on L2-ARCTIC annotated subset (#87/#30) and on the TR 13-set (#28, speaker-disjoint)
- [ ] Build ARPAbet→POWSM-IPA token map (`AH→ə/ʌ` by stress, `EY→eɪ` offglide) — shared by all trains + eval (#88 subtask 1)
- [ ] `model_version`/`lang_sym` migration; re-run reference precompute on base

### Day 2 (Jun 10) — train + eval
- [ ] Train `l2a-cpl`, `l2a-ppl`, `l2a-ppl+tr` ×4 folds (identical DoRA config)
- [ ] Manifests (PER on both splits, data hash, git SHA) → R2 mirror
- [ ] Run eval matrix; tabulate per-speaker base vs ppl vs ppl+tr; `+tr` as mean ± range

### Day 3 (Jun 11) — decide + write up + freeze
- [ ] Apply promotion gate; promote winner (or base); freeze
- [ ] Write result section: cpl-vs-ppl table + schwa-over-confidence symptom + convention lesson; fold into deck (#40) / poster (#39)

### Jun 12–13 — buffer + warm endpoint for live demo (#41)
