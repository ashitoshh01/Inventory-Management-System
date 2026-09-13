# Multi-stage production Dockerfile for @repo/api (NestJS)

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat openssl

FROM base AS builder
WORKDIR /app

# Copy workspace configuration and dependency manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Install all dependencies and compile packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/database prisma:generate
RUN pnpm --filter @repo/types build
RUN pnpm --filter @repo/database build
RUN pnpm --filter @repo/api build

# Deploy production dependencies for @repo/api
RUN pnpm --filter @repo/api --prod deploy /app/pruned

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

RUN apk add --no-cache libc6-compat openssl curl

# Security: Non-root runtime user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs

COPY --from=builder --chown=nestjs:nodejs /app/pruned/node_modules ./node_modules
COPY --from=builder --chown=nestjs:nodejs /app/pruned/package.json ./package.json
COPY --from=builder --chown=nestjs:nodejs /app/apps/api/dist ./dist

USER nestjs

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/api/v1/health/liveness || exit 1

CMD ["node", "dist/main.js"]
