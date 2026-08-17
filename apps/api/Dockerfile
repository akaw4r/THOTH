# ==== build ====
FROM node:22-bookworm-slim AS build
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
# Having openssl/libssl in the build makes Prisma generate the engine for openssl-3.0.x
# (same as the runtime); without it, Prisma falls back to 1.1.x and breaks at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
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
COPY apps/api apps/api

RUN npx prisma generate --schema apps/api/prisma/schema.prisma \
  && npm run build -w @thoth/shared \
  && npm run build -w @thoth/api

# ==== runtime ====
# Keeps the monorepo layout (/app/apps/api, /app/packages/shared) so that the
# workspace symlinks in node_modules/@thoth/* resolve correctly.
FROM node:22-bookworm-slim AS runtime
# NODE_ENV is controlled by compose (development in dev; production in the
# production overlay) — not baked into the image, to avoid forcing Secure cookies over http.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY --from=build /repo/node_modules ./node_modules
COPY --from=build /repo/packages/shared/package.json ./packages/shared/package.json
COPY --from=build /repo/packages/shared/dist ./packages/shared/dist
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh ./docker-entrypoint.sh
# The Prisma CLI does a write preflight on the engines directory when running
# `migrate deploy`; we make sure the non-root user owns those directories
# (the engines come pre-downloaded from the build stage, so there is no runtime download).
RUN chmod +x docker-entrypoint.sh \
  && chown -R node:node /app/node_modules/@prisma /app/node_modules/.prisma /app/node_modules/prisma

USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
