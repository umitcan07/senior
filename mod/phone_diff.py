"""Phone-level diff for pronunciation assessment (E2.2 / issue #15).

Wagner-Fischer alignment of a user phone sequence against a reference. Given a
reference phone sequence (what should have been said) and a user phone sequence
(what the recognizer heard), returns per-phone ``errors``, a full ``alignment``
(including matches) and a phone error rate (``per``).

The substitution cost is an articulatory **feature distance**
(``phone_features.feature_sub_cost``, E7.6 / #57) rather than a flat 2, so
articulatorily-close phones align as cheap substitutions instead of being torn
into spurious insert/delete pairs (see ``doc/e7.6_panphon_feasibility.md``).
insert/delete stay at cost 1; the feature cost is scaled so its max equals
``ins + del = 2``, leaving far-phone alignment unchanged.

Phones are bare IPA tokens *without* POWSM's ``/.../`` slashes — strip those
upstream (see ``app/src/lib/ipa.ts`` ``parsePhonemes``) before calling here.

NOTE for E3 (#19): this module uses short op labels ``sub|ins|del`` per issue
#15, whereas ``assess.py``, the assessment webhook and the ``phonemeErrors`` DB
enum use long labels ``substitute|insert|delete`` and a single ``position``
field. Reconciling the two contracts is E3's job when it swaps the endpoint over.
"""

# insert/delete cost = 1 (kept consistent with edit_distance.py's legacy callers).
# The substitution cost is no longer the flat 2: it comes from an articulatory
# feature distance (E7.6 / #57, see phone_features.feature_sub_cost) so close phones
# align cheaply. feature_sub_cost is scaled so its max == 2 == ins+del, preserving the
# far-phone balance, and the binary cost stays available via the sub_cost_fn argument.
_INS_DEL_COST = 1.0
# Costs are now fractional floats, so traceback can't use exact `==` against a path
# sum (float addition isn't associative); compare within a tolerance instead.
_TOL = 1e-9

# Short op labels per issue #15 (assess.py maps these to long DB labels).
_INSERT = "ins"
_DELETE = "del"
_SUBSTITUTE = "sub"
_MATCH = "match"


def _binary_sub_cost(_ref_tok, _user_tok):
    """The original flat substitution cost (= 2). Kept for tests and as the
    panphon-free regression baseline; pass it as ``sub_cost_fn`` to reproduce the
    pre-E7.6 binary alignment exactly."""
    return 2.0


def _align(ref_phones, user_phones, sub_cost_fn=None):
    """Wagner-Fischer alignment of user_phones against ref_phones.

    Returns a list of rows ``(op, ref_idx, user_idx, ref_tok, user_tok)`` in
    sequence order, where unused indices/tokens are ``None``. The tie-break order
    (match -> substitute -> insert -> delete) is unchanged from the binary aligner,
    so ops stay consistent; only the substitution *cost* is now feature-weighted.

    Args:
        sub_cost_fn: ``(ref_tok, user_tok) -> float`` substitution cost. Defaults to
            ``phone_features.feature_sub_cost`` (imported lazily so this module stays
            importable without panphon). Pass ``_binary_sub_cost`` for the flat-2
            behavior.

    Op semantics (speaker's perspective, matching edit_distance.py):
    - ``ins``: extra phone in user, not in ref.
    - ``del``: phone missing from user that ref expected.
    - ``sub``: ref phone realized as a different user phone.
    """
    if sub_cost_fn is None:
        # Lazy import: keeps `import phone_diff` working on the dev worker / in
        # binary-only paths that don't have panphon installed.
        from phone_features import feature_sub_cost

        sub_cost_fn = feature_sub_cost

    m, n = len(user_phones), len(ref_phones)  # rows = user, cols = ref
    dp = [[0.0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i * _INS_DEL_COST
    for j in range(n + 1):
        dp[0][j] = j * _INS_DEL_COST

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if user_phones[i - 1] == ref_phones[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]  # exact match -> never calls sub_cost_fn
            else:
                insert_cost = dp[i - 1][j] + _INS_DEL_COST
                delete_cost = dp[i][j - 1] + _INS_DEL_COST
                substitute_cost = dp[i - 1][j - 1] + sub_cost_fn(
                    ref_phones[j - 1], user_phones[i - 1]
                )
                dp[i][j] = min(insert_cost, delete_cost, substitute_cost)

    rows = []
    i, j = m, n
    while i > 0 or j > 0:
        if i > 0 and j > 0 and user_phones[i - 1] == ref_phones[j - 1]:
            rows.append((_MATCH, j - 1, i - 1, ref_phones[j - 1], user_phones[i - 1]))
            i -= 1
            j -= 1
        elif (
            i > 0
            and j > 0
            and abs(
                dp[i][j]
                - (dp[i - 1][j - 1] + sub_cost_fn(ref_phones[j - 1], user_phones[i - 1]))
            )
            < _TOL
        ):
            rows.append((_SUBSTITUTE, j - 1, i - 1, ref_phones[j - 1], user_phones[i - 1]))
            i -= 1
            j -= 1
        elif i > 0 and abs(dp[i][j] - (dp[i - 1][j] + _INS_DEL_COST)) < _TOL:
            rows.append((_INSERT, None, i - 1, None, user_phones[i - 1]))
            i -= 1
        elif j > 0 and abs(dp[i][j] - (dp[i][j - 1] + _INS_DEL_COST)) < _TOL:
            rows.append((_DELETE, j - 1, None, ref_phones[j - 1], None))
            j -= 1
        else:
            # Fallback for the matrix edges (mirrors edit_distance.py:61-67).
            if i > 0:
                rows.append((_INSERT, None, i - 1, None, user_phones[i - 1]))
                i -= 1
            elif j > 0:
                rows.append((_DELETE, j - 1, None, ref_phones[j - 1], None))
                j -= 1

    rows.reverse()
    return rows


def phone_diff(ref_phones, user_phones):
    """Diff a user phone sequence against the reference.

    Args:
        ref_phones: reference (canonical) phones, slashes already stripped.
        user_phones: recognized phones, slashes already stripped.

    Returns:
        dict with:
        - ``errors``: list of ``{type, ref_position, user_position, expected,
          actual}`` for every non-match row. ``type`` is ``sub|ins|del``.
          Substitutions carry both ``expected`` (ref) and ``actual`` (user) so
          the E7 hint layer (#57) can key off the ``(expected, actual)`` pair.
        - ``alignment``: list of ``{ref, user, op}`` for every row including
          matches (``op == "match"``).
        - ``per``: phone error rate ``(#sub + #ins + #del) / len(ref)``, each
          error counted once. Empty ref is defined behavior: ``0.0`` when both
          sequences are empty, else ``1.0``.
    """
    rows = _align(ref_phones, user_phones)

    errors = []
    alignment = []
    for op, ref_idx, user_idx, ref_tok, user_tok in rows:
        alignment.append({"ref": ref_tok, "user": user_tok, "op": op})
        if op == _MATCH:
            continue
        errors.append(
            {
                "type": op,
                "ref_position": ref_idx,
                "user_position": user_idx,
                "expected": ref_tok,
                "actual": user_tok,
            }
        )

    if not ref_phones:
        per = 0.0 if not user_phones else 1.0
    else:
        per = len(errors) / len(ref_phones)

    return {"errors": errors, "alignment": alignment, "per": per}
