#!/usr/bin/env bash
# SessionStart hook: ensure app/.env exists in this session's project dir.
#
# app/.env is gitignored, so a freshly created git worktree starts without it.
# When this session runs in a worktree that lacks app/.env, copy it from the
# main worktree (located via `git worktree list`). In the main checkout, .env
# already exists, so this is a no-op.
#
# MUST stay silent on stdout: SessionStart stdout is injected into Claude's
# context. Errors are swallowed so session start is never disrupted.

target="${CLAUDE_PROJECT_DIR:-$(pwd)}"
dst="$target/app/.env"

[ -f "$dst" ] && exit 0

main=$(git -C "$target" worktree list --porcelain 2>/dev/null \
    | awk '/^worktree / { print substr($0, 10); exit }')
[ -z "$main" ] && exit 0

src="$main/app/.env"
[ -f "$src" ] || exit 0

[ -d "$target/app" ] || exit 0

cp "$src" "$dst" 2>/dev/null || true
exit 0
