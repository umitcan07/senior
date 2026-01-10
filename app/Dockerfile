FROM node:20-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --frozen-lockfile

# Copy .env files first so Vite can read them during build
# Vite automatically reads .env.local if present
COPY .env* ./

COPY . .

# Build-time environment variables (for Vite - must be available during build)
# Priority: Docker secret (from fly deploy --build-secret) > .env.local > .env
# For Fly.io production: Pass via --build-secret during deploy
# For local dev: Use .env.local file
RUN --mount=type=secret,id=VITE_CLERK_PUBLISHABLE_KEY \
    export VITE_CLERK_PUBLISHABLE_KEY="$(cat /run/secrets/VITE_CLERK_PUBLISHABLE_KEY 2>/dev/null || echo '')" && \
    if [ -z "$VITE_CLERK_PUBLISHABLE_KEY" ] && [ -z "$(cat /run/secrets/VITE_CLERK_PUBLISHABLE_KEY 2>/dev/null)" ]; then \
      echo "Warning: VITE_CLERK_PUBLISHABLE_KEY not found in build secret, checking .env files..."; \
    fi && \
    echo "VITE_CLERK_PUBLISHABLE_KEY is set: $([ -n "$VITE_CLERK_PUBLISHABLE_KEY" ] && echo 'yes' || echo 'no')" && \
    pnpm run build

FROM node:20-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-lock.yaml ./

RUN pnpm install --prod --frozen-lockfile && \
    pnpm add -D tsx dotenv

# Copy built application
COPY --from=builder /app/.output ./.output

# Copy migration files and scripts
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/src/db ./src/db
COPY --from=builder /app/scripts ./scripts
COPY --from=builder /app/drizzle.config.ts ./drizzle.config.ts

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", ".output/server/index.mjs"]