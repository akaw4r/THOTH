# The Playwright base image already ships Chromium and the system libs.
# The version MUST match the "playwright" npm package (apps/worker/package.json).
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS build
WORKDIR /repo

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/worker/package.json apps/worker/
COPY apps/web/package.json apps/web/
COPY e2e/package.json e2e/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api/prisma apps/api/prisma
COPY apps/worker apps/worker

RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w @thoth/shared \
  && npm run build -w @thoth/worker
# npm may hoist every worker dependency to the root node_modules, leaving no
# nested directory — guarantee it exists so the runtime COPY never fails.
RUN mkdir -p apps/worker/node_modules

# ==== runtime ====
# Preserves the monorepo layout: node_modules/@thoth/shared (symlink) →
# /app/packages/shared, and playwright nested in apps/worker/node_modules.
FROM mcr.microsoft.com/playwright:v1.62.1-noble AS runtime
# NODE_ENV controlled by compose (see the api Dockerfile).
WORKDIR /app

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/apps/worker/package.json ./apps/worker/package.json
COPY --from=build /repo/apps/worker/dist ./apps/worker/dist
COPY --from=build /repo/apps/worker/node_modules ./apps/worker/node_modules

USER pwuser
CMD ["node", "apps/worker/dist/main.js"]
