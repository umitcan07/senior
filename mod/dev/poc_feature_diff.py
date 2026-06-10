"""E7.6 / issue #57 — feasibility POC for a PanPhon feature-weighted phone diff.

DEV-ONLY. Not wired into the production worker. This script answers, against real
`data/`, whether replacing the binary substitution cost in `mod/phone_diff.py:_align`
with a PanPhon feature distance:
  (1) is even possible — does PanPhon cover POWSM's actual token inventory? (the gate)
  (2) actually improves the diff — do articulatorily-close phones stop rendering as
      hard substitutions of unrelated phones (issue #57 comment #2)?
  (3) needs a curated Turkish-L1 override — how often does feature distance disagree
      with the doc/V2_CONTEXT.md §4 pedagogical error table?

It uses PanPhon's FeatureTable per-phone vectors + our own Hamming distance — NOT
panphon's string-level Distance (which would do its own whole-sequence alignment and
replace our aligner, losing positions/ins-del/GOP). So it needs no editdistance build.

Run (host):   python -X utf8 mod/dev/poc_feature_diff.py
Run (worker): python3 /worker/dev/poc_feature_diff.py
Tier 2 (learner data) reads cached POWSM phone seqs from poc_cache/learner_phones.json
if present (produced by `poc_feature_diff.py --emit-learner` inside the dev worker).
"""

import glob
import json
import os
import sys
from collections import Counter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
# In the dev worker data is mounted at /data, not /worker/data; override with POC_DATA_ROOT.
DATA_ROOT = os.environ.get("POC_DATA_ROOT") or os.path.join(ROOT, "data")
GOLDEN_GLOB = os.path.join(DATA_ROOT, "references", "*", "ref_*.expected.json")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "poc_cache")
WB = "▁"  # POWSM word-boundary token, stripped everywhere (issue #72)

# panphon is loaded lazily: the analysis steps need it, but --emit-learner (run in the dev
# worker, which has POWSM but not panphon) does pure alignment and must import-clean without it.
_ft = None


def _ftab():
    global _ft
    if _ft is None:
        import panphon
        _ft = panphon.FeatureTable()
    return _ft


def _names():
    return _ftab().names  # 24 feature names

# --- normalization map: precomposed POWSM tokens -> a form PanPhon segments ----
# Populated empirically (see coverage step). Maps a raw token to an equivalent that
# PanPhon's ipa_all.csv knows. Verified by the coverage report below.
NORM_MAP = {
    "ɫ": "l̴",   # ɫ  velarized l (U+026B) -> l + combining velarized/pharyngealized (U+0334)
    "ɝ": "ɜ˞",  # ɝ  rhotacized open-mid central -> ɜ + rhotacity hook
    "ɚ": "ə˞",  # ɚ  rhotacized schwa -> ə + rhotacity hook
}


def norm(tok):
    return NORM_MAP.get(tok, tok)


def vec(tok):
    """24-int feature vector for a single phone, or None if PanPhon can't vectorize it
    to exactly one segment (after normalization)."""
    vs = _ftab().word_to_vector_list(norm(tok), numeric=True)
    return vs[0] if len(vs) == 1 else None


def hamming(tok_a, tok_b):
    """(#differing features, normalized-by-24) between two phones, or None if either
    is uncovered. Identical -> (0, 0.0)."""
    va, vb = vec(tok_a), vec(tok_b)
    if va is None or vb is None:
        return None
    d = sum(1 for x, y in zip(va, vb) if x != y)
    return d, d / len(_names())


def differing_features(tok_a, tok_b):
    va, vb = vec(tok_a), vec(tok_b)
    if va is None or vb is None:
        return None
    out = []
    sym = {1: "+", 0: "0", -1: "-"}
    for name, x, y in zip(_names(), va, vb):
        if x != y:
            out.append(f"{name}:{sym[x]}→{sym[y]}")
    return out


# --------------------------------------------------------------------------- #
# Generic Wagner-Fischer that MIRRORS mod/phone_diff.py:_align (same tie-break
# order match->sub->ins->del, ins=del=1) but with a pluggable substitution cost.
# With sub_cost_fn=lambda r,u: 2 it reproduces the production binary aligner.
# --------------------------------------------------------------------------- #
INS = DEL = 1.0
TOL = 1e-9


def align(ref, user, sub_cost_fn):
    m, n = len(user), len(ref)
    dp = [[0.0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i * INS
    for j in range(n + 1):
        dp[0][j] = j * DEL
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if user[i - 1] == ref[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = min(
                    dp[i - 1][j] + INS,
                    dp[i][j - 1] + DEL,
                    dp[i - 1][j - 1] + sub_cost_fn(ref[j - 1], user[i - 1]),
                )
    rows = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and user[i - 1] == ref[j - 1]:
            rows.append(("match", ref[j - 1], user[i - 1]))
            i -= 1
            j -= 1
        elif (
            i > 0
            and j > 0
            and abs(dp[i][j] - (dp[i - 1][j - 1] + sub_cost_fn(ref[j - 1], user[i - 1]))) < TOL
        ):
            rows.append(("sub", ref[j - 1], user[i - 1]))
            i -= 1
            j -= 1
        elif i > 0 and abs(dp[i][j] - (dp[i - 1][j] + INS)) < TOL:
            rows.append(("ins", None, user[i - 1]))
            i -= 1
        elif j > 0 and abs(dp[i][j] - (dp[i][j - 1] + DEL)) < TOL:
            rows.append(("del", ref[j - 1], None))
            j -= 1
        else:
            if i > 0:
                rows.append(("ins", None, user[i - 1]))
                i -= 1
            elif j > 0:
                rows.append(("del", ref[j - 1], None))
                j -= 1
    rows.reverse()
    return dp[m][n], rows


def binary_cost(r, u):
    return 2.0


def make_feature_cost(scale=2.0, floor=0.0, uncovered=2.0):
    """sub cost = scale * normalized_hamming; falls back to `uncovered` if either phone
    isn't in PanPhon. `floor` keeps a minimum nonzero cost for any real substitution."""
    def cost(r, u):
        h = hamming(r, u)
        if h is None:
            return uncovered
        c = scale * h[1]
        return max(c, floor) if (r != u) else 0.0
    return cost


def counts(rows):
    c = Counter(op for op, _, _ in rows)
    return c["sub"], c["ins"], c["del"], c["match"]


# --------------------------------------------------------------------------- #
def load_goldens():
    out = {}  # (author, ref_id) -> [phones without WB]
    for path in sorted(glob.glob(GOLDEN_GLOB)):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        phones = [p for p in d.get("phones", []) if p != WB]
        out[(d.get("author"), d.get("id"))] = phones
    return out


def section(title):
    print("\n" + "=" * 78 + f"\n{title}\n" + "=" * 78)


# =========================================================================== #
def step_inventory(goldens):
    section("STEP 2 — POWSM phone inventory (native reference goldens)")
    inv = Counter()
    for phones in goldens.values():
        inv.update(phones)
    print(f"goldens: {len(goldens)} clips | tokens total: {sum(inv.values())} | unique: {len(inv)}")
    print("\nfull inventory (token  count  codepoints):")
    for tok, c in inv.most_common():
        cps = " ".join(f"U+{ord(ch):04X}" for ch in tok)
        print(f"  {tok!r:>8}  {c:>5}   {cps}")
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, "inventory.json"), "w", encoding="utf-8") as f:
        json.dump(dict(inv), f, ensure_ascii=False, indent=2)
    return inv


def step_coverage(inv):
    section("STEP 3 — PanPhon coverage of the inventory (FEASIBILITY GATE)")
    covered, uncovered = [], []
    for tok in inv:
        (covered if vec(tok) is not None else uncovered).append(tok)
    n = len(inv)
    cov_tok_total = sum(inv[t] for t in covered)
    tok_total = sum(inv.values())
    print(f"unique tokens covered: {len(covered)}/{n} = {100*len(covered)/n:.1f}%")
    print(f"token occurrences covered: {cov_tok_total}/{tok_total} = {100*cov_tok_total/tok_total:.2f}%")
    if uncovered:
        print("\nUNCOVERED unique tokens (token  count  codepoints  segments):")
        for tok in sorted(uncovered, key=lambda t: -inv[t]):
            cps = " ".join(f"U+{ord(ch):04X}" for ch in tok)
            segs = _ftab().word_to_vector_list(norm(tok), numeric=True)
            print(f"  {tok!r:>8}  {inv[tok]:>5}  {cps}  -> {len(segs)} seg(s)")
    else:
        print("\nAll tokens covered (after NORM_MAP). Gate: GREEN.")
    print(f"\nNORM_MAP in effect ({len(NORM_MAP)} entries):")
    for k, v in NORM_MAP.items():
        ok = vec(k) is not None
        print(f"  {k!r} -> {v!r}   now covered: {ok}")


def step_selftests():
    section("STEP 4 — feature-cost self-tests")
    cost = make_feature_cost()
    cases = [
        ("identical", "s", "s"),
        ("diacritic-only nasalization", "ɛ", "ɛ̃"),   # ɛ vs ɛ̃
        ("velarized l (norm map)", "l", "ɫ"),                    # l vs ɫ
        ("close vowels", "ɪ", "i"),                              # ɪ vs i
        ("voicing only", "s", "z"),
        ("TR-L1 critical th->s", "θ", "s"),                      # θ vs s
        ("TR-L1 critical w->v", "w", "v"),
        ("very different", "p", "i"),
        ("nasal vowel pair (comment#2 ɑ̃/ɔ̃)", "ɑ̃", "ɔ̃"),
        ("ɛ̃/ɪ̃ (comment#2)", "ɛ̃", "ɪ̃"),
    ]
    print(f"{'case':<34}{'pair':<12}{'Δfeat':>6}{'norm':>7}{'sub_cost':>9}   differing features")
    for label, a, b in cases:
        h = hamming(a, b)
        sc = cost(a, b)
        if h is None:
            print(f"{label:<34}{a+'/'+b:<12}{'N/A':>6}{'':>7}{sc:>9.3f}   (uncovered)")
        else:
            df = differing_features(a, b)
            print(f"{label:<34}{a+'/'+b:<12}{h[0]:>6}{h[1]:>7.3f}{sc:>9.3f}   {', '.join(df)}")


def step_realign_native(goldens):
    section("STEP 5 — binary vs feature re-alignment on NATIVE-vs-NATIVE pairs")
    print("Same sentence, two native speakers: both are 'correct', so most subs should be")
    print("articulatorily close. Spurious HARD subs under binary that become close/cheap under")
    print("feature cost = the bug from comment #2. (sub cost: binary=2, feature=2*normHamming)\n")
    cost = make_feature_cost()
    authors = sorted({a for a, _ in goldens})
    refids = sorted({r for _, r in goldens})
    tot_bin_sub = tot_feat_hardsub = tot_feat_closesub = 0
    examples = []
    pair_rows = []
    for rid in refids:
        present = [a for a in authors if (a, rid) in goldens]
        for x in range(len(present)):
            for y in range(x + 1, len(present)):
                ref = goldens[(present[x], rid)]
                usr = goldens[(present[y], rid)]
                _, br = align(ref, usr, binary_cost)
                _, fr = align(ref, usr, cost)
                b_sub = counts(br)[0]
                f_subs = [(r, u) for op, r, u in fr if op == "sub"]
                hard = [(r, u) for (r, u) in f_subs if (hamming(r, u) or (99, 1))[0] > 3]
                close = [(r, u) for (r, u) in f_subs if (hamming(r, u) or (99, 1))[0] <= 3]
                tot_bin_sub += b_sub
                tot_feat_hardsub += len(hard)
                tot_feat_closesub += len(close)
                pair_rows.append((rid, present[x], present[y], b_sub, len(f_subs), len(close), len(hard)))
                for (r, u) in close:
                    examples.append((rid, present[x], present[y], r, u, hamming(r, u)))
    print(f"{'sent':<8}{'spkrA':<17}{'spkrB':<17}{'binSub':>7}{'featSub':>8}{'close':>7}{'hard':>6}")
    for row in pair_rows[:24]:
        print(f"{row[0]:<8}{row[1]:<17}{row[2]:<17}{row[3]:>7}{row[4]:>8}{row[5]:>7}{row[6]:>6}")
    if len(pair_rows) > 24:
        print(f"  ... ({len(pair_rows)-24} more pairs)")
    print(f"\nTOTAL over {len(pair_rows)} native-native pairs:")
    print(f"  binary hard-subs:            {tot_bin_sub}")
    print(f"  feature CLOSE subs (Δ≤3):     {tot_feat_closesub}  <- were scored as hard subs by binary")
    print(f"  feature HARD subs (Δ>3):     {tot_feat_hardsub}  <- genuinely different (real diffs)")
    if tot_bin_sub:
        print(f"  => {100*tot_feat_closesub/max(tot_bin_sub,1):.0f}% of binary 'errors' are actually close phones")
    print("\nsample CLOSE subs binary would have flagged as hard errors (sent A/B  ref->user  Δfeat):")
    for ex in examples[:18]:
        print(f"  {ex[0]} {ex[1]}/{ex[2]}: {ex[3]} -> {ex[4]}   Δ={ex[5][0]} ({', '.join(differing_features(ex[3], ex[4]))})")


def step_s4():
    section("STEP 6 — §4 Turkish-L1 contrasts: feature distance vs pedagogical severity")
    print("If a pure feature-distance rule labels these as 'minor/close' (Δ small) they would be")
    print("UNDER-reported, yet §4 calls them the core L1 errors. This decides the severity model.\n")
    contrasts = [
        ("th -> t (think)", "θ", "t", True),
        ("th -> s (think)", "θ", "s", True),
        ("dh -> d (this)", "ð", "d", True),
        ("dh -> z (this)", "ð", "z", True),
        ("w -> v (wine/vine)", "w", "v", True),
        ("ng -> n (sing)", "ŋ", "n", True),
        ("r -> tap (red)", "ɹ", "ɾ", True),
        ("ae -> a (bat)", "æ", "a", True),
        ("ae -> e (bat/bet)", "æ", "ɛ", True),
        ("schwa -> a (about)", "ə", "a", True),
        ("I -> i (ship/sheep)", "ɪ", "i", True),
        ("U -> u (full/fool)", "ʊ", "u", True),
        ("wedge -> a (but)", "ʌ", "a", True),
    ]
    cost = make_feature_cost()
    print(f"{'contrast':<24}{'pair':<10}{'Δfeat':>6}{'norm':>7}{'sub_cost':>9}{'minor?':>8}   differing features")
    flagged_minor = 0
    for label, a, b, critical in contrasts:
        h = hamming(a, b)
        if h is None:
            print(f"{label:<24}{a+'/'+b:<10}{'N/A':>6}")
            continue
        sc = cost(a, b)
        minor = h[0] <= 3
        flagged_minor += 1 if (minor and critical) else 0
        df = differing_features(a, b)
        print(f"{label:<24}{a+'/'+b:<10}{h[0]:>6}{h[1]:>7.3f}{sc:>9.3f}{('YES' if minor else 'no'):>8}   {', '.join(df)}")
    print(f"\n{flagged_minor}/{len(contrasts)} pedagogically-critical §4 contrasts would be mislabeled 'minor' (Δ≤3)")
    print("=> if >0, a pure feature-distance severity is insufficient; a curated §4 override is warranted.")


def step_sweep():
    section("STEP 7 — cost-scaling sweep + epenthesis preservation")
    print("Synthetic Turkish epenthesis: target 'speak' [s p i k] vs learner [s ɨ p i k]")
    print("(vowel inserted to break the /sp/ cluster). The inserted vowel MUST stay an insertion.\n")
    ref = ["s", "p", "i", "k"]
    usr = ["s", "ɨ", "p", "i", "k"]  # ɨ inserted
    for scale in (1.0, 1.5, 2.0, 3.0):
        cost = make_feature_cost(scale=scale)
        _, rows = align(ref, usr, cost)
        s, i, d, m = counts(rows)
        ops = " ".join(op for op, _, _ in rows)
        print(f"  scale={scale}: sub={s} ins={i} del={d} match={m}  | {ops}")
    print("\nClose-pair-as-sub check on [.. ɛ̃ n ..] vs [.. ɛ n ..] (denasalized by learner):")
    ref = ["l", "ɛ̃", "n", "d"]
    usr = ["l", "ɛ", "n", "d"]
    for scale in (1.0, 2.0, 3.0):
        cost = make_feature_cost(scale=scale)
        _, rows = align(ref, usr, cost)
        s, i, d, m = counts(rows)
        print(f"  scale={scale}: sub={s} ins={i} del={d} match={m}  (want sub=1,ins=0,del=0)")


def step_learner():
    section("STEP 8 — learner data (Tier 2): binary vs feature on real Turkish-L1 errors")
    path = os.path.join(CACHE_DIR, "learner_phones.json")
    goldens = load_goldens()
    if not os.path.exists(path):
        print(f"(skipped) no cached learner phones at {path}.")
        print("Produce it inside the dev worker with:  python3 /worker/dev/poc_feature_diff.py --emit-learner")
        return
    with open(path, encoding="utf-8") as f:
        learner = json.load(f)  # {speaker: {ref_id: {ref_phones, user_phones, ...}}}
    meta = learner.pop("_meta", {})
    print(f"model: {meta.get('model_tag')} | adapter: {meta.get('adapter')} | ref author: {meta.get('ref_author')}")
    cost = make_feature_cost()
    tot_bin_sub = tot_close = tot_hard = 0
    flips = []
    for spk, refs in learner.items():
        for rid, rec in refs.items():
            ref = [p for p in rec["ref_phones"] if p != WB]
            usr = [p for p in rec["user_phones"] if p != WB]
            _, br = align(ref, usr, binary_cost)
            _, fr = align(ref, usr, cost)
            b_sub = counts(br)[0]
            f_subs = [(r, u) for op, r, u in fr if op == "sub"]
            close = [(r, u) for (r, u) in f_subs if (hamming(r, u) or (99, 1))[0] <= 3]
            hard = [(r, u) for (r, u) in f_subs if (hamming(r, u) or (99, 1))[0] > 3]
            tot_bin_sub += b_sub
            tot_close += len(close)
            tot_hard += len(hard)
            # detect cases where binary and feature pick different alignments
            if [r for _, r, _ in br] != [r for _, r, _ in fr]:
                flips.append((spk, rid, br, fr))
    print(f"clips: {sum(len(v) for v in learner.values())}")
    print(f"  binary subs total:        {tot_bin_sub}")
    print(f"  feature CLOSE subs (Δ≤3): {tot_close}")
    print(f"  feature HARD subs  (Δ>3): {tot_hard}")
    print(f"  alignment differs (binary vs feature) on {len(flips)} clips")
    for spk, rid, br, fr in flips[:8]:
        print(f"\n  {spk} {rid}:")
        print(f"    binary : {' '.join(f'{op}({r}->{u})' if op!='match' else r for op,r,u in br)}")
        print(f"    feature: {' '.join(f'{op}({r}->{u})' if op!='match' else r for op,r,u in fr)}")


# =========================================================================== #
# Aggregate results — single grounded source for every number cited in the report.
# Writes poc_cache/results.json (machine, full per-item) + doc/e7.6_poc_results.md
# (committed, the aggregate tables). Re-run to regenerate.
# =========================================================================== #
CLOSE_THRESHOLD = 3
SCALE = 2.0
# Mirrors mod/assessment/assess.py: PER above this == "wrong sentence" abstention, and
# score = (n_ref - subs - dels)/n_ref (insertions don't count). The feature aligner moves
# both numbers slightly, so we report the shift + flag any clip that crosses the gate.
WRONG_SENTENCE_PER = 0.7
DOC_RESULTS = os.path.join(ROOT, "doc", "e7.6_poc_results.md")


def _op_totals(rows):
    s, i, d, m = counts(rows)
    return {"sub": s, "ins": i, "del": d, "match": m}


def _score_per(totals, n_ref):
    """assess.py's score + PER from op counts. score ignores insertions (per assess.py);
    per counts every error once."""
    if not n_ref:
        return 1.0, 0.0
    score = max(0.0, (n_ref - totals["sub"] - totals["del"]) / n_ref)
    per = (totals["sub"] + totals["ins"] + totals["del"]) / n_ref
    return score, per


def _compare(items):
    """items: list of (key, ref, usr). Aggregate binary (before) vs feature (after)."""
    cost = make_feature_cost(scale=SCALE)
    bt = {"sub": 0, "ins": 0, "del": 0, "match": 0, "edit_cost": 0.0}
    ft = {"sub": 0, "ins": 0, "del": 0, "match": 0, "edit_cost": 0.0, "close_sub": 0, "hard_sub": 0}
    changed = 0
    hist = {}
    rows_out = []
    score_b_sum = score_f_sum = 0.0
    per_crossings = []  # clips that change wrong-sentence-gate verdict under feature cost
    for key, ref, usr in items:
        bc, br = align(ref, usr, binary_cost)
        fc, fr = align(ref, usr, cost)
        b, f = _op_totals(br), _op_totals(fr)
        for k in ("sub", "ins", "del", "match"):
            bt[k] += b[k]
            ft[k] += f[k]
        bt["edit_cost"] += bc
        ft["edit_cost"] += fc
        close = hard = 0
        for op, r, u in fr:
            if op == "sub":
                h = hamming(r, u)
                dd = h[0] if h else 99
                hist[dd] = hist.get(dd, 0) + 1
                if dd <= CLOSE_THRESHOLD:
                    close += 1
                else:
                    hard += 1
        ft["close_sub"] += close
        ft["hard_sub"] += hard
        ch = [(o, r, u) for o, r, u in br] != [(o, r, u) for o, r, u in fr]
        changed += 1 if ch else 0
        n_ref = len(ref)
        b_score, b_per = _score_per(b, n_ref)
        f_score, f_per = _score_per(f, n_ref)
        score_b_sum += b_score
        score_f_sum += f_score
        if (b_per > WRONG_SENTENCE_PER) != (f_per > WRONG_SENTENCE_PER):
            per_crossings.append({"key": list(key),
                                  "binary_per": round(b_per, 3), "feature_per": round(f_per, 3)})
        rows_out.append({"key": list(key), "binary": {**b, "score": round(b_score, 4), "per": round(b_per, 4)},
                         "feature": {**f, "close_sub": close, "hard_sub": hard,
                                     "score": round(f_score, 4), "per": round(f_per, 4)},
                         "changed": ch})
    bt["edit_cost"] = round(bt["edit_cost"], 1)
    ft["edit_cost"] = round(ft["edit_cost"], 1)
    n = len(items)
    return {"n": n, "binary": bt, "feature": ft, "changed": changed,
            "insdel_binary": bt["ins"] + bt["del"], "insdel_feature": ft["ins"] + ft["del"],
            "score_binary_mean": round(score_b_sum / n, 4) if n else None,
            "score_feature_mean": round(score_f_sum / n, 4) if n else None,
            "per_crossings": per_crossings,
            "sub_delta_hist": {str(k): v for k, v in sorted(hist.items())}, "rows": rows_out}


def _coverage(inv):
    covered = [t for t in inv if vec(t) is not None]
    unc = sorted([t for t in inv if vec(t) is None], key=lambda t: -inv[t])
    return {"unique": len(inv), "unique_covered": len(covered),
            "occ": sum(inv.values()), "occ_covered": sum(inv[t] for t in covered),
            "uncovered": unc}


def _selftest_data():
    cost = make_feature_cost(scale=SCALE)
    cases = [("identical", "s", "s"), ("nasalization ɛ/ɛ̃", "ɛ", "ɛ̃"),
             ("velarized l/ɫ (norm)", "l", "ɫ"), ("close vowels ɪ/i", "ɪ", "i"),
             ("voicing s/z", "s", "z"), ("TR-L1 θ/s", "θ", "s"), ("TR-L1 w/v", "w", "v"),
             ("very different p/i", "p", "i"), ("ɑ̃/ɔ̃ (comment#2)", "ɑ̃", "ɔ̃"),
             ("ɛ̃/ɪ̃ (comment#2)", "ɛ̃", "ɪ̃")]
    out = []
    for label, a, b in cases:
        h = hamming(a, b)
        out.append({"case": label, "pair": f"{a}/{b}", "dfeat": (h[0] if h else None),
                    "sub_cost": round(cost(a, b), 3),
                    "differing": (differing_features(a, b) if h else None)})
    return out


def _s4_data():
    cost = make_feature_cost(scale=SCALE)
    contrasts = [("θ→t think", "θ", "t"), ("θ→s think", "θ", "s"), ("ð→d this", "ð", "d"),
                 ("ð→z this", "ð", "z"), ("w→v wine/vine", "w", "v"), ("ŋ→n sing", "ŋ", "n"),
                 ("ɹ→ɾ red", "ɹ", "ɾ"), ("æ→a bat", "æ", "a"), ("æ→ɛ bat/bet", "æ", "ɛ"),
                 ("ə→a about", "ə", "a"), ("ɪ→i ship/sheep", "ɪ", "i"), ("ʊ→u full/fool", "ʊ", "u"),
                 ("ʌ→a but", "ʌ", "a")]
    out, close = [], 0
    for label, a, b in contrasts:
        h = hamming(a, b)
        minor = bool(h and h[0] <= CLOSE_THRESHOLD)
        close += 1 if minor else 0
        out.append({"contrast": label, "pair": f"{a}/{b}", "dfeat": (h[0] if h else None),
                    "sub_cost": round(cost(a, b), 3), "feature_close": minor,
                    "differing": (differing_features(a, b) if h else None)})
    return {"contrasts": out, "close_count": close, "total": len(contrasts)}


def _fidelity(items):
    """Confirm this POC's aligner reproduces production `phone_diff` exactly, so the
    'after' numbers above are what actually ships. As of E7.6 (#57) production
    `phone_diff` IS feature-weighted, so we compare the POC's feature path against the
    production default (the operative check), and the POC's binary path against
    production's binary `_align` (structural fidelity, unchanged by the cost swap)."""
    try:
        sys.path.insert(0, os.path.join(ROOT, "mod"))
        import phone_diff as pd
    except Exception as e:  # noqa: BLE001
        return {"available": False, "error": str(e)}
    cost = make_feature_cost(scale=SCALE)
    checked = mismatch = bin_mismatch = 0
    for _key, ref, usr in items:
        _, fr = align(ref, usr, cost)
        mine = [(o, r, u) for o, r, u in fr]
        prod = [(a["op"], a["ref"], a["user"]) for a in pd.phone_diff(ref, usr)["alignment"]]
        checked += 1
        mismatch += 1 if mine != prod else 0
        # binary path: POC binary vs production _align with its binary cost.
        _, br = align(ref, usr, binary_cost)
        prod_bin = [(o, r, u) for o, _ri, _ui, r, u in pd._align(ref, usr, pd._binary_sub_cost)]
        bin_mismatch += 1 if [(o, r, u) for o, r, u in br] != prod_bin else 0
    return {"available": True, "checked": checked, "identical": checked - mismatch,
            "mismatch": mismatch, "binary_mismatch": bin_mismatch}


def emit_results():
    section("EMIT AGGREGATE RESULTS")
    goldens = load_goldens()
    inv_native = Counter()
    for ph in goldens.values():
        inv_native.update(ph)
    authors = sorted({a for a, _ in goldens})
    refids = sorted({r for _, r in goldens})
    native_items = []
    for rid in refids:
        present = [a for a in authors if (a, rid) in goldens]
        for x in range(len(present)):
            for y in range(x + 1, len(present)):
                native_items.append(((rid, present[x], present[y]),
                                     goldens[(present[x], rid)], goldens[(present[y], rid)]))
    results = {"meta": {"scale": SCALE, "close_threshold": CLOSE_THRESHOLD,
                        "feature_count": len(_names()), "norm_map": NORM_MAP},
               "coverage": {"native": _coverage(inv_native)},
               "self_tests": _selftest_data(),
               "s4": _s4_data(),
               "native_tier": _compare(native_items)}

    path = os.path.join(CACHE_DIR, "learner_phones.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            learner = json.load(f)
        meta = learner.pop("_meta", {})
        items, per_spk_items, inv_learn = [], {}, Counter()
        for spk, refs in learner.items():
            per_spk_items[spk] = []
            for rid, rec in refs.items():
                ref = [p for p in rec["ref_phones"] if p != WB]
                usr = [p for p in rec["user_phones"] if p != WB]
                items.append(((spk, rid), ref, usr))
                per_spk_items[spk].append(((spk, rid), ref, usr))
                inv_learn.update(ref)
                inv_learn.update(usr)
        learner_agg = _compare(items)
        per_spk = {}
        for spk, its in per_spk_items.items():
            c = _compare(its)
            c.pop("rows", None)
            per_spk[spk] = c
        results["meta"]["model"] = meta
        results["coverage"]["learner_plus_ref"] = _coverage(inv_learn)
        results["coverage"]["learner_new_tokens"] = sorted(
            [t for t in inv_learn if t not in inv_native], key=lambda t: -inv_learn[t])
        results["learner_tier"] = {**learner_agg, "per_speaker": per_spk,
                                   "fidelity": _fidelity(items)}
    else:
        print(f"(no learner cache at {path} — emitting Tier 1 only)")

    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, "results.json"), "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    _write_results_md(results)
    print(f"wrote {os.path.join(CACHE_DIR, 'results.json')}")
    print(f"wrote {DOC_RESULTS}")
    return results


def _tbl(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "|" + "|".join(["---"] * len(headers)) + "|"]
    for r in rows:
        out.append("| " + " | ".join(str(c) for c in r) + " |")
    return "\n".join(out)


def _ba_table(agg):
    """before(binary) vs after(feature) op-composition table for one tier."""
    b, f = agg["binary"], agg["feature"]
    return _tbl(["metric", "binary (before)", "feature (after)"], [
        ["substitutions", b["sub"], f"{f['sub']} ({f['close_sub']} close Δ≤{CLOSE_THRESHOLD}, {f['hard_sub']} hard)"],
        ["insertions", b["ins"], f["ins"]],
        ["deletions", b["del"], f["del"]],
        ["insertions+deletions", agg["insdel_binary"], agg["insdel_feature"]],
        ["total edit cost", b["edit_cost"], f["edit_cost"]],
        [f"items w/ changed alignment", f"0 / {agg['n']}", f"{agg['changed']} / {agg['n']}"],
    ])


def _write_results_md(r):
    m = r["meta"]
    L = [f"# E7.6 POC — aggregate results (issue #57)",
         "",
         f"**Generated** by `mod/dev/poc_feature_diff.py --emit-results`. Do not hand-edit — re-run to refresh.",
         f"Feature cost = `{m['scale']} × (Δfeatures / {m['feature_count']})`; \"close\" = Δ ≤ {m['close_threshold']} features. "
         f"Binary baseline = production `mod/phone_diff.py` (sub=2, ins=del=1).", ""]
    mdl = m.get("model", {})
    if mdl:
        L += [f"Learner/reference phones: POWSM `{mdl.get('model_tag')}`, adapter `{mdl.get('adapter')}`, "
              f"reference author `{mdl.get('ref_author')}`.", ""]

    L += ["## Coverage (feasibility gate)", ""]
    cov = r["coverage"]
    cov_rows = []
    for name, key in [("native goldens", "native"), ("learner + live reference", "learner_plus_ref")]:
        c = cov.get(key)
        if not c:
            continue
        cov_rows.append([name, f"{c['unique_covered']}/{c['unique']}",
                         f"{100*c['unique_covered']/c['unique']:.1f}%",
                         f"{c['occ_covered']}/{c['occ']}",
                         f"{100*c['occ_covered']/c['occ']:.2f}%"])
    L.append(_tbl(["inventory", "unique covered", "%", "occurrences covered", "%"], cov_rows))
    nt = cov.get("learner_new_tokens", [])
    if nt:
        L += ["", f"Learner-side tokens absent from native goldens but still covered ({len(nt)}): "
              + " ".join(f"`{t}`" for t in nt[:30]) + ("…" if len(nt) > 30 else "")]
    unc = cov["native"]["uncovered"] + (cov.get("learner_plus_ref", {}).get("uncovered", []))
    L += ["", f"Uncovered tokens: **{len(unc)}**" + (": " + " ".join(f"`{t}`" for t in unc) if unc else " (NORM_MAP not required for observed data).")]

    L += ["", "## Native-vs-native upper bound (both speakers correct)", ""]
    L.append(_ba_table(r["native_tier"]))

    if "learner_tier" in r:
        lt = r["learner_tier"]
        L += ["", "## Learner data — real Turkish-L1 (before → after)", ""]
        L.append(_ba_table(lt))
        L += ["", f"Insertion+deletion pairs collapsed into localized substitutions: "
              f"**{lt['insdel_binary'] - lt['insdel_feature']}** ({lt['insdel_binary']} → {lt['insdel_feature']}). "
              f"Alignment changed on **{lt['changed']}/{lt['n']}** clips.", ""]
        xs = lt.get("per_crossings", [])
        L += [f"Score impact (mean; insertions don't count toward score, per `assess.py`): "
              f"binary **{lt.get('score_binary_mean')}** → feature **{lt.get('score_feature_mean')}**. "
              f"Clips crossing the {WRONG_SENTENCE_PER} wrong-sentence PER gate under the new cost: "
              f"**{len(xs)}**"
              + ("" if not xs else " — " + ", ".join(
                  f"{c['key'][0]}/{c['key'][1]} ({c['binary_per']}→{c['feature_per']})" for c in xs))
              + ".", ""]
        fid = lt.get("fidelity", {})
        if fid.get("available"):
            L += [f"Harness fidelity: POC feature aligner identical to production `phone_diff` "
                  f"(now feature-weighted) on **{fid['identical']}/{fid['checked']}** clips "
                  f"({fid['mismatch']} mismatches); POC binary path matches production's binary "
                  f"`_align` with {fid.get('binary_mismatch', 0)} mismatches.", ""]
        L += ["### Per speaker", ""]
        ps_rows = []
        for spk, c in lt["per_speaker"].items():
            b, f = c["binary"], c["feature"]
            ps_rows.append([spk, c["n"], f"{b['sub']}/{b['ins']}/{b['del']}",
                            f"{f['sub']}/{f['ins']}/{f['del']}",
                            f"{c['insdel_binary']}→{c['insdel_feature']}", f"{c['changed']}/{c['n']}"])
        L.append(_tbl(["speaker", "clips", "binary sub/ins/del", "feature sub/ins/del", "ins+del", "changed"], ps_rows))
        L += ["", "### Substitution Δfeature histogram (feature alignment, learner)", ""]
        hist = lt["sub_delta_hist"]
        tot = sum(hist.values()) or 1
        cum = 0
        h_rows = []
        for k in sorted(hist, key=lambda x: int(x)):
            cum += hist[k]
            h_rows.append([f"Δ={k}", hist[k], f"{100*hist[k]/tot:.0f}%", f"{100*cum/tot:.0f}%"])
        L.append(_tbl(["Δfeatures", "count", "% of subs", "cumulative %"], h_rows))

    L += ["", "## §4 Turkish-L1 contrasts (severity decision)", ""]
    s4 = r["s4"]
    s4_rows = [[c["contrast"], c["pair"], c["dfeat"], c["sub_cost"],
                "close" if c["feature_close"] else "far",
                ", ".join(c["differing"]) if c["differing"] else ""] for c in s4["contrasts"]]
    L.append(_tbl(["contrast", "pair", "Δfeat", "sub_cost", "feature verdict", "differing features"], s4_rows))
    L += ["", f"**{s4['close_count']}/{s4['total']}** core §4 contrasts are feature-close (Δ≤{CLOSE_THRESHOLD}) — "
          "a pure feature-distance severity would wrongly downplay them, so a curated §4 override is warranted.", ""]

    L += ["## Feature-cost self-tests", ""]
    st_rows = [[c["case"], c["pair"], c["dfeat"], c["sub_cost"],
                ", ".join(c["differing"]) if c["differing"] else ""] for c in r["self_tests"]]
    L.append(_tbl(["case", "pair", "Δfeat", "sub_cost", "differing features"], st_rows))
    L.append("")
    with open(DOC_RESULTS, "w", encoding="utf-8") as f:
        f.write("\n".join(L))


def main():
    if "--emit-learner" in sys.argv:
        emit_learner()
        return
    if "--emit-results" in sys.argv:
        emit_results()
        return
    goldens = load_goldens()
    inv = step_inventory(goldens)
    step_coverage(inv)
    step_selftests()
    step_realign_native(goldens)
    step_s4()
    step_sweep()
    step_learner()
    emit_results()
    section("DONE")


def _free_align_phones(aligner, librosa, clip):
    audio, _ = librosa.load(clip, sr=16000, mono=True)
    segs = aligner.free_alignment(audio)
    return [s.token for s in segs if getattr(s, "token", None) != WB]


def emit_learner():
    """Run inside the dev worker (has POWSM). Free-aligns each learner clip AND its matching
    reference clip with the SAME active model (adapter or baseline) so the binary-vs-feature
    comparison isn't confounded by the model that produced the committed baseline goldens.
    Caches to poc_cache/learner_phones.json."""
    import librosa  # noqa: E402

    sys.path.insert(0, "/worker")
    sys.path.insert(0, "/worker/assessment")
    import alignment  # noqa: E402

    aligner = alignment.get_aligner()
    print(f"model_tag={getattr(aligner,'model_tag',None)} adapter={getattr(aligner,'adapter_dir',None)}")
    goldens = load_goldens()
    REF_AUTHOR = os.environ.get("POC_REF_AUTHOR", "genam_katherine")
    speakers = ["erem", "omer", "umit", "ibrahim"]
    ref_live_cache = {}  # rid -> live ref phones (align each reference clip once)
    out = {"_meta": {"ref_author": REF_AUTHOR,
                     "adapter": getattr(aligner, "adapter_dir", None),
                     "model_tag": getattr(aligner, "model_tag", None)}}
    for spk in speakers:
        out[spk] = {}
        for rid_n in range(1, 26):
            rid = f"ref_{rid_n:03d}"
            uclip = os.path.join(DATA_ROOT, "test_recordings", spk, f"{rid}.wav")
            rclip = os.path.join(DATA_ROOT, "references", REF_AUTHOR, f"{rid}.wav")
            if not os.path.exists(uclip) or not os.path.exists(rclip):
                continue
            if rid not in ref_live_cache:
                ref_live_cache[rid] = _free_align_phones(aligner, librosa, rclip)
            user_phones = _free_align_phones(aligner, librosa, uclip)
            out[spk][rid] = {
                "ref_author": REF_AUTHOR,
                "ref_phones": ref_live_cache[rid],                     # model-consistent
                "ref_phones_golden": goldens.get((REF_AUTHOR, rid), []),  # committed baseline
                "user_phones": user_phones,
            }
            print(f"{spk} {rid}: ref={len(ref_live_cache[rid])} user={len(user_phones)} phones")
    os.makedirs(CACHE_DIR, exist_ok=True)
    with open(os.path.join(CACHE_DIR, "learner_phones.json"), "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print(f"wrote {os.path.join(CACHE_DIR, 'learner_phones.json')}")


if __name__ == "__main__":
    main()
