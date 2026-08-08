# CORPTES Explorer

Static website for browsing the Turkish-L1 English pronunciation corpus by
phonetic feature. Vite + React + TypeScript + Tailwind v4. No backend — it reads
a precomputed JSON tree produced by the `site_build` pipeline.

Full architecture and data contract: [`doc/corpus_site.md`](../../doc/corpus_site.md).

## Develop

```bash
pnpm install

# Produce the data the site reads (from the real corpus, or a demo):
python -m corpus.scripts.site_build.build --raw "$CORPUS_RAW_DIR" --out public --clips
#   …or, with no real data yet:
python corpus/scripts/site_build/demo_corpus.py --out /tmp/demo --speakers 24 --audio
python -m corpus.scripts.site_build.build --raw /tmp/demo --out public --clips

pnpm dev        # http://localhost:5290
```

`public/data/` and `public/clips/` are generated and git-ignored — rebuild them
with the command above.

## Build & deploy

```bash
pnpm build      # → dist/  (static, self-contained)
```

`dist/` is a plain static bundle. `base` is relative, so it can be served from a
domain root or a subfolder (e.g. linked from the department site). Any static
host works — Cloudflare Pages, GitHub Pages, Netlify, or a plain file server.
Ship `public/data` + `public/clips` alongside the bundle (Vite copies `public/`
into `dist/` at build time, so a build done *after* the data step is
self-contained).

## Layout

```
src/
  App.tsx              layout + view/selection state
  content/
    about.md           corpus description — the compiler's text lives here
  lib/
    api.ts             static fetch + in-memory cache
    types.ts           typed mirror of the JSON contract
    labels.ts          filter-key → human labels
    markdown.tsx       small Markdown subset renderer (no dependency)
    csv.ts             concordance export (UTF-8 BOM, so Excel reads IPA)
    annotations.ts     per-token notes, localStorage-backed
  components/
    Masthead, FilterSidebar          header + tabs + 5 areas + filter tree
    AboutView                        renders content/about.md + live build facts
    SegmentalView, PhoneDetail       vowels/consonants grid + drill-down
    TokenConcordance                 KWIC table: search, sort, filters, notes, CSV
    UtterancePanel                   clip player + aligned phones + pitch + rhythm
    RhythmView, IntonationView, StressView, PitchPlot
```

## Editing the corpus description

The **About** tab is `src/content/about.md`. Sections quoted with `>` are
placeholders for the corpus compiler to replace. Edit the file, rebuild, deploy —
that is the whole flow.
