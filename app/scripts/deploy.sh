#!/bin/bash
# Deployment script for Fly.io
# Usage: ./scripts/deploy.sh
# 
# This script automatically passes build secrets to Fly.io.
# No need to manually type --build-secret flags!
# 
# Option 1: Set secret value as environment variable (recommended for CI/CD)
#   export VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
#   ./scripts/deploy.sh
#
# Option 2: The script will prompt you if the env var is not set
#   ./scripts/deploy.sh

set -e

echo "Deploying to Fly.io..."

# Build deploy command
deploy_cmd=(fly deploy)

# Handle VITE_CLERK_PUBLISHABLE_KEY build secret
if [ -n "$VITE_CLERK_PUBLISHABLE_KEY" ]; then
  echo "✓ Using VITE_CLERK_PUBLISHABLE_KEY from environment variable"
  deploy_cmd+=(--build-secret "VITE_CLERK_PUBLISHABLE_KEY=$VITE_CLERK_PUBLISHABLE_KEY")
else
  # Check if secret exists in Fly.io (for informational purposes)
  if fly secrets list 2>/dev/null | grep -q "VITE_CLERK_PUBLISHABLE_KEY"; then
    echo "⚠ Note: VITE_CLERK_PUBLISHABLE_KEY exists in Fly.io secrets"
    echo "        But Fly.io doesn't allow reading secret values for build secrets"
    echo "        Please set it as an environment variable:"
    echo "        export VITE_CLERK_PUBLISHABLE_KEY=pk_live_..."
    echo ""
    read -p "Enter VITE_CLERK_PUBLISHABLE_KEY value (or press Enter to skip): " secret_value
    if [ -n "$secret_value" ]; then
      deploy_cmd+=(--build-secret "VITE_CLERK_PUBLISHABLE_KEY=$secret_value")
    else
      echo "⚠ Skipping build secret (build may fail if required)"
    fi
  else
    echo "⚠ Warning: VITE_CLERK_PUBLISHABLE_KEY not found"
    echo "           Set it with: export VITE_CLERK_PUBLISHABLE_KEY=pk_live_..."
    echo "           Or set it in Fly.io: fly secrets set VITE_CLERK_PUBLISHABLE_KEY=pk_live_..."
    echo ""
    read -p "Enter VITE_CLERK_PUBLISHABLE_KEY value (or press Enter to skip): " secret_value
    if [ -n "$secret_value" ]; then
      deploy_cmd+=(--build-secret "VITE_CLERK_PUBLISHABLE_KEY=$secret_value")
    else
      echo "⚠ Skipping build secret (build may fail if required)"
    fi
  fi
fi

# Execute deploy command
echo ""
echo "Running: ${deploy_cmd[*]}"
"${deploy_cmd[@]}" "$@"

echo ""
echo "Deployment complete!"

