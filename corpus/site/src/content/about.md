# About this corpus

The sections marked with a callout are for the corpus compiler to write — the
rest describes how this site derives what it shows and should stay accurate to
the pipeline. Edit this file and rebuild; nothing else needs to change.

## What this corpus is

> **To be written by Kardelen Kılınç.** What the corpus is for, what research
> question it was built to answer, and what a visitor should expect to find in
> it. A short paragraph or two is plenty.

## How the recordings were collected

> **To be written by Kardelen Kılınç.** The elicitation tasks (what the two
> tasks were, what participants were asked to do), the recording setup, and when
> and where the sessions took place.

## Who the speakers are

> **To be written by Kardelen Kılınç.** Recruitment, proficiency range and how
> it was established, and anything a reader needs in order to judge how far the
> findings generalise. The speaker counts on this page are read from the corpus
> itself, so they do not need repeating here.

## How the transcriptions were made

> **To be written by Kardelen Kılınç.** Who transcribed, against what
> conventions, and whether any inter-annotator agreement was measured.

---

## Using this site

Pick one of the five pronunciation areas in the sidebar. **Vowels** and
**Consonants** can be narrowed further — by articulatory class (manner, place,
voicing, and the sounds Turkish does not have), or down to a single phone.

Each phone shows its accuracy, how often it was substituted or omitted, and what
it was most often realised as. Below that, the concordance lists **every**
production of that phone in the corpus, in the classic keyword-in-context
layout: the phones produced either side of it, the word it occurred in, the
speaker, and its timestamp. Click any row to open the utterance — you get the
audio clip, the aligned phone sequence, the pitch contour, and the rhythm
measures for that utterance.

The concordance is a working surface, not just a table:

- **Search** across word, target, realisation, context and speaker. The `.*`
  button switches the query to a regular expression, matched against each field
  in turn — so `^(bit|job)$` means "exactly this word".
- **Sort** by any column: click a heading, click again to reverse.
- **Filter** by outcome, by speaker sex, and by proficiency level.
- **Annotate** any token with your own note in the Note column. Notes are saved
  in your browser only — they are not uploaded, not shared, and will not survive
  clearing your browser data. Export the CSV to keep them.
- **Export** the current result set to CSV, including context and your notes.

## How correct and incorrect are decided

A production counts as **correct only if it matches the reference phone
exactly**. There is no tolerance table and no partial credit: `/θ/` realised as
`/t/` is an error, and so is `/ɪ/` realised as `/i/`.

The comparison is between two tiers of the corpus annotation — the learner's
transcribed `phones` tier and the reference `REF-phones` tier — aligned with a
Needleman–Wunsch edit-distance alignment. That alignment yields four outcomes
per position: correct, substituted, omitted, and inserted.

Two consequences worth stating plainly:

- **These figures come from the corpus annotation, not from a speech model.**
  Nothing on this site is a machine prediction of correctness.
- **Stress and length mismatches are counted separately** from segmental errors.
  A vowel can be the right vowel yet carry the wrong stress; that case is a
  lexical-stress mismatch, not a vowel error. Such rows carry a ˢ or ˡ badge.

## What is reported but not graded

**Rhythm** and **intonation** are presented as measurements, with no
correct/incorrect verdict attached.

This is deliberate. An nPVI value or an F0 contour has no single right answer —
a rising nucleus is information about how the utterance was produced, not an
error. Grading them would mean inventing a target that the corpus does not
contain. So the rhythm page reports the corpus distribution beside published
reference bands for English, and the intonation page shows contours for
inspection.

## Known limitations

- Counts here may differ from figures obtained with EXMARaLDA's EXAKT tool over
  the same corpus. The alignment method and the strict-identity error definition
  are not the same, so the two are not expected to agree exactly.
- Where a recording carries only one phone tier, there is nothing to align
  against. Those files contribute to the phone inventory but not to any
  correct/incorrect figure.
- Lexical stress is only measured where stress marks are present in the
  transcription.
- Audio is published as short utterance-level clips, never as whole recordings.

## Citing this corpus

> **To be written by Kardelen Kılınç.** The citation you want users to give,
> and a DOI or permanent link if there is one.

## Contact and licence

> **To be written by Kardelen Kılınç.** Who to contact about the corpus, the
> terms under which the data and audio may be reused, and the ethics approval
> the recordings were collected under.
