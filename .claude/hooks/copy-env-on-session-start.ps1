# SessionStart hook: ensure app/.env exists in this session's project dir.
#
# app/.env is gitignored, so a freshly created git worktree starts without it.
# When this session runs in a worktree that lacks app/.env, copy it from the
# main worktree (located via `git worktree list`). In the main checkout, .env
# already exists, so this is a no-op.
#
# MUST stay silent on stdout: SessionStart stdout is injected into Claude's
# context. Errors are swallowed so session start is never disrupted.
$ErrorActionPreference = 'Stop'
try {
    $target = $env:CLAUDE_PROJECT_DIR
    if (-not $target) { $target = (Get-Location).Path }

    $dst = Join-Path $target 'app\.env'
    if (Test-Path $dst) { exit 0 }            # already present

    # The first `worktree` entry from porcelain output is the main worktree.
    $main = (& git -C $target worktree list --porcelain |
        Where-Object { $_ -like 'worktree *' } |
        Select-Object -First 1) -replace '^worktree ', ''
    if (-not $main) { exit 0 }

    $src = Join-Path $main 'app\.env'
    if (-not (Test-Path $src)) { exit 0 }     # nothing to copy from

    $dstDir = Join-Path $target 'app'
    if (-not (Test-Path $dstDir)) { exit 0 }  # not our repo layout; skip
    Copy-Item $src $dst -Force
} catch {
    exit 0
}
exit 0
