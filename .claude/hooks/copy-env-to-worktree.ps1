# WorktreeCreate hook: copy app/.env into a newly created git worktree.
# app/.env is gitignored, so a fresh worktree checkout lacks it. The hook
# payload JSON arrives on stdin; we read worktree_path from it.
# Source .env is resolved relative to this script (repo root), not a hardcoded
# home path, so this is safe to share/commit. Never fatal: a failure here must
# not block worktree creation.
$ErrorActionPreference = 'Stop'
try {
    $payload = [Console]::In.ReadToEnd()
    if (-not $payload) { exit 0 }

    $wt = ($payload | ConvertFrom-Json).worktree_path
    if (-not $wt) { exit 0 }

    # Normalize MSYS/git-bash style paths (/c/Users/...) to Windows (C:/Users/...).
    if ($wt -match '^/([a-zA-Z])/(.*)') { $wt = $matches[1] + ':/' + $matches[2] }

    $repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
    $src = Join-Path $repoRoot 'app\.env'
    if (-not (Test-Path $src)) { exit 0 }

    $dstDir = Join-Path $wt 'app'
    if (-not (Test-Path $dstDir)) { New-Item -ItemType Directory -Path $dstDir -Force | Out-Null }
    Copy-Item $src (Join-Path $dstDir '.env') -Force
} catch {
    # Non-fatal by design.
    exit 0
}
