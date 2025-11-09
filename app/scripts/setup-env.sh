#!/bin/sh
# Script to set up .env file from .env.example

set -e

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

cd "$(dirname "$0")/.."

if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "❌ $ENV_EXAMPLE not found!"
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  echo "⚠️  $ENV_FILE already exists."
  echo "   If you want to recreate it, delete it first: rm $ENV_FILE"
  exit 0
fi

echo "📝 Creating $ENV_FILE from $ENV_EXAMPLE..."
cp "$ENV_EXAMPLE" "$ENV_FILE"

echo "✅ Created $ENV_FILE"
echo ""
echo "📋 Next steps:"
echo "   1. Edit $ENV_FILE and add your actual values"
echo "   2. Run: docker-compose up -d --build"
echo ""

