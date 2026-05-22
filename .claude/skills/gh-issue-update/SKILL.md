---
name: gh-issue-update
description: Surgically update a GitHub issue — toggle a subtask checkbox, append a comment, change labels/title, replace one section — without dumping the body into chat or rewriting it from scratch. Use this for ALL issue edits in this repo.
---

# gh-issue-update

The wrong pattern: `gh issue view N --json body` → paste the whole body into a heredoc → make a tiny change → `gh issue edit N --body "$(cat <<EOF ... EOF)"`. This burns 1-5KB of context per edit.

The right pattern: fetch body to a temp file, mutate in place with `sed`/`awk`, upload, delete.

## Recipes

### Toggle a subtask checkbox (mark #M done on parent epic N)

```bash
F=$(mktemp -t issue_N.md)
gh issue view N --json body -q .body > "$F"
sed -i '' 's/^- \[ \] #M /- [x] #M /' "$F"
gh issue edit N --body-file "$F"
rm "$F"
```

(`sed -i ''` is BSD/macOS — use `sed -i` on Linux.)

### Untick a checkbox

```bash
sed -i '' 's/^- \[x\] #M /- [ ] #M /' "$F"
```

### Append a comment (preferred over editing body for status updates)

```bash
gh issue comment N --body "PR opened: #M. Smoke test on `s01_10-5178.flac` passes."
```

### Append a comment from a file

```bash
gh issue comment N --body-file ./somefile.md
```

### Add / remove labels (doesn't touch body)

```bash
gh issue edit N --add-label "blocked"
gh issue edit N --remove-label "blocked"
```

### Change title only

```bash
gh issue edit N --title "New title here"
```

### Replace one section in the body by header

To replace everything under `## Acceptance` up to the next `## ` heading (or end of body), use `awk`:

```bash
F=$(mktemp -t issue_N.md)
gh issue view N --json body -q .body > "$F"

awk '
  /^## Acceptance/ { print; in_section=1; next }
  in_section && /^## / { in_section=0; print "REPLACEMENT_BODY_HERE\n"; print; next }
  in_section { next }
  { print }
  END { if (in_section) print "REPLACEMENT_BODY_HERE" }
' "$F" > "${F}.new"

mv "${F}.new" "$F"
gh issue edit N --body-file "$F"
rm "$F"
```

Substitute the literal `REPLACEMENT_BODY_HERE` with your new section text (escaped for awk if it contains backslashes or single quotes — easier: write the replacement to a file and `gsub` via Python if it's gnarly).

### Append a new line to a known section

Simpler than full replacement — find the header, insert after it:

```bash
F=$(mktemp -t issue_N.md)
gh issue view N --json body -q .body > "$F"
# Insert "- new item" after the "## Subtasks" heading
sed -i '' '/^## Subtasks$/a\
- [ ] #X — New child issue\
' "$F"
gh issue edit N --body-file "$F"
rm "$F"
```

### Close / reopen

```bash
gh issue close N --comment "Done — see #M."
gh issue reopen N
```

### Pin / unpin

```bash
gh issue pin N
gh issue unpin N
```

### Add a "Blocked by" cross-reference (idempotent — comment works as a backlink)

GitHub doesn't have first-class "blocks" — we encode it in body text and via comments. Either:
- Edit the body (see "Append a new line" recipe), or
- Just leave a comment from the blocker: `gh issue comment X --body "Blocks #Y."` — GitHub will show this as a reference on issue #Y.

### Bulk update across an epic (mark all children done when epic ships)

```bash
for n in $(gh issue list -l "epic:E1-cleanup" --json number -q '.[].number'); do
  gh issue close "$n" --comment "Epic E1 closed; all children resolved."
done
```

## Defaults for this repo

- Repo: `umitcan07/senior` (CWD operates here).
- Our subtask checklist convention is `- [ ] #M — short description`. Match `- \[ \] #M` for the bullet (the dash and space are literal).
- Epic parents (read-only structural issues): `#3`–`#10`, `#43`. Reference: `#42`. Touch these only to update checkbox state or fix factual errors — never restructure.
- After every body edit, **clean up the temp file** so the working tree stays tidy.

## When NOT to use this skill

- For a completely new issue → `gh issue create` (not in scope here).
- For brand-new content where there's no existing body to preserve, the heredoc-with-full-body pattern is fine — but consider whether a comment would do.
