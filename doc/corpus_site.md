# CORPTES corpus explorer — architecture & data contract

Public, static website that lets a user browse the Turkish-L1 English corpus by
**phonetic feature**: pick one of five annotated features (vowels, consonants,
lexical stress, linking, intonation), or separate rhythm measurements, filter by articulatory class or multiple phones, read
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
| Clip unit | **Utterance** (ordinary chunks ≤18 s; intonation uses the exact annotated span), token seeks via `currentTime` | 300k phones ≠ 300k files; one clip serves every token in it, and is the unit intonation needs anyway |
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

`lc`/`rc` are legacy KWIC context — up to `KWIC_WINDOW` phones the speaker actually
*produced* either side of the token, so a deletion leaves no slot. They are hidden in the explorer and CSV exports. They are
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
| View transcript context for matches | Target word/phrase and click-through to the annotated utterance |
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

## Kardelen Hoca feedback (September 2026)

- The phone selector appears before articulatory classes and supports multiple
  phones. The combined concordance contains the union of their token shards.
  Existing `#/vowels/phone/ɪ` links still work; multiple selections use
  `#/vowels/phones/ɪ/ɛ` (URI-encoded by the browser).
- Left/right context columns are removed from all concordances and CSV exports.
- Target words come from the time-aligned reference word tier (`words-REF` for
  T1, `REF-words-matched` for T2), falling back to the existing word tier only
  when a reference word tier is absent. Phone ownership uses greatest temporal
  overlap. Stress/linking targets use the annotation's overlapping words.
- Stress exports `tokens/stress/all.json` for both correct and incorrect events;
  the legacy mismatch shard remains available.
- Annotation events are exported once per recording, even if their times cross
  a generic utterance chunk boundary. Intonation pattern and sentence type come
  from `Intonation_types` matched to the accuracy event's time span. Long and
  abbreviated source labels are normalized. Missing sentence types remain null
  and appear as “Not annotated”; they are never inferred from wording or pitch.
- Each intonation event has a dedicated detail and audio clip named
  `<speaker><task>_intonation_<index>`. Only that annotated interval is included,
  with no pre/post-roll. These extra details do not inflate phone statistics or
  the ordinary utterance/rhythm index. Stress/linking events outside ordinary
  chunks also receive their own detail and clip so no annotations are lost.
  Existing ordinary chunk IDs are preserved for saved phone notes.
  All rebuilt clips now start at their
  annotation origin, fixing the previous 150 ms offset between audio and tokens.
- Dictionary reference IPA is deferred until the exact corpus dictionary is
  supplied. The optional `TokenRow.referenceIpa` array is reserved for verified
  forms; the panel displays an unavailable message for incorrect words in the
  meantime. Transcribed phones must not be repurposed as reference IPA.
  The builder now accepts `--reference-ipa` with a verified JSON word-to-IPA-variants
  export. It enriches concordances and details consistently, preserves variants,
  and rejects malformed or ARPABET inputs before cleaning existing output.
  See [the source completion package](corptes-review/README.md) for exact missing
  sentence annotations, word forms, and recording filenames.

### Available local sources and publishing

The original drop is in Git-ignored `data/kardelen/`. A normalized build input
is in `corpus/processed/kardelen_normalized/` (60 TextGrids and EXBs, 52 source
recordings). The other eight recordings are absent from that input and remain
explicitly unavailable in the UI. The original dictionary is not in this drop.

```sh
python -m corpus.scripts.site_build.build --raw corpus/processed/kardelen_normalized --out corpus/site/public --clips --skip-pitch
pnpm --dir corpus/site build
```

The deployed copy is `app/public/corptes/`; copy the completed static bundle
from `corpus/site/dist/` there before the normal Fly deployment. Neither the
Python build nor the frontend build publishes to the live site.

Regression checks: `python -X utf8 corpus/scripts/site_build/tests/test_pipeline.py`,
`pnpm --dir corpus/site test`, and `pnpm --dir corpus/site build`.

### Speaking-task filter (September 2026 follow-up)

A shared All / Read-aloud (T1) / Interview (T2) selector appears above every
explorer section, including Rhythm. App-level state preserves the choice across
sections; a page reload defaults to All. Changing task resets the concordance's
local filters and pagination and closes any open token panel.
Task-specific phone and stress statistics are calculated from the same filtered
shards as the tables and CSV exports. Existing static JSON requires no rebuild.
Dedicated annotation IDs and ordinary utterance IDs share the exporter’s
`{speaker}{task}_` recording prefix; `taskFilter.ts` resolves it using explicit
manifest task metadata. Regression tests verify that this lookup matches every
detail file, including intonation windows, and that T1 + T2 preserves all tokens.
