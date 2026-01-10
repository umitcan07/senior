# syntax = docker/dockerfile:1
# Ephemeral Machine Dockerfile for automated deployments with build secrets
# This allows using Fly.io secrets directly instead of passing via command line

FROM flyio/flyctl:latest as flyio
FROM debian:bullseye-slim

RUN apt-get update; apt-get install -y ca-certificates jq

COPY <<"EOF" /srv/deploy.sh
#!/bin/bash
set -e

deploy=(flyctl deploy --remote-only)

echo "Reading secrets from Fly.io and preparing build secrets..."

# Read secrets from Fly.io and prepare build-secret flags
# Only include secrets that are needed for build time
while read -r secret_name; do
  if [ -n "$secret_name" ]; then
    # Get the secret value (Fly.io secrets are available as env vars in the ephemeral machine)
    secret_value="${!secret_name}"
    
    # Only add build secrets (VITE_* variables needed at build time)
    if [[ "$secret_name" == VITE_* ]] && [ -n "$secret_value" ]; then
      echo "✓ Found build secret: $secret_name"
      deploy+=(--build-secret "${secret_name}=${secret_value}")
    fi
  fi
done < <(flyctl secrets list --json 2>/dev/null | jq -r ".[].name" || echo "")

echo "Deploying to Fly.io..."
${deploy[@]}
EOF

RUN chmod +x /srv/deploy.sh

COPY --from=flyio /flyctl /usr/bin

WORKDIR /build
COPY . .

