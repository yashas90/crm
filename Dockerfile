# Railway API image — use repo Dockerfile (not Nixpacks).
FROM node:22-bookworm-slim

WORKDIR /app

# openssl/ca-certificates: required for Postgres SSL (Nixpacks used to provide these).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# Full workspace lockfile install (filter installs were flaky for migrate tooling).
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

# Only fetch what we need for API + db; still better than shipping mobile/web sources.
RUN pnpm install --frozen-lockfile --filter @propninja/api... --filter @propninja/db...

COPY apps/api ./apps/api
COPY packages/db ./packages/db
COPY packages/types ./packages/types
COPY packages/config ./packages/config
COPY scripts ./scripts
COPY biome.json turbo.json railway.toml ./

RUN node -e "const fs=require('fs'); const pkg=require('./apps/api/package.json'); \
  if (!pkg.version || pkg.version === '0.0.0') { console.error('Refusing API version', pkg.version); process.exit(1); } \
  const src=fs.readFileSync('./apps/api/src/lib/apiVersion.ts','utf8'); \
  const m=src.match(/API_DEPLOY_MARKER\\s*=\\s*\\\"([^\\\"]+)\\\"/); \
  if (!m) { console.error('API_DEPLOY_MARKER missing'); process.exit(1); } \
  const identity={ version: pkg.version, deployMarker: m[1], builtAt: new Date().toISOString() }; \
  fs.writeFileSync('/app/deploy-identity.json', JSON.stringify(identity)); \
  console.log('Baked deploy identity', JSON.stringify(identity));"

RUN pnpm railway:build

ENV NODE_ENV=production
ENV API_VERSION=0.0.11
# Never bake PORT — Railway injects it for healthchecks.

CMD ["pnpm", "--filter", "@propninja/api", "start"]
