---
name: gh-issue-read
description: Read parts of a GitHub issue (title, labels, single section, checklist state, comments) without pulling the full body into context. Use whenever you need just one piece of an issue. Avoids 1-5KB context cost per issue read.
---

# gh-issue-read

When you need information from a GitHub issue, **never** start with `gh issue view N` (dumps everything). Project only what you need.

## Recipes

### Just the title

```bash
gh issue view N --json title -q .title
```

### Just the labels

```bash
gh issue view N --json labels -q '.labels[].name'
```

### Just the state (open/closed)

```bash
gh issue view N --json state -q .state
```

### Body to a *file* (not into chat context)

```bash
gh issue view N --json body -q .body > /tmp/issue_N.md
# now do whatever — read slices with sed/grep, never `cat` it
wc -l /tmp/issue_N.md         # how big
grep -n '^##' /tmp/issue_N.md  # list section headings only
```

You can then read targeted slices with the `Read` tool using `offset`/`limit` — that's the cheapest way to bring a *section* into context.

### One section by header (without loading the rest)

Use `awk` to extract just the block between one `## Heading` and the next:

```bash
gh issue view N --json body -q .body | awk '/^## Subtasks/,/^## |^---/'
```

Or `sed`:

```bash
gh issue view N --json body -q .body | sed -n '/^## Acceptance/,/^## /p'
```

### Checklist completion state (open vs done)

For our `- [ ] #M — name` / `- [x] #M — name` convention:

```bash
gh issue view N --json body -q .body | grep -E '^- \[[ x]\]' | \
  awk '/\[x\]/ {done++} /\[ \]/ {open++} END {print "done:", done, "open:", open}'
```

### Which subtasks are still open

```bash
gh issue view N --json body -q .body | grep '^- \[ \]'
```

### Comments only (skip the body)

```bash
gh issue view N --json comments -q '.comments[] | .body' | head -c 4000
```

(Cap with `head -c` to avoid surprises.)

### List issues in an epic (titles + state, no bodies)

```bash
gh issue list -l "epic:E3-assess" --json number,state,title \
  -q '.[] | "\(.number)\t\(.state)\t\(.title)"'
```

### Find which issues block which (parent / blocked-by lines)

```bash
gh issue view N --json body -q .body | grep -E '^(Parent|Blocked by):'
```

### GraphQL when you need multiple fields at once (one request)

```bash
gh api graphql -f q='{ repository(owner:"umitcan07",name:"senior") { issue(number: 14) { title state labels(first:10){nodes{name}} } } }' --jq .
```

## When NOT to use this skill

- If you're about to *rewrite the whole body* (rare; usually wrong), pull the full body into a file and edit there — but still don't `cat` it into chat. See the `gh-issue-update` skill.
- If you genuinely need every word of the issue in your head (e.g. you're answering a question about its full contents), `gh issue view N` is fine — that's what it's for.

## Defaults for this repo

- Repo: `umitcan07/senior` (CWD operates here, no need to specify).
- V2 issues live under label `v2`. Epic parents are `#3`–`#10` and `#43`. Reference issue is `#42`.
