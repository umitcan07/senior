"""Pre-flight verification of the real corpus drop.

Run this the moment the EXMARaLDA export lands, before building the site. It
answers the open questions the site design depends on — the same ones we could
not answer without the data:

  1. Does every file carry BOTH a learner tier and a reference tier?
     Only paired tiers yield correct/incorrect. Files with one tier become
     inventory-only, and this reports exactly which.
  2. Are lexical-stress marks (ˈ ˌ) actually present in the phone tiers?
     If yes, the stress area works from annotation. If no, that area needs
     hand-labelling and should be deferred.
  3. What speaker metadata do the .exb files expose? (drives the metadata panel)
  4. Do the .exb files carry an annotation tier (type="a")? What categories?
  5. Sanity: phone inventory coverage, OOV labels, per-file tier counts.

Nothing here writes the site — it only inspects and prints a report, so it is
safe to run repeatedly. Exit code is non-zero if a blocking condition is found
(no usable files), zero otherwise (warnings are informational).

    python -m corpus.scripts.site_build.verify --raw "$CORPUS_RAW_DIR"
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from pathlib import Path

if __package__ in (None, ""):
    sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
    from site_build import exb, inventory, textgrid
else:
    from . import exb, inventory, textgrid

REF_TIERS = ("REF-phones",)
ACT_TIERS = ("phones",)
STRESS_MARKS = ("ˈ", "ˌ")


def _stress_marks_present(labels: list[str]) -> int:
    return sum(1 for lb in labels if any(m in lb for m in STRESS_MARKS))


def verify(raw_dir: Path) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8")  # type: ignore[union-attr]
    except Exception:
        pass

    print(f"CORPUS_RAW_DIR: {raw_dir}\n")
    if not raw_dir.is_dir():
        print("ERROR: raw corpus directory not found.")
        return 2

    task_folders = [
        ("TASK1", raw_dir / "TASK1 audio&textgrids"),
        ("TASK2", raw_dir / "TASK2 audio&textgrids"),
    ]

    total_files = 0
    paired_files = 0
    single_tier_files: list[str] = []
    missing_wav: list[str] = []
    stress_hits = 0
    stress_total_labels = 0
    all_labels: Counter[str] = Counter()
    oov: Counter[str] = Counter()

    for task, folder in task_folders:
        if not folder.is_dir():
            print(f"  [WARN] missing {folder}")
            continue
        tgs = sorted(folder.glob("*.TextGrid"))
        print(f"=== {task}: {len(tgs)} TextGrid(s) ===")
        for tg_path in tgs:
            total_files += 1
            tg = textgrid.read_textgrid(tg_path)
            ref = tg.tier(*REF_TIERS)
            act = tg.tier(*ACT_TIERS)
            ref_n = len(ref.labelled()) if ref else 0
            act_n = len(act.labelled()) if act else 0

            if ref_n and act_n:
                paired_files += 1
            else:
                single_tier_files.append(
                    f"{tg_path.name} (ref={ref_n}, act={act_n}, tiers={sorted(tg.tiers)})"
                )

            if not tg_path.with_suffix(".wav").exists():
                missing_wav.append(tg_path.name)

            for tier in (ref, act):
                if not tier:
                    continue
                labels = [iv.text for iv in tier.labelled()]
                stress_total_labels += len(labels)
                stress_hits += _stress_marks_present(labels)
                for lb in labels:
                    parsed = inventory.parse_phone(lb)
                    all_labels[parsed.token] += 1
                    if not parsed.known and parsed.token:
                        oov[parsed.token] += 1

    print()
    print("── Q1: paired tiers (correct/incorrect available) ─────────────")
    print(f"  {paired_files}/{total_files} files have BOTH phones + REF-phones")
    if single_tier_files:
        print(f"  {len(single_tier_files)} single-tier (inventory-only):")
        for s in single_tier_files[:30]:
            print(f"    - {s}")

    print("\n── Q2: lexical-stress marks in phone tiers ───────────────────")
    if stress_total_labels:
        pct = 100 * stress_hits / stress_total_labels
        print(f"  {stress_hits}/{stress_total_labels} labels carry ˈ/ˌ ({pct:.1f}%)")
        if stress_hits == 0:
            print("  -> NO stress marks: lexical-stress area needs hand-labelling.")
        else:
            print("  -> stress marks present: lexical-stress area works from annotation.")

    print("\n── Q5: inventory coverage ────────────────────────────────────")
    print(f"  {len(all_labels)} distinct tokens, {sum(all_labels.values())} total")
    if oov:
        print(f"  {len(oov)} OOV token type(s) (not in inventory): {oov.most_common(20)}")
        print("  -> extend inventory.ALIASES / INVENTORY for these.")
    else:
        print("  all tokens recognised.")

    if missing_wav:
        print(f"\n  [WARN] {len(missing_wav)} TextGrid(s) without a .wav sibling")

    # .exb metadata + annotation tiers
    print("\n── Q3/Q4: .exb metadata + annotation tiers ───────────────────")
    exbs = sorted(raw_dir.rglob("*.exb"))
    if not exbs:
        print("  no .exb files found — speaker metadata panel will be empty.")
        print("  (ask for the .exb/.coma export, or a speaker metadata table)")
    else:
        print(f"  {len(exbs)} .exb file(s). Sample:\n")
        print(exb.describe(exbs[0]))
        ann_categories: Counter[str] = Counter()
        ud_keys: Counter[str] = Counter()
        for p in exbs:
            try:
                tr = exb.parse_exb(p)
            except Exception as e:
                print(f"  [WARN] {p.name}: parse failed ({e})")
                continue
            for t in tr.tiers(type="a"):
                ann_categories[t.category] += 1
            for sp in tr.speakers.values():
                ud_keys.update(sp.ud.keys())
        if ann_categories:
            print(f"\n  annotation tier categories: {ann_categories.most_common()}")
        else:
            print("\n  no annotation tiers (type='a') in any .exb.")
        if ud_keys:
            print(f"  speaker metadata keys seen: {sorted(ud_keys)}")

    print("\n" + "=" * 62)
    if paired_files == 0 and total_files > 0:
        print("BLOCKER: no file has both tiers — cannot compute correct/incorrect.")
        return 1
    if total_files == 0:
        print("BLOCKER: no TextGrid files found.")
        return 1
    print(f"OK: {paired_files} file(s) usable for correct/incorrect. Ready to build.")
    return 0


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--raw", type=Path, default=None)
    args = parser.parse_args(argv)

    if args.raw is None:
        sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
        from paths import corpus_raw_dir

        raw = corpus_raw_dir()
    else:
        raw = args.raw
    return verify(raw)


if __name__ == "__main__":
    raise SystemExit(main())
