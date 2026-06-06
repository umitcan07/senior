#!/usr/bin/env python3
"""
verify.py — offline POWSM verification harness for the data/ audio fixtures.

DB-free. Runs the *real* POWSM CTC pipeline (mod/alignment.py) on committed WAV clips so
an agent can change the Python code and immediately see phone-recognition / alignment / GOP
regressions without touching Neon or RunPod.

Recordings are keyed by AUTHOR (multiple GenAm/RP voices supported):
    references/<author>/ref_NNN.wav          (+ ref_NNN.expected.json golden)
    learn/<author>/word_NN.wav
    test_recordings/<speaker>/ref_NNN.wav
Author dialect/kind comes from data/authors.json; clips are discovered on disk.

Run INSIDE the dev worker container (GPU + model already there):
    python scripts/runpod.py
    docker compose -f docker-compose.dev.yml exec worker-assessment \
        python3 /worker/dev/verify.py <subcommand> ...

Subcommands:
    align <clip|id> [--author A] [--save] [--json F]
    align-refs [--author A | --dialect D] [--save]
    assess <speaker> <ref> (--author REF_AUTHOR | --dialect D) [--json F]
    batch --check [--author A | --dialect D]      # regression check vs goldens (non-zero on DIFF)
"""

import argparse
import json
import os
import re
import subprocess
import sys
from pathlib import Path

_REPO_MOD = Path(__file__).resolve().parent.parent  # .../mod
for _cand in ("/worker", str(_REPO_MOD)):
    if (Path(_cand) / "alignment.py").exists() and _cand not in sys.path:
        sys.path.insert(0, _cand)

import alignment  # noqa: E402  (mod/alignment.py)
from assessment.edit_distance import edit_operations  # noqa: E402


def find_data_root(explicit: str | None) -> Path:
    if explicit:
        return Path(explicit)
    for cand in (Path("/data"), _REPO_MOD.parent / "data"):
        if (cand / "authors.json").exists() or cand.exists():
            return cand
    sys.exit("ERROR: data/ root not found (pass --data).")


class Ctx:
    def __init__(self, data_root: Path):
        self.root = data_root
        af = data_root / "authors.json"
        self.authors = json.loads(af.read_text(encoding="utf-8")).get("authors", {}) if af.exists() else {}
        mf = data_root / "manifest.json"
        m = json.loads(mf.read_text(encoding="utf-8")) if mf.exists() else {}
        self.ref_texts = {r["id"]: r["text"] for r in m.get("references", [])}
        self.references = [(r["id"], r["text"]) for r in m.get("references", [])]
        self.learn_words = [(w["id"], w["word"]) for w in m.get("learn_words", [])]

    def prompts(self, kind: str) -> list[tuple[str, str]]:
        """Ordered (id, text) the take should contain: sentences, then words for reference voices."""
        return self.references + (self.learn_words if kind == "reference" else [])

    def reference_authors(self, dialect=None, author=None) -> list[str]:
        if author:
            return [author]
        refs = [a for a, m in self.authors.items() if m.get("kind", "reference") == "reference"]
        if dialect:
            refs = [a for a in refs if self.authors[a].get("dialect") == dialect]
        if not refs:  # authors.json empty/missing -> fall back to whatever dirs exist
            refs = sorted(p.name for p in (self.root / "references").glob("*") if p.is_dir())
            if dialect:
                refs = [a for a in refs if self.authors.get(a, {}).get("dialect") == dialect]
        return refs

    def ref_clip(self, author: str, ref_id: str) -> Path:
        return self.root / "references" / author / f"{ref_id}.wav"

    def test_clip(self, speaker: str, ref_id: str) -> Path:
        return self.root / "test_recordings" / speaker / f"{ref_id}.wav"


def load_clip(path: Path):
    import librosa
    if not path.exists():
        sys.exit(f"ERROR: clip not found: {path}")
    audio, _ = librosa.load(str(path), sr=alignment.TARGET_SR, mono=True)
    return audio


def free_align(path: Path):
    return alignment.get_aligner().free_alignment(load_clip(path))


_asr = None
_whisper = None


def _asr_backend() -> str:
    """whisper (clean English text, recommended) if installed, else POWSM ASR. Override with
    VERIFY_ASR=whisper|powsm."""
    choice = os.environ.get("VERIFY_ASR", "whisper")
    if choice == "whisper":
        try:
            import whisper  # noqa: F401
            return "whisper"
        except Exception:
            return "powsm"
    return choice


def _get_whisper():
    global _whisper
    if _whisper is None:
        import torch
        import whisper
        _whisper = whisper.load_model(os.environ.get("WHISPER_MODEL", "small"),
                                      device="cuda" if torch.cuda.is_available() else "cpu")
    return _whisper


def get_asr():
    """Lazy POWSM ASR model (task <asr>) — fallback when whisper is unavailable."""
    global _asr
    if _asr is None:
        import torch
        from espnet2.bin.s2t_inference import Speech2Text
        tag = os.environ.get("POWSM_MODEL_TAG", "espnet/powsm")
        dev = "cuda" if torch.cuda.is_available() else "cpu"
        _asr = Speech2Text.from_pretrained(tag, device=dev, lang_sym="<eng>", task_sym="<asr>", beam_size=5)
    return _asr


def asr_array(audio) -> str:
    """Transcribe a float32 16 kHz numpy clip to text."""
    if _asr_backend() == "whisper":
        import torch
        return _get_whisper().transcribe(audio, language="en", fp16=torch.cuda.is_available())["text"].strip()
    raw = get_asr()(audio)[0][0]
    if "<notimestamps>" in raw:
        raw = raw.split("<notimestamps>")[-1]
    for tag in ("<eng>", "<asr>", "<na>", "<notimestamps>"):
        raw = raw.replace(tag, "")
    return raw.strip()


def asr_text(clip: Path) -> str:
    return asr_array(load_clip(clip))


_DIGITS = {"0": "zero", "1": "one", "2": "two", "3": "three", "4": "four", "5": "five",
           "6": "six", "7": "seven", "8": "eight", "9": "nine", "10": "ten"}


def _words(s: str) -> list[str]:
    s = re.sub(r"\d+", lambda m: " " + _DIGITS.get(m.group(), m.group()) + " ", s.lower())
    return re.findall(r"[a-z']+", s)


def _load_autoseg():
    import importlib.util
    for cand in ("/worker/scripts/auto_segment.py", str(_REPO_MOD.parent / "scripts" / "auto_segment.py")):
        if Path(cand).exists():
            spec = importlib.util.spec_from_file_location("auto_segment", cand)
            mod = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(mod)
            return mod
    sys.exit("auto_segment.py not found (expected /worker/scripts or repo scripts/).")


def _overlap(seg_words: set, prompt_words: set) -> float:
    """Recall: fraction of expected words found (used for display + asr threshold)."""
    if not prompt_words:
        return 0.0
    return len(seg_words & prompt_words) / len(prompt_words)


def _f1(seg_words: set, prompt_words: set) -> float:
    """F1 of recognized vs expected words — penalizes BOTH missing and extra words, so the
    mapper won't pad a prompt with junk pieces just because its word is present."""
    inter = len(seg_words & prompt_words)
    if inter == 0 or not seg_words or not prompt_words:
        return 0.0
    prec, rec = inter / len(seg_words), inter / len(prompt_words)
    return 2 * prec * rec / (prec + rec)


def golden_path(clip: Path) -> Path:
    return clip.with_suffix(".expected.json")


def save_golden(clip: Path, segs, **extra) -> None:
    rec = {
        "clip": str(clip), "mode": "free_alignment",
        "n_phones": len(segs), "phones": [s.token for s in segs],
        "segments": [s.to_dict() for s in segs],
        "model_tag": alignment.get_aligner().model_tag, **extra,
    }
    golden_path(clip).write_text(json.dumps(rec, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def print_segments(segs) -> None:
    print(f"  {'phone':<8}{'start_ms':>10}{'end_ms':>10}{'conf':>9}")
    for s in segs:
        print(f"  {s.token:<8}{s.start_ms:>10.1f}{s.end_ms:>10.1f}{s.confidence:>9.4f}")
    print(f"  phones ({len(segs)}): {' '.join(s.token for s in segs)}")


# --------------------------------------------------------------------------- #


def resolve_clip(ctx: Ctx, spec: str, author: str | None) -> Path:
    p = Path(spec)
    if p.exists():
        return p
    if spec.startswith("ref_"):
        if not author:
            sys.exit("--author required when aligning a ref_ id")
        kind = ctx.authors.get(author, {}).get("kind", "reference")
        return ctx.test_clip(author, spec) if kind == "test_user" else ctx.ref_clip(author, spec)
    if spec.startswith(("word_", "sound_")):
        if not author:
            sys.exit("--author required when aligning a word_/sound_ id")
        return ctx.root / "learn" / author / f"{spec}.wav"
    return ctx.root / spec


def cmd_align(ctx: Ctx, args) -> int:
    clip = resolve_clip(ctx, args.clip, args.author)
    segs = free_align(clip)
    print(f"\n{clip}")
    print_segments(segs)
    if args.save:
        save_golden(clip, segs)
        print(f"  saved golden -> {golden_path(clip)}")
    if args.json:
        Path(args.json).write_text(json.dumps([s.to_dict() for s in segs], ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


def cmd_align_refs(ctx: Ctx, args) -> int:
    authors = ctx.reference_authors(dialect=args.dialect, author=args.author)
    if not authors:
        sys.exit("no reference authors found (check data/authors.json or references/ dirs)")
    n = 0
    for author in authors:
        clips = sorted((ctx.root / "references" / author).glob("ref_*.wav"))
        if not clips:
            print(f"  (no clips yet for {author})")
            continue
        for clip in clips:
            segs = free_align(clip)
            print(f"  {author}/{clip.stem} ({len(segs)}): {' '.join(s.token for s in segs)}")
            if args.save:
                save_golden(clip, segs, author=author, id=clip.stem)
            n += 1
    print(f"\naligned {n} clips" + (" (goldens saved)" if args.save else ""))
    return 0


def diff_phones(actual: list[str], target: list[str]) -> dict:
    ops = edit_operations(actual, target)
    subs = [o for o in ops if o[0] == "substitute"]
    ins = [o for o in ops if o[0] == "insert"]
    dels = [o for o in ops if o[0] == "delete"]
    n = len(target)
    score = max(0, n - len(subs) - len(dels)) / n if n else 0.0
    return {"subs": subs, "ins": ins, "dels": dels, "score": score, "n": n}


def resolve_ref_author(ctx: Ctx, args) -> str:
    if args.author:
        return args.author
    cands = ctx.reference_authors(dialect=args.dialect)
    if len(cands) == 1:
        return cands[0]
    sys.exit(f"--dialect {args.dialect} matches {len(cands)} authors {cands}; pass --author to pick one.")


def cmd_assess(ctx: Ctx, args) -> int:
    ref_author = resolve_ref_author(ctx, args)
    user_clip = ctx.test_clip(args.speaker, args.ref)
    ref_clip = ctx.ref_clip(ref_author, args.ref)
    gp = golden_path(ref_clip)
    if gp.exists():
        target, src = json.loads(gp.read_text(encoding="utf-8"))["phones"], "golden"
    else:
        target, src = [s.token for s in free_align(ref_clip)], "live (no golden — run align-refs --save)"

    user_segs = free_align(user_clip)
    actual = [s.token for s in user_segs]
    d = diff_phones(actual, target)
    mean_conf = sum(s.confidence for s in user_segs) / len(user_segs) if user_segs else 0.0

    print(f"\nassess {args.speaker} / {args.ref}  vs ref author {ref_author}  (target phones: {src})")
    print(f"  target ({d['n']}): {' '.join(target)}")
    print(f"  actual ({len(actual)}): {' '.join(actual)}")
    print(f"  errors: {len(d['subs'])} sub, {len(d['ins'])} ins, {len(d['dels'])} del")
    for o in d["subs"]:
        print(f"    sub @{o[1]}: expected /{o[2]}/ -> said /{o[3]}/")
    for o in d["dels"]:
        print(f"    del @{o[1]}: missing /{o[2]}/")
    for o in d["ins"]:
        print(f"    ins @{o[1]}: extra /{o[2]}/")
    print(f"  score: {d['score']*100:.1f}%   mean GOP (conf): {mean_conf:.4f}")

    if args.json:
        Path(args.json).write_text(json.dumps({
            "speaker": args.speaker, "ref": args.ref, "ref_author": ref_author,
            "target": target, "actual": actual, "score": d["score"], "mean_confidence": mean_conf,
            "errors": {"sub": d["subs"], "ins": d["ins"], "del": d["dels"]},
        }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


def cmd_asr(ctx: Ctx, args) -> int:
    """Recognize each reference clip with NO target-text hint and compare to the expected
    sentence — an unbiased check that each ref_NNN clip really holds sentence ref_NNN."""
    authors = ctx.reference_authors(dialect=args.dialect, author=args.author)
    if not authors:
        sys.exit("no reference authors found.")
    total = ok = 0
    for author in authors:
        for clip in sorted((ctx.root / "references" / author).glob("ref_*.wav")):
            rid = clip.stem
            expected = ctx.ref_texts.get(rid, "")
            rec = asr_text(clip)
            exp_w, rec_w = set(_words(expected)), set(_words(rec))
            sim = len(exp_w & rec_w) / len(exp_w) if exp_w else 0.0
            good = sim >= args.threshold
            total += 1
            ok += good
            print(f"  {'OK' if good else '??'} {author}/{rid}  {sim * 100:3.0f}% word overlap")
            print(f"      expected: {expected}")
            print(f"      asr     : {rec}")
    print(f"\n{ok}/{total} clips match expected text (>= {args.threshold * 100:.0f}% overlap)")
    return 0 if ok == total else 1


def cmd_automap(ctx: Ctx, args) -> int:
    """Content-aware segmentation: over-segment by silence, ASR each piece, then map pieces to
    the known prompt order by best text overlap (DP, groups of 1..max-merge pieces per prompt).
    This fuses comma-split pieces automatically — robust to where silence thresholds fall.
    Writes a label file ready for split_audio.py."""
    import librosa

    aseg = _load_autoseg()
    author = args.author
    kind = ctx.authors.get(author, {}).get("kind", "reference")
    raw = Path(args.raw) if args.raw else ctx.root / "fiverr" / f"{author}.wav"
    if not raw.exists():
        sys.exit(f"raw take not found: {raw} (pass --raw)")

    stderr = aseg.run_silencedetect(raw, args.noise, args.min_silence)
    dur = aseg.parse_duration(stderr)
    segs = aseg.speech_segments(aseg.parse_silences(stderr, dur), dur, args.min_seg, args.pad)
    prompts = ctx.prompts(kind)
    m, n = len(segs), len(prompts)
    print(f"{author}: {m} pieces (min-silence {args.min_silence}) -> {n} prompts")
    if m < n:
        sys.exit(f"only {m} pieces for {n} prompts — lower --min-silence so nothing is under-split.")

    sr = alignment.TARGET_SR
    audio, _ = librosa.load(str(raw), sr=sr, mono=True)
    seg_text = [asr_array(audio[int(s * sr):int(e * sr)]) for s, e in segs]
    seg_wset = [set(_words(t)) for t in seg_text]
    pr_wset = [set(_words(t)) for _, t in prompts]

    if args.dump:
        for idx, ((s, e), t) in enumerate(zip(segs, seg_text)):
            print(f"  [{idx:3}] {s:7.2f}-{e:7.2f} ({e - s:4.2f}s)  {t}")
        print(f"\n{len(segs)} pieces, {n} prompts expected.")
        return 0

    # DP over pieces x prompts. A prompt consumes 1..K contiguous pieces (merges comma-splits);
    # extra pieces (retakes, trailing junk) may be SKIPPED for a small penalty so they don't
    # corrupt the mapping. Maximize total text-overlap.
    K, SKIP, NEG = args.max_merge, args.skip_penalty, float("-inf")
    dp = [[NEG] * (n + 1) for _ in range(m + 1)]
    back = [[None] * (n + 1) for _ in range(m + 1)]
    dp[0][0] = 0.0
    for i in range(m + 1):
        for k in range(n + 1):
            cur = dp[i][k]
            if cur == NEG:
                continue
            if i < m and cur - SKIP > dp[i + 1][k]:  # skip piece i
                dp[i + 1][k] = cur - SKIP
                back[i + 1][k] = (i, k, 0)
            if k < n:  # assign next g pieces to prompt k
                acc = set()
                for g in range(1, min(K, m - i) + 1):
                    acc = acc | seg_wset[i + g - 1]
                    # F1 minus a cost per extra merged piece: real splits (comma) gain new words
                    # so merging wins; a repeated word adds nothing, so skipping the repeat wins.
                    cand = cur + _f1(acc, pr_wset[k]) - args.merge_cost * (g - 1)
                    if cand > dp[i + g][k + 1]:
                        dp[i + g][k + 1] = cand
                        back[i + g][k + 1] = (i, k, g)
    if dp[m][n] == NEG:
        sys.exit("no valid mapping (try a larger --max-merge or lower --min-silence).")

    groups, i, k, skipped = [], m, n, 0
    while (i, k) != (0, 0):
        pi, pk, g = back[i][k]
        if g == 0:
            skipped += 1
        else:
            groups.append((pi, i, pk))  # seg range [pi, i), prompt index pk
        i, k = pi, pk
    groups.reverse()

    out = Path(args.out) if args.out else ctx.root / "labels" / f"{author}.txt"
    out.parent.mkdir(parents=True, exist_ok=True)
    low = 0
    with out.open("w", encoding="utf-8") as f:
        for prev, end, pk in groups:
            pid, ptext = prompts[pk]
            start_ms, end_ms = segs[prev][0], segs[end - 1][1]
            ov = _overlap(set().union(*seg_wset[prev:end]), pr_wset[pk])
            f.write(f"{start_ms:.6f}\t{end_ms:.6f}\t{pid}\n")
            merged = "" if end - prev == 1 else f" [{end - prev} pieces]"
            flag = "  " if ov >= args.threshold else "??"
            if ov < args.threshold:
                low += 1
            print(f"  {flag} {pid}{merged}  {ov * 100:3.0f}%  asr: {' '.join(seg_text[prev:end])[:60]}")
    print(f"\nlabels -> {out}   ({n - low}/{n} prompts >= {args.threshold * 100:.0f}% overlap"
          + (f", {low} LOW — review)" if low else ")")
          + (f"  ·  {skipped} extra piece(s) skipped" if skipped else ""))
    if low:
        print("  low-overlap prompts are usually fine for short words; eyeball the sentences.")
    if args.cut:
        script = Path("/worker/scripts/split_audio.py")
        script = script if script.exists() else _REPO_MOD.parent / "scripts" / "split_audio.py"
        cmd = [sys.executable, str(script), str(out), str(raw), "--author", author, "--data-root", str(ctx.root), "--force"]
        print("\n$ " + " ".join(cmd))
        return subprocess.run(cmd).returncode
    return 1 if low else 0


def cmd_batch(ctx: Ctx, args) -> int:
    if not args.check:
        sys.exit("batch currently supports only --check (regression vs goldens).")
    authors = ctx.reference_authors(dialect=args.dialect, author=args.author)
    diffs = checked = 0
    for author in authors:
        for clip in sorted((ctx.root / "references" / author).glob("ref_*.wav")):
            gp = golden_path(clip)
            if not gp.exists():
                continue
            checked += 1
            expected = json.loads(gp.read_text(encoding="utf-8"))["phones"]
            actual = [s.token for s in free_align(clip)]
            if actual == expected:
                print(f"  PASS  {author}/{clip.stem}")
            else:
                diffs += 1
                print(f"  DIFF  {author}/{clip.stem}")
                print(f"        golden:  {' '.join(expected)}")
                print(f"        current: {' '.join(actual)}")
    print(f"\nchecked {checked} goldens: {checked - diffs} PASS, {diffs} DIFF")
    return 1 if diffs else 0


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", help="path to data/ root (auto-detected: /data or repo data/)")
    sub = ap.add_subparsers(dest="cmd", required=True)

    a = sub.add_parser("align"); a.add_argument("clip"); a.add_argument("--author"); a.add_argument("--save", action="store_true"); a.add_argument("--json")
    ar = sub.add_parser("align-refs"); ar.add_argument("--author"); ar.add_argument("--dialect", choices=("genam", "rp")); ar.add_argument("--save", action="store_true")
    asg = sub.add_parser("assess"); asg.add_argument("speaker"); asg.add_argument("ref"); asg.add_argument("--author"); asg.add_argument("--dialect", choices=("genam", "rp")); asg.add_argument("--json")
    b = sub.add_parser("batch"); b.add_argument("--check", action="store_true"); b.add_argument("--author"); b.add_argument("--dialect", choices=("genam", "rp"))
    asr = sub.add_parser("asr"); asr.add_argument("--author"); asr.add_argument("--dialect", choices=("genam", "rp")); asr.add_argument("--threshold", type=float, default=0.6)
    am = sub.add_parser("automap")
    am.add_argument("--author", required=True); am.add_argument("--raw"); am.add_argument("--out")
    am.add_argument("--min-silence", type=float, default=0.25); am.add_argument("--noise", default="-30dB")
    am.add_argument("--min-seg", type=float, default=0.20); am.add_argument("--pad", type=float, default=0.10)
    am.add_argument("--max-merge", type=int, default=3); am.add_argument("--threshold", type=float, default=0.34)
    am.add_argument("--skip-penalty", type=float, default=0.2, help="cost to skip an extra piece (retake/junk)")
    am.add_argument("--merge-cost", type=float, default=0.25, help="cost per extra piece merged into one prompt (splits repeats)")
    am.add_argument("--cut", action="store_true")
    am.add_argument("--dump", action="store_true", help="print every detected piece + its ASR text, then exit")

    args = ap.parse_args()
    ctx = Ctx(find_data_root(args.data))
    rc = {"align": cmd_align, "align-refs": cmd_align_refs, "assess": cmd_assess, "batch": cmd_batch, "asr": cmd_asr, "automap": cmd_automap}[args.cmd](ctx, args)
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
