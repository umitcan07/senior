"""
Compare IPA transcriptions between old DB (G2P) and new prod-v2 DB (POWSM native).
Prints differ stats and per-text breakdown.
"""
import os
import sys
import psycopg2

OLD_DB = os.environ["OLD_DB"]
NEW_DB = os.environ["NEW_DB"]


def fetch_ipa(conn_str: str) -> dict[str, dict[str, str]]:
    """Returns {text_content: {author_slug_or_name: ipa_transcription}}"""
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()
    cur.execute("""
        SELECT pt.content, a.slug, a.name, rs.ipa_transcription, rs.ipa_method
        FROM reference_speeches rs
        JOIN practice_texts pt ON pt.id = rs.text_id
        JOIN authors a ON a.id = rs.author_id
        WHERE rs.ipa_transcription IS NOT NULL
          AND rs.ipa_transcription <> ''
    """)
    rows = cur.fetchall()
    conn.close()

    result: dict[str, list[tuple[str, str, str]]] = {}
    for content, slug, name, ipa, method in rows:
        result.setdefault(content, []).append((slug or name, ipa, method))
    return result


def edit_distance(a: str, b: str) -> int:
    a_tokens = a.split()
    b_tokens = b.split()
    m, n = len(a_tokens), len(b_tokens)
    dp = list(range(n + 1))
    for i in range(1, m + 1):
        new_dp = [i] + [0] * n
        for j in range(1, n + 1):
            if a_tokens[i - 1] == b_tokens[j - 1]:
                new_dp[j] = dp[j - 1]
            else:
                new_dp[j] = 1 + min(dp[j], new_dp[j - 1], dp[j - 1])
        dp = new_dp
    return dp[n]


def main():
    old = fetch_ipa(OLD_DB)
    new = fetch_ipa(NEW_DB)

    print(f"Old DB: {len(old)} texts with IPA")
    print(f"New DB: {len(new)} texts with IPA")

    # Per-text comparison for texts present in both DBs
    shared = set(old) & set(new)
    print(f"Shared texts: {len(shared)}\n")

    # Old DB: usually one IPA per text (G2P, dialect-agnostic)
    # New DB: up to 4 per text (one per native speaker)

    same_count = 0
    differ_count = 0
    total_pairs = 0
    total_dist = 0
    total_len = 0

    # Also track cross-dialect differences in new DB
    new_dialect_diffs = []

    for text in sorted(shared):
        old_entries = old[text]  # [(author, ipa, method)]
        new_entries = new[text]

        # Normalize old IPA (pick first, usually single G2P entry)
        old_ipa = old_entries[0][1] if old_entries else ""
        old_tokens = len(old_ipa.split())

        # Compare each new entry vs old
        for author, new_ipa, method in new_entries:
            dist = edit_distance(old_ipa, new_ipa)
            new_len = len(new_ipa.split())
            max_len = max(old_tokens, new_len) or 1
            rate = dist / max_len
            total_pairs += 1
            total_dist += dist
            total_len += max_len
            if dist == 0:
                same_count += 1
            else:
                differ_count += 1

        # Cross-dialect within new DB
        if len(new_entries) >= 2:
            for i in range(len(new_entries)):
                for j in range(i + 1, len(new_entries)):
                    a_author, a_ipa, _ = new_entries[i]
                    b_author, b_ipa, _ = new_entries[j]
                    dist = edit_distance(a_ipa, b_ipa)
                    max_len = max(len(a_ipa.split()), len(b_ipa.split())) or 1
                    new_dialect_diffs.append(dist / max_len)

    overall_rate = total_dist / total_len if total_len else 0
    print("=== Old G2P vs New POWSM native ===")
    print(f"Total (text, author) pairs compared: {total_pairs}")
    print(f"Identical IPA: {same_count} ({100*same_count/total_pairs:.1f}%)")
    print(f"Different IPA: {differ_count} ({100*differ_count/total_pairs:.1f}%)")
    print(f"Mean token-edit-distance / max_len: {overall_rate:.3f}  ({overall_rate*100:.1f}%)")

    if new_dialect_diffs:
        avg_cross = sum(new_dialect_diffs) / len(new_dialect_diffs)
        print(f"\n=== Cross-speaker differ rate within new POWSM DB ===")
        print(f"Pairs compared: {len(new_dialect_diffs)}")
        print(f"Mean token-edit-distance / max_len: {avg_cross:.3f}  ({avg_cross*100:.1f}%)")

    # Show a few examples
    print("\n=== Sample comparisons (old G2P vs new POWSM) ===")
    shown = 0
    for text in sorted(shared):
        if shown >= 4:
            break
        old_ipa = old[text][0][1] if old[text] else ""
        for author, new_ipa, _ in new[text]:
            if shown >= 4:
                break
            dist = edit_distance(old_ipa, new_ipa)
            if dist > 0:
                print(f'\nText: "{text[:60]}"')
                print(f"  OLD G2P:       {old_ipa[:80]}")
                print(f"  NEW POWSM ({author}): {new_ipa[:80]}")
                print(f"  edit dist: {dist}")
                shown += 1


if __name__ == "__main__":
    main()
