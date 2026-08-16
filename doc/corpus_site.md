# CORPTES corpus explorer — architecture & data contract

Public, static website that lets a user browse the Turkish-L1 English corpus by
**phonetic feature**: pick one of five annotated features (vowels, consonants,
lexical stress, linking, intonation), or separate rhythm measurements, filter by articulatory class or a single phone, read
correct/incorrect statistics, and inspect any token in context with audio.

This is the deliverable Kardelen Kılınç (Eskişehir Technical University) asked
for — a feature-based view of the corpus, in the spirit of the EXAKT
concordance/frequency tools, hosted separately and linked from the department
site. It is **not** a fork of EXMARaLDA (a Java desktop app); we reuse only the
`.exb`/`.coma` file format and EXAKT's *concepts*.

**Licence, and why it matters.** EXMARaLDA ships under **GPL v2**
(`src/META-INF/license.txt` in [Exmaralda-Org/exmaralda](https://github.com/Exmaralda-Org/exmaralda);
GitHub's detector misses it because the file is not at the repo root). Porting
EXAKT's Java would make this site a derivative work and force it to GPL v2 too.
Reading their file format and reimplementing the concepts does not. Keep it that
way: do not copy code from that repo into this one.

- Pipeline: `corpus/scripts/site_build/` (Python)
- Frontend: `corpus/site/` (Vite + React + TS + Tailwind v4)

## Design decisions (locked)

| Decision | Choice | Why |
|---|---|---|
| Source of correct/incorrect | Corpus-native hand annotation | Reflects the corpus annotators’ judgment, not an inferred model decision |
| Error definition | **Correct / incorrect** | The public export does not invent substitution or omission categories |
| Rhythm | Presented as **measurements**, not correct/incorrect | An nPVI value has no single right answer |
| Audio | **Short clips only** (utterance-level), never full recordings | Interview audio may carry PII; clips bound the exposure |
| Architecture | **Static site, no DB/server/auth** | Corpus is frozen; every aggregate is precomputed once |
| Clip unit | **Utterance** (~≤18 s), token seeks via `currentTime` | 300k phones ≠ 300k files; one clip serves every token in it, and is the unit intonation needs anyway |
| Prose (corpus description, citation, licence) | **A Markdown file in the repo**, `corpus/site/src/content/about.md` | Kardelen Hoca supplies the text; it is version-controlled with the site and needs no CMS |
| User annotations (EXAKT's "own analysis categories") | **localStorage, export-only** | Persisting them server-side would mean a backend and accounts, which the static-site decision rules out. Notes ride out in the CSV instead; the UI states the limitation |

## Areas and where the data comes from

| Area | Needs audio? | Source |
|---|---|---|
| Vowels / Consonants | no | corpus-native `phoneAcc` |
| Lexical stress | no | corpus-native `Stress_accuracy` |
| Linking | no | corpus-native `linkingAcc_accuracy` |
| Rhythm | no | segment durations → %V, nPVI, Varco, ΔC |
| Intonation | no | corpus-native `Intonation_accuracy` |

If a phone tier is missing (a file with only one of `phones`/`REF-phones`), that
file becomes **inventory-only** — its phones are listed but contribute no
correct/incorrect, and the build reports it. See `verify.py`.

## Pipeline

```
raw drop (.exb + .TextGrid + .wav)
   │
   ├─ textgrid.py   parse PRAAT tiers (intervals + times)
   ├─ exb.py        parse EXMARaLDA (speaker metadata, annotation tiers)
   ├─ inventory.py  IPA → articulatory classes (the filter tree)
   ├─ align.py      fallback only for synthetic/test material
   ├─ rhythm.py     durational metrics per utterance
   ├─ intonation.py F0 contour per utterance (optional backend)
   └─ emit.py       write the JSON artifact tree
```

Run:

```bash
# 1. verify the drop answers the open questions (paired tiers? stress marks? metadata?)
python -m corpus.scripts.site_build.verify --raw "$CORPUS_RAW_DIR"

# 2. build the site data (add --clips to cut audio; needs ffmpeg)
python -m corpus.scripts.site_build.build --raw "$CORPUS_RAW_DIR" --out corpus/site/public --clips

# 3. run the site
cd corpus/site && pnpm install && pnpm dev
```

No real data yet? Generate a realistic demo corpus (clearly marked synthetic):

```bash
python corpus/scripts/site_build/demo_corpus.py --out /tmp/demo_raw --speakers 24 --audio
python -m corpus.scripts.site_build.build --raw /tmp/demo_raw --out corpus/site/public --clips
```

## JSON artifact contract

Everything lives under `corpus/site/public/data/` (git-ignored; regenerated):

```
data/
  manifest.json                build meta, speakers, filter tree, utterance index, audio coverage
  areas/vowels.json            per-phone {total, correct, incorrect, accuracy}
  areas/consonants.json
  areas/lexical-stress.json    {total, correct, incorrect, marksPresent, byPhone[]}
  tokens/<area>/<phone>.json   token shard: every annotated phone/site
  tokens/stress/mismatch.json  stress-mismatch tokens for the stress concordance
  utterances/<uid>.json        annotated tokens + rhythm + optional clip path
clips/<uid>.mp3                short per-utterance audio (if --clips)
```

Token row keys are terse (shards are large): `id, u, spk, ph, e, t0, t1,
se?, le?, w?, lc?, rc?`. See `corpus/site/src/lib/types.ts` for the typed mirror.

`lc`/`rc` are the KWIC context — up to `KWIC_WINDOW` phones the speaker actually
*produced* either side of the token, so a deletion leaves no slot. They are
precomputed in `build.py` rather than derived in the browser: deriving them would
mean fetching the whole utterance JSON for every visible row.

Sharding per annotated phone keeps every fetch small: the "/b/ only" drill loads
one file, not the whole 300k-token table.

### Synthetic-data flag

`demo_corpus.py` drops a `.synthetic` marker in the raw dir; `build.py` looks for
it and sets `manifest.build.synthetic`. When true the site shows a standing
"demonstration data" banner on every page. This exists so a demo build can never
be mistaken for the corpus — keep the two constants in sync if either moves.

## Prose content

The **About** tab renders `corpus/site/src/content/about.md`. Sections marked
with a `>` blockquote callout are placeholders for Kardelen Hoca (corpus
purpose, collection method, speakers, transcription conventions, citation,
licence); the rest documents how the site derives what it shows and should track
the pipeline. Editing the file and rebuilding is the whole workflow — there is no
CMS and no other place prose lives.

Markdown is rendered by `src/lib/markdown.tsx`, a ~200-line subset renderer
(headings, paragraphs, lists, blockquotes, rules, inline emphasis/code/links).
It returns React nodes, never HTML, so there is no injection surface and no
Markdown dependency. Anything outside that subset renders as literal text.

## EXAKT parity

Kardelen Hoca's brief is "tool'un sunduğu özellikleri sitede de sunabilmeyi
hedefliyoruz" — offer EXAKT's features on the web. Against the capabilities
[EXMARaLDA advertises for EXAKT](https://exmaralda.org/en/exakt-en/):

| EXAKT | Here |
|---|---|
| Query with regular expressions | Search box, `.*` toggles regex. Matched per field, so anchors behave |
| View transcript context for matches | KWIC columns (`lc`/`rc`), plus click-through to the full utterance |
| Play the audio for a match | Clip player, seeks to the token |
| Filter **and sort** query results | Outcome / sex / CEFR filters; every column sortable |
| Correlate with speaker metadata | Speaker column + metadata filters; metadata in the export |
| Add your own analysis categories | Note column — browser-local, carried out in the CSV (see decisions table) |
| Export to Excel | CSV with a UTF-8 BOM, so Excel renders IPA instead of mojibake |

The one axis we deliberately do **not** copy is EXAKT's recording-first
navigation. The filter tree is the query surface for phonetic features, which is
the whole point of this corpus view.

## Open items for the teacher (data, not code)

The pipeline is complete and verified against a synthetic corpus; these need the
real drop or a decision from Kardelen Hoca:

1. **Speaker metadata** — comes from the `.exb` `speakertable` (`sex`, `l1`, `l2`
   + `ud-information` keys like `age`, CEFR). Confirm which keys are populated.
2. **Paired tiers** — does every file carry both `phones` and `REF-phones`?
   `verify.py` reports single-tier files.
3. **Stress marks** — are ˈ/ˌ present in the phone tiers? If not, lexical stress
   needs hand-labelling. `verify.py` answers this.
4. **Consent** — does participant consent cover publishing short audio clips?
5. Numbers may differ from the thesis's EXAKT counts (different alignment +
   strict identity) — say so up front.
