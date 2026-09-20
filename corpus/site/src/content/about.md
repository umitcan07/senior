# About CORPTES

CORPTES (Corpus Phonology of Turkish EFL Learners) is a phonologically
annotated learner-speech corpus developed as part of the 2026 doctoral
dissertation *An Analysis of L2 Learner Pronunciation and Intelligibility:
Developing a Phonological Corpus of Turkish Learners of English (CORPTES)*.
It supports research on English pronunciation by Turkish learners, especially
the relationship between pronunciation and speech intelligibility.

## What the corpus contains

CORPTES contains recordings from 30 Turkish EFL learners in two complementary
tasks: a controlled read-aloud task and elicited spontaneous speech. It combines
audio, orthographic and phonological information, multilayer annotations and
speaker information in the EXMARaLDA corpus environment.

The explorer reports five annotated pronunciation features: vowels,
consonants, lexical stress, linking and intonation. Rhythm is also available
as a separate set of durational measurements. Linking and rhythm are distinct:
linking is a hand-annotated word-boundary judgment.

## Who can use CORPTES

CORPTES is intended for researchers in second-language acquisition, L2
phonology, learner and speech corpora, CAPT and speech technology; teachers,
teacher educators, curriculum and materials developers; and Turkish learners
who want to develop pronunciation awareness from authentic learner speech.

## CORPTES for self-study

Learners can explore common patterns in vowels, consonants, lexical stress,
linking and intonation, compare productions in context, and use short clips
where audio is available. CORPTES does not promote imitation of one native
speaker model; its pedagogical focus is intelligible, effective communication.

---

## Using this site

Pick a pronunciation feature or the rhythm measurements in the sidebar. **Vowels** and
**Consonants** can be narrowed further — by articulatory class (manner, place,
voicing, and the sounds Turkish does not have), or by selecting one or more phones near the top of the sidebar.

Each phone shows its corpus-annotated correct/incorrect rate. Below that, the concordance lists **every**
production of the selected phones, with its target word, speaker, outcome,
and timestamp. Click any row to open the utterance — you get a
short audio clip where the source recording is available, the annotated phone
sequence and rhythm measures.

The concordance is a working surface, not just a table:

- **Search** across target text, phone, annotation and speaker. The `.*`
  button switches the query to a regular expression, matched against each field
  in turn — so `^(bit|job)$` means "exactly this word".
- **Sort** by any column: click a heading, click again to reverse.
- **Filter** by outcome and by speaker sex where that metadata is available.
- **Annotate** any token with your own note in the Note column. Notes are saved
  in your browser only — they are not uploaded, not shared, and will not survive
  clearing your browser data. Export the CSV to keep them.
- **Export** the current result set to CSV, including target text, annotation categories and your notes.

**Lexical Stress** lists the target word; **Linking** lists the target phrase.
**Intonation** can be filtered by pattern (Falling, Rising, Rise & Fall) and
sentence type (such as Yes/No Question or Wh Question). A missing source label
is shown as “Not annotated”.

## How correct and incorrect are decided

Correct/incorrect figures are the corpus annotators’ own judgments in the
`phoneAcc`, `Stress_accuracy`, `linkingAcc_accuracy` and
`Intonation_accuracy` tiers. They are not machine predictions and this site
does not infer substitutions, omissions or confusions that the corpus does not
annotate.

## What is reported but not graded

**Rhythm** is presented as a measurement, with no correct/incorrect verdict
attached. Intonation may also include a corpus-native annotation judgment;
the F0 contour remains supplementary evidence rather than an automatic grade.

This is deliberate. An nPVI value has no single right answer —
a rising nucleus is information about how the utterance was produced, not an
error. Grading them would mean inventing a target that the corpus does not
contain. So the rhythm page reports the corpus distribution beside published
reference bands for English, and the intonation page shows the annotated pattern, sentence type and target
utterance. Opening a row plays only that annotated utterance.

## Filtering by speaking task

The Speaking task filter at the top of every explorer section offers All,
Read-aloud and Interview. Your selection carries across sections and applies to
their statistics, concordance rows and CSV exports. Rhythm uses the same selection
for its utterance sample. Reloading the page starts with All.

## Known limitations

- Counts may differ from figures obtained with EXMARaLDA's EXAKT tool over the
  same corpus because this site presents its own static export of the corpus
  annotations.
- Audio is published as short utterance-level clips, never as whole recordings;
  a small number of recordings have no source audio and are clearly marked.

- Incorrect vowel, consonant and stress records show general American English
  dictionary reference pronunciations where the target word is covered. These
  come from the English (US) ARPA dictionary v3.0.0, converted to broad IPA;
  primary, secondary and unstressed vowel labels are shown separately in order.
  No syllable boundaries are inferred. Variants are alternatives, not separate
  correctness judgments. This is a public dictionary reference, not a claim about
  the dictionary used by the corpus compiler, and does not alter corpus labels.
  Source: Montreal Forced Aligner; Gorman, Howell and Wagner (2011),
  [English (US) ARPA dictionary v3.0.0](https://mfa-models.readthedocs.io/en/latest/dictionary/English/English%20(US)%20ARPA%20dictionary%20v3_0_0.html),
  adapted under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
  Unmatched word forms remain unavailable rather than being guessed.
- Some intonation annotations specify the pattern but omit the sentence type;
  the explorer preserves this distinction rather than guessing the missing label.

## Citing this corpus

Please acknowledge CORPTES and cite Kardelen Kılınç’s 2026 doctoral
dissertation when using the corpus for research, publication or teaching.
Contact the corpus compiler for the definitive citation format or access terms.

## Contact and licence

For corpus access, use, collaboration or further information, contact Dr.
Kardelen Kılınç, Eskişehir Technical University School of Foreign Languages:
kardelenkilinc@eskisehir.edu.tr. Reuse of data and audio is subject to the
corpus compiler’s conditions.
