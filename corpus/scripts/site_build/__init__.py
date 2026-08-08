"""Static-site build pipeline for the CORPTES corpus explorer.

Reads the EXMARaLDA drop (`.exb` + PRAAT `.TextGrid` + `.wav`) and emits the
precomputed JSON artifacts consumed by `site/`. No database, no server: the
corpus is frozen, so every aggregate is computed once at build time.

Module map:

  inventory    IPA phone table -> articulatory classes (drives the filter tree)
  textgrid     PRAAT TextGrid parser (intervals + tier names)
  exb          EXMARaLDA basic-transcription parser (speakers, metadata, tiers)
  align        actual <-> reference phone alignment -> per-token error records
  rhythm       nPVI / %V / VarcoC durational metrics per utterance
  intonation   F0 contours via parselmouth (optional dependency)
  emit         JSON artifact writers (summary, shards, utterances)

See `doc/corpus_site.md` for the data contract these modules produce.
"""
