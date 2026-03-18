# Standalone Dockerfile for roster (Next.js)
# Created by /prepare-app — works in this repo BEFORE monorepo import.
# /import-app will rewrite this to the Path C monorepo pattern.
# Build: docker build -t beacon-roster .

# ──── Stage 1: Builder ────
FROM node:20-alpine AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

COPY . .
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Build Next.js (produces .next/standalone)
RUN npx next build

# ──── Stage 2: Runner ────
FROM node:20-alpine AS runner
RUN apk add --no-cache libc6-compat openssl curl
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy standalone build output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Copy Prisma schema (needed at runtime for introspection)
COPY --from=builder /app/prisma ./prisma
# Copy Prisma generated client (Prisma 7 custom output path)
COPY --from=builder /app/src/generated/prisma ./src/generated/prisma

USER nextjs

EXPOSE 3005
ENV PORT=3005
ENV HOSTNAME="0.0.0.0"

CMD ["sh", "-c", "HOSTNAME=0.0.0.0 node server.js"]
