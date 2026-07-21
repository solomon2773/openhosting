# ── deps ────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── build ───────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Dummy URL so `prisma generate` succeeds; `next build` never touches the
# database (the app is fully dynamically rendered).
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV DIRECT_URL="postgresql://build:build@localhost:5432/build"
RUN npx prisma generate && npm run build
# Bundle the seed so it runs with plain node inside the runtime image
# (`docker compose exec app node prisma/seed.mjs`) — no Node needed on the host.
RUN npx esbuild prisma/seed.ts --bundle --platform=node --format=esm \
      --packages=external --outfile=prisma/seed.mjs

# ── prisma CLI (isolated, for migrate deploy at runtime) ────────────────────
FROM node:24-alpine AS prisma-cli
WORKDIR /cli
RUN npm init -y >/dev/null && npm install prisma@^7 && npm cache clean --force

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
# Schema + migrations and an isolated Prisma CLI for `migrate deploy`.
COPY --from=build --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts
COPY --from=prisma-cli --chown=nextjs:nodejs /cli/node_modules ./prisma-cli/node_modules
COPY --chown=nextjs:nodejs docker-entrypoint.sh ./
# lets prisma.config.ts resolve `prisma/config` from the isolated CLI install
RUN ln -s /app/prisma-cli/node_modules/prisma /app/node_modules/prisma && \
    chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
