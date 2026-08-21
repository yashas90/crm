# Railway API image — Dockerfile avoids flaky Nixpacks Metal snapshots
# ("Failed to read app source directory").
FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Workspace manifests first (full member list so the lockfile resolves)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY apps/mobile/package.json ./apps/mobile/package.json
COPY packages/db/package.json ./packages/db/package.json
COPY packages/types/package.json ./packages/types/package.json
COPY packages/config/package.json ./packages/config/package.json
COPY packages/ui/package.json ./packages/ui/package.json
COPY packages/brand/package.json ./packages/brand/package.json

ENV CI=true
ENV RAILWAY=1

# API + workspace deps only (skips installing Next/Expo app graphs when possible)
RUN pnpm install --frozen-lockfile --filter @propninja/api...

# Sources needed to build/run API + migrations
COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY scripts ./scripts
COPY biome.json turbo.json railway.toml ./

RUN pnpm railway:build

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001

CMD ["pnpm", "railway:start"]
