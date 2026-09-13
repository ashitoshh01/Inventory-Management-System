# Multi-stage production Dockerfile for @repo/web (Next.js)

FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app

# Copy workspace configuration and dependency manifests
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml turbo.json tsconfig.json ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Install dependencies and build shared packages + web app
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/types build
RUN pnpm --filter @repo/ui build
RUN pnpm --filter @repo/web build

# Deploy production dependencies for @repo/web
RUN pnpm --filter @repo/web --prod deploy /app/pruned

FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

RUN apk add --no-cache curl

# Security: Non-root runtime user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/pruned/node_modules ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/pruned/package.json ./package.json
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./.next

USER nextjs

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000 || exit 1

CMD ["./node_modules/.bin/next", "start", "-p", "3000"]
