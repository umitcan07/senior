"""Phone-level diff for pronunciation assessment (E2.2 / issue #15).

Thin wrapper over the Wagner-Fischer edit distance in
``mod/assessment/edit_distance.py``. Given a reference phone sequence (what
should have been said) and a user phone sequence (what the recognizer heard),
returns per-phone ``errors``, a full ``alignment`` (including matches) and a
phone error rate (``per``).

Phones are bare IPA tokens *without* POWSM's ``/.../`` slashes — strip those
upstream (see ``app/src/lib/ipa.ts`` ``parsePhonemes``) before calling here.

NOTE for E3 (#19): this module uses short op labels ``sub|ins|del`` per issue
#15, whereas ``assess.py``, the assessment webhook and the ``phonemeErrors`` DB
enum use long labels ``substitute|insert|delete`` and a single ``position``
field. Reconciling the two contracts is E3's job when it swaps the endpoint over.
"""

# Reuse the exact cost model so phone_diff's traceback matches edit_operations'
# behavior (insert=1, delete=1, substitute=2). edit_distance.py is left untouched
# so its legacy callers in assess.py keep working until E3 lands.
from assessment.edit_distance import OPERATION_COSTS

# Map edit_distance's long op names to the short labels issue #15 specifies.
_INSERT = "ins"
_DELETE = "del"
_SUBSTITUTE = "sub"
_MATCH = "match"


def _align(ref_phones, user_phones):
    """Wagner-Fischer alignment of user_phones against ref_phones.

    Returns a list of rows ``(op, ref_idx, user_idx, ref_tok, user_tok)`` in
    sequence order, where unused indices/tokens are ``None``. Ops use the same
    cost model and the same tie-break order (substitute -> insert -> delete) as
    ``edit_operations``, so the two stay consistent.

    Op semantics (speaker's perspective, matching edit_distance.py):
    - ``ins``: extra phone in user, not in ref.
    - ``del``: phone missing from user that ref expected.
    - ``sub``: ref phone realized as a different user phone.
    """
    m, n = len(user_phones), len(ref_phones)  # rows = user, cols = ref
    dp = [[0] * (n + 1) for _ in range(m + 1)]

    for i in range(m + 1):
        dp[i][0] = i * OPERATION_COSTS["insert"]
    for j in range(n + 1):
        dp[0][j] = j * OPERATION_COSTS["delete"]

    for i in range(1, m + 1):
        for j in range(1, n + 1):
            if user_phones[i - 1] == ref_phones[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                insert_cost = dp[i - 1][j] + OPERATION_COSTS["insert"]
                delete_cost = dp[i][j - 1] + OPERATION_COSTS["delete"]
                substitute_cost = dp[i - 1][j - 1] + OPERATION_COSTS["substitute"]
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
            and dp[i][j] == dp[i - 1][j - 1] + OPERATION_COSTS["substitute"]
        ):
            rows.append((_SUBSTITUTE, j - 1, i - 1, ref_phones[j - 1], user_phones[i - 1]))
            i -= 1
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + OPERATION_COSTS["insert"]:
            rows.append((_INSERT, None, i - 1, None, user_phones[i - 1]))
            i -= 1
        elif j > 0 and dp[i][j] == dp[i][j - 1] + OPERATION_COSTS["delete"]:
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
