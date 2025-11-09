#!/bin/sh
set -e

echo "🚀 Starting application initialization..."

echo "⏳ Waiting for PostgreSQL..."
pnpm exec tsx scripts/wait-for-postgres.ts

echo "📦 Running database migrations..."
pnpm exec tsx scripts/migrate.ts

echo "✅ Starting application..."
exec node .output/server/index.mjs

