# CORPTES: remaining source data

The interface changes are implemented. The following values cannot be recovered
from the supplied corpus files and must come from the corpus compiler.

- The exact pronunciation dictionary used for this corpus. `missing-reference-ipa.csv`
  lists target words with incorrect productions that currently have no dictionary IPA.
- `missing-sentence-types.csv` lists all 171 intonation events whose source annotation
  specifies a pattern but no sentence type. Fill the last column with the verified
  label; do not infer research annotations from sentence wording.
- Missing interview audio: `S14T2.wav`, `S16T2.wav`, `S17T2.wav`, `S18T2.wav`, `S20T2.wav`, `S29T2.wav`, `S7T2.wav`, `S8T2.wav`.

Both original EXB copies were checked; the missing sentence types are absent in
both. The original task folders and COMA copy were checked for the missing audio.
No substitute pronunciations, generated audio or guessed annotations were used.

## Importing verified reference IPA

The corpus builder accepts `--reference-ipa path/to/verified-reference.json`.
Supply a JSON object whose keys are target words and values are lists of IPA
pronunciation variants exported from the exact corpus dictionary. Empty or
ARPABET/numeric-stress values are rejected. The import preserves multiple forms,
matches words case-insensitively, and updates phone/stress tables and detail panels.
Words absent from the dictionary remain explicitly unavailable. This option is
optional until the original dictionary is supplied; it does not obtain one.

Run the documented corpus build with this additional option, rebuild the site,
and copy its output to `app/public/corptes` before publishing.
