# Turkish-L1 sound tests for POWSM (blind-spot probes)

## Why

POWSM maps Turkish sounds it wasn't trained on onto the nearest English phone. The worked
example: a clip of *"the man sent the cup back to us"* spoken with **`ɯ` (Turkish ı) in every
vowel** was recognized with **`ɯ` 0 / ~8** — every vowel came back as `ə/ɛ/u/ʊ`, and `/ɯ/` never
exceeded 0.002 posterior. Root cause is the training data: the fine-tune corpus labels contain
**0** `ɯ` (English-only IPA). See `doc/phone_inventory_corpus_vs_model.md` and the memory
`powsm-blind-to-turkish-i`.

This plan lists the Turkish sounds worth the same controlled treatment, the words to record, and
how to score each clip. **Every candidate below is already in POWSM's 40,002-token vocab**, so a
miss is always training/acoustic — never a hard vocab gap.

## Coverage data (the ranking)

| sound | Turkish | in vocab | corpus labels | model output (125 clips) | test type |
|---|---|---|---|---|---|
| `ɯ` | ı | ✓ | 0 | **0** | ✅ done — 0/~8 recall |
| `y` | ü | ✓ | 0 | **0** | **presence (prime)** |
| `ø` | ö | ✓ | 0 | **0** | **presence (prime)** |
| `œ` | (ö var) | ✓ | 4 | **0** | presence |
| `ɾ` | r (tap) | ✓ | 263 | **0** | presence — maps to `ɹ`/`r` |
| `ɰ`/`ɣ` | ğ | ✓ | 0 | **0** | special (length/glide, not a segment) |
| `ʋ` | v | ✓ | 0 | **0** | confusion `v`/`w`/`ʋ` |
| `ʉ` | (ü-proxy) | ✓ | 1911 | 3 | model collapses corpus's ü catch-all |
| `ɟ` | g→front V | ✓ | 218 | 2 | near-blind |
| `c` | k→front V | ✓ | 1035 | 21 | accuracy |
| `ɲ` | n (palatal) | ✓ | 481 | 15 | accuracy |
| `ʎ` | l (palatal) | ✓ | 687 | **57** | accuracy (already produced) |
| `ɫ` | dark l | ✓ | 1663 | `l̴`=36 | accuracy (produced, decomposed form) |

**Priority order:** `y` (ü), `ø` (ö) → tap `ɾ` and epenthetic `ɯ`/`i` → `ğ`, `v` → palatal accuracy.

## Conventions for target IPA

Per the memory `turkish-reannotation-convention`:
- **Monophthongs**; diphthong offglides as the vowels **`ɪ`/`ʊ`** (`aɪ eɪ oʊ aʊ ɔɪ`), **not** `j`/`w`
  (so `ay`→`aɪ`, `köy`→`køɪ`). Onset *y* is the consonant `j` (`yıl`→`jɯɫ`); post-vocalic *y* is the
  `ɪ` offglide.
- Turkish **r = tap `ɾ`** (final r often devoiced). **k/g before front vowels → palatal `c`/`ɟ`**.
  **l = clear `l`** before/after front vowels, **dark `ɫ`** with back vowels.

IPA below is a **first pass** to seed annotation — confirm against the audio when you record.

---

## Recording script + target IPA

### Group 1 — vowels English lacks (PRESENCE tests, highest value)

**Method A — carrier sentence (mirrors the `ɯ` test, gives clean N-of-8 recall).** Record the same
carrier *"the man sent the cup back to us"* (~8 vowel slots) three times, forcing **every vowel** to:
`ı`/`ɯ` (done), then **`ü`/`y`**, then **`ö`/`ø`**. Score = how many of the ~8 vowels come back as the
target.

**Method B — Turkish minimal-pair words** (real lexical context):

| word | gloss | target IPA | isolates |
|---|---|---|---|
| kıl | body hair | `kɯɫ` | ı `ɯ` (+ dark ɫ) |
| kil | clay | `kil` | i (clear l) |
| kul | servant | `kuɫ` | u |
| **kül** | ash | `cyl` | **ü `y`** (+ palatal c) |
| **gül** | rose | `ɟyl` | **ü `y`** (+ palatal ɟ) |
| **üzüm** | grape | `yzym` | **ü `y`** ×2 |
| **dün** | yesterday | `dyn` | **ü `y`** |
| **göz** | eye | `ɟøz` | **ö `ø`** |
| **söz** | word | `søz` | **ö `ø`** |
| **dört** | four | `døɾt` | **ö `ø`** (+ tap ɾ) |
| **gözlük** | glasses | `ɟøzlyc` | **ö `ø`** + **ü `y`** |
| kel | bald | `cel` | e (palatal c) |
| kol | arm | `koɫ` | o (dark ɫ) |

Expect: `kül/gül/üzüm/dün` → `y` never appears (collapses to `u`/`ʊ`/`i`); `göz/söz/dört` → `ø` never
appears (collapses to `o`/`ɔ`/`ø`→`e`).

### Group 2 — Turkish tap `ɾ` vs English `ɹ` (§4 `ɹ→ɾ`)

| word | gloss | target IPA |
|---|---|---|
| ara | interval | `aɾa` |
| araba | car | `aɾaba` |
| bir | one | `biɾ` (final, often devoiced `ɾ̥`) |
| kar | snow | `kaɾ` |
| dört | four | `døɾt` |
| renk | colour | `ɾeŋc` |

Expect the model to output `ɹ` or `r`, never the tap `ɾ`.

### Group 3 — soft-g `ğ` (special: realized as length / `j`-glide, not a segment)

| word | gloss | target IPA |
|---|---|---|
| dağ | mountain | `daː` |
| ağ | net | `aː` |
| yağmur | rain | `jaːmuɾ` |
| değil | not | `dejil` |
| öğle | noon | `øːle` |

Test = does the model capture the **lengthening/glide** (not whether it emits a `ğ` segment).

### Group 4 — Turkish `v` `[ʋ]` and `w→v` (§4)

| word | gloss | target IPA |
|---|---|---|
| var | exists | `vaɾ` |
| ev | house | `ev` |
| kahve | coffee | `kahve` |
| wine (En) | — | `vaɪn` (Turkish-L1 realization of *wine*) |
| vine (En) | — | `vaɪn` (same → minimal-pair collapse) |

### Group 5 — palatal allophones (ACCURACY, not presence — model already emits these)

Front-vowel (palatal) vs back-vowel (plain) minimal pairs — does the model palatalize correctly?

| pair | target IPA | contrast |
|---|---|---|
| kel / kar | `cel` / `kaɾ` | k → `c` vs `k` |
| gel / gar | `ɟel` / `ɡaɾ` | g → `ɟ` vs `ɡ` |
| gör / gol | `ɟøɾ` / `ɡoɫ` | `ɟ`+`ø` vs `ɡ`+`o`+dark ɫ |
| dil / dolu | `dil` / `doɫu` | clear `l` vs dark `ɫ` |

### Group 6 — phonotactic processes (high Turkish-L1 value)

**Epenthesis** — clusters broken with `ɯ`/`i` (compounds with Group 1: the inserted vowel is itself blind):

| word | gloss | target IPA |
|---|---|---|
| spor | sport | `sɯpoɾ` |
| tren | train | `tiɾen` |
| grup | group | `ɡuɾup` |
| film | film | `filim` |
| speak (En) | — | `sɯpik` |

**Final devoicing** — `b d ɡ v z → p t k f s` word-finally:

| word | gloss | target IPA |
|---|---|---|
| kitap | book (`kitab-ı`) | `kitap` |
| renk | colour | `ɾeŋc` |
| club (En) | — | `kɫap` |
| five (En) | — | `faɪf` |

---

## How to score a test clip

The same probe used for the `ɯ` clip (template: R2 key
`users/user_3830X0ax0Q665rr9nzqhRwXKpdk/recordings/2067dc0a-8ab6-4a98-a0e8-02314ce4a02c.webm`):

1. Record → R2 (or save a local 16 kHz mono wav).
2. If `.webm`/Opus: `ffmpeg -i clip.webm -ar 16000 -ac 1 clip.wav`.
3. In the dev worker: `alignment.get_aligner().free_alignment(audio)` for the heard phones, and
   `encode(audio)` → `exp(logprobs)` for the per-frame CTC posterior.
4. **Metric per target sound:** recall = (# segments the model output as the target) / (# times it was
   actually produced); plus the target's peak posterior and whether it ever enters a frame's top-3.
   Baseline expectation: the "presence" rows above score ~0.

`mod/dev/poc_feature_diff.py` and `mod/dev/verify.py` are the existing harnesses to extend if these
become a committed regression set.

## Status

- `ɯ` (ı): **tested — 0 / ~8 recall**, peak posterior 0.002, never top-3.
- `y` (ü), `ø` (ö), tap `ɾ`, epenthetic `ɯ`/`i`: **to record** (priority order above).
- Use these as the controlled before/after for any re-annotation + re-fine-tune that adds `ɯ`/`ı`.
