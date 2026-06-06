# Nounce — Validation Sentences (V2 reference corpus)

Source-of-truth for the 25 native-reference recordings (Epic E4, issue #24).
Each sentence is recorded in **two dialects** — General American (GenAm) and
Received Pronunciation (RP) — by voice talent. The `ref_NNN` identifiers below
are our internal sentence IDs (used for DB ingest and alignment); the recording
may be delivered as one continuous take or as separate clips.

These 25 were curated from a 50-sentence draft pool to **maximize coverage of
the Turkish-critical categories per line while staying natural** — drill-like,
alliterative, and tongue-twister lines were dropped in favour of conversational
ones that brush their target sounds at a natural rate.

## Design principles (see `doc/V2_CONTEXT.md` §4.5)

- **Natural and conversational.** Everyday vocabulary, no tongue twisters, no
  alliteration, no obvious phonetic showpieces. A learner shadowing the line
  should not feel "tested" and self-correct.
- **7–14 words** each, with mild length variation for prosody (recording UI caps
  at 20 s). No ultra-short fragments; no bloated run-ons.
- A target sound appears at its **natural rate** — coverage is achieved across
  the set, not crammed into a single line.
- Spread across the phonetic categories below plus natural daily-use lines for a
  general fluency baseline.

## Coverage map

| Category (Turkish-L1 difficulty) | Sentences |
|---|---|
| `/θ/` `/ð/` — Turkish lacks both dental fricatives | 002, 005, 010, 012, 014 (+ `/ð/` *the/this/they/mother* throughout) |
| `/w/` vs `/v/` — no `/w/` in Turkish | `/w/` 005, 008, 012, 022, 023 · `/v/` 002, 007, 015, 019 |
| `/æ/` vs `/ɛ/` vs `/ʌ/` — collapse toward `[a]`/`[ɛ]` | 003, 004, 011, 016 |
| Syllable-final `/ɹ/` — tap/trill or dropped (GenAm↔RP discriminator) | 002, 005, 006, 008, 009, 012, 015, 016, 018, 021, 025 |
| Final-position voicing — Turkish devoices final obstruents | 001, 004, 006, 009, 014, 017, 022, 024 |
| Onset consonant clusters `/sC/` — Turkish breaks with epenthesis | 004, 010, 024 (+ *film* epenthesis 017) |
| Schwa `/ə/` / vowel reduction — no reduction in Turkish | 002, 013, 016 |
| `/ŋ/` vs `/n/`+`/g/` | 005, 008, 010, 012, 016, 019 |
| `/ɪ/` vs `/iː/` — length distinction lost (*ship*/*sheep*) | 007, 014, 018, 019 |
| Clear `/l/` vs dark/velarized `/ɫ/` (onset vs coda/syllabic) | 001, 008, 009, 011, 012, 014, 018, 019, 020, 022, 024, 025 |
| `/k/`–`/g/` velar plosives + hard/soft *c* | 001, 003, 008, 013, 014, 015, 020, 023, 024, 025 |
| `/h/` glottal fricative | 013, 020, 023 |
| Intervocalic flap & glottalized `/t/` (US flap ↔ UK `[t]`/glottal) | 011, 021 *(edited)*, 022 |
| Diphthongs (often split into two syllables) | 004, 006, 009, 013, 017, 018, 021, 023 |
| Daily-use (general fluency baseline) | 015, 023, 025 |

## Sentences

| ID | Sentence | WC | Targets it brushes (naturally) |
|---|---|---|---|
| `ref_001` | I left my keys on the kitchen table again. | 9 | clear/dark `/l/`; `/k/` *kitchen*; final-voice *keys* |
| `ref_002` | She wants to visit her family next month, maybe around the holidays. | 12 | `/v/` *visit*; `/θ/` *month*; dark `/l/`; final `/ɹ/`; schwa |
| `ref_003` | The man sent the cup back to us. | 8 | `/æ ɛ ʌ/` *man·sent·cup*; `/k/` *cup·back*; `/ð/` *the* |
| `ref_004` | They moved into a much bigger house just last spring. | 10 | final-voice *moved*; `/ʌ/` *much*; `/sC/` *spring*; `/aʊ/` *house* |
| `ref_005` | We saw three deer near the river while walking early this morning. | 12 | `/θ/` *three*; final `/ɹ/` *deer·near·river·early*; `/ŋ/`; `/w/` |
| `ref_006` | My brother bought a shiny new red car last weekend. | 10 | `/ð/` *brother*; final `/ɹ/` *brother·car*; final-voice *red*; `/ʃ/` |
| `ref_007` | These cheap seats are not very big. | 7 | `/ɪ–iː/` *these·cheap·seats* vs *big*; `/v/` *very* |
| `ref_008` | She always drinks her morning coffee black, without any sugar. | 10 | dark `/l/`; `/k/` *black·coffee*; `/ŋ/` *morning*; final `/ɹ/`; `/ð/` |
| `ref_009` | Could you please turn off the lights before bed? | 9 | clear `/l/` *lights*; final `/ɹ/` *turn·before*; final-voice *bed* |
| `ref_010` | She really enjoys speaking both English and a little French. | 10 | `/ɔɪ/` *enjoys*; `/ŋ/` *speaking·English*; `/θ/` *both*; `/sp/`; `/l/` |
| `ref_011` | Could you please pass me the salt and the bottle of water? | 12 | glottal `/t/` *bottle·water*; dark `/l/`; final `/ɹ/`; `/æ/` *pass* |
| `ref_012` | The weather looks lovely, so I think we'll go for a long walk later. | 14 | `/ð/`+`/θ/`; `/l/` *lovely·we'll·long·walk·later*; `/w/`; `/ŋ/`; `/oʊ/` |
| `ref_013` | He found a nice little apartment downtown, close to his office. | 11 | `/aʊ/` *found·downtown*; `/h/` *he·his*; soft-c *nice·office*; `/k/` |
| `ref_014` | I think we should leave a little early to beat the traffic. | 12 | `/θ/` *think*; `/l/` *leave·little*; `/k/` *traffic*; final-voice *leave* |
| `ref_015` | I'd love to grab a coffee after work. | 8 | final-voice *love*; `/k/` *coffee*; final `/ɹ/` *after·work*; `/v/` |
| `ref_016` | I completely forgot to bring my umbrella again this morning. | 10 | `/l/` *completely*; `/ʌ/` *umbrella*; `/ŋ/` *bring·morning*; schwa |
| `ref_017` | We watched a really good film together on Friday night. | 10 | epenthesis *film*; `/l/`; `/ð/` *together*; final-voice *good*; `/aɪ/` |
| `ref_018` | Let's meet at that new little place near the park around noon. | 12 | `/l/` *let's·little*; `/ð/`; final `/ɹ/` *near·park·around*; `/uː/`; `/iː/` |
| `ref_019` | They love walking along the beach together almost every evening. | 10 | `/ŋ/` *walking·along·evening*; `/l/`; `/ð/`; final-voice *love*; `/iː/` |
| `ref_020` | He carefully put all the books back on the shelf. | 10 | dark `/l/` *carefully·all·shelf*; `/h/` *he*; `/k/` *books·back*; `/ʊ/` |
| `ref_021` | I'm not sure who edited the final report. | 8 | intervocalic flap `/t d/` *edited* (US flap ↔ UK `[t]`); final `/ɹ/` *sure·report*; `/l/` *final* |
| `ref_022` | Please close the window before you leave; it's getting really cold. | 11 | final-voice *close·leave·cold*; glottal *getting*; dark `/l/`; `/w/` |
| `ref_023` | Do you want to come over this weekend and help me paint the kitchen? | 14 | `/uː/` *do*; `/w/` *want·weekend*; `/h/` *help*; dark `/l/`; `/k/`; `/eɪ/` |
| `ref_024` | I usually like to read a good book before I fall asleep. | 12 | `/ʒ/` *usually*; `/l/` *like·fall·asleep*; final-voice *read·good*; `/k/` |
| `ref_025` | Don't forget to call your mother back tomorrow, okay? | 9 | final `/ɹ/` *forget·your·mother·tomorrow*; dark `/l/` *call*; `/k/` |

<!-- Provenance (draft pool → final): 001←026, 002←029, 003←006, 004←035, 005←044,
006←030, 007←020, 008←038, 009←027, 010←045, 011←034, 012←031, 013←047, 014←032,
015←022, 016←043*, 017←036, 018←039, 019←049, 020←033, 021←037, 022←046, 023←041,
024←048, 025←050. (*043 re-included over an earlier drop to anchor schwa+/ŋ/.
021 rewritten from 037 to feature *edited* as an intervocalic-flap probe.) -->
