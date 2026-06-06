# WorktreeCreate hook: copy app/.env from the main worktree into the new worktree.
#
# Stdin JSON contains: { "worktree_path": "<absolute path to new worktree>" }
# We also fall back to CLAUDE_PROJECT_DIR if worktree_path is absent.
$ErrorActionPreference = 'Stop'
try {
    $stdin = $input | Out-String
    $worktreePath = $null
    if ($stdin) {
        try {
            $obj = $stdin | ConvertFrom-Json
            $worktreePath = $obj.worktree_path
        } catch {}
    }
    if (-not $worktreePath) {
        $worktreePath = $env:CLAUDE_PROJECT_DIR
    }
    if (-not $worktreePath) { exit 0 }

    $dst = Join-Path $worktreePath 'app\.env'
    if (Test-Path $dst) { exit 0 }

    # Find the main worktree via git
    $main = (& git -C $worktreePath worktree list --porcelain 2>$null |
        Where-Object { $_ -like 'worktree *' } |
        Select-Object -First 1) -replace '^worktree ', ''
    if (-not $main) { exit 0 }

    $src = Join-Path $main 'app\.env'
    if (-not (Test-Path $src)) { exit 0 }

    $dstDir = Join-Path $worktreePath 'app'
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Force $dstDir | Out-Null }
    Copy-Item $src $dst -Force
} catch {
    exit 0
}
exit 0
