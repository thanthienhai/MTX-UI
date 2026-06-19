# MTX-UI frontend — Next.js 15 standalone build (npm, multi-stage).
# Build with BuildKit:
#   DOCKER_BUILDKIT=1 docker compose -f docker-compose-fe.yml build
#
# NOTE: NEXT_PUBLIC_* values are inlined at BUILD time (pass via build args).
# Server-only vars (MEDIAMTX_API_URL, MEDIAMTX_ADMIN_USER/PASS, MEDIAMTX_HLS_URL,
# RELAY_SESSION_SECRET) are read at RUNTIME — supply them via env_file/-e, not here.

# Uses npm (package-lock.json is the authoritative, in-sync lockfile;
# pnpm-lock.yaml in the repo is stale and missing deps).

# -----------------------
# Stage: base
# -----------------------
FROM node:20-alpine AS base

# -----------------------
# Stage: dependencies
# -----------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,id=npm-cache,target=/root/.npm \
    npm ci --no-audit --no-fund

# -----------------------
# Stage: builder
# -----------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Build-time public vars (inlined into the client bundle).
ARG NEXT_PUBLIC_MEDIAMTX_API_URL="/api/mediamtx"
ARG NEXT_PUBLIC_MEDIAMTX_HLS_URL=""
ARG NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL=""
ARG NEXT_PUBLIC_MEDIAMTX_METRICS_URL=""
ARG NEXT_PUBLIC_MEDIAMTX_PPROF_URL=""
ARG NEXT_PUBLIC_MEDIAMTX_RTMP_HOST=""
ARG NEXT_PUBLIC_MEDIAMTX_RTMP_ADDRESS=""
ARG NEXT_PUBLIC_MEDIAMTX_RTMPS_HOST=""
ARG NEXT_PUBLIC_MEDIAMTX_RTMPS_ADDRESS=""
ARG NEXT_PUBLIC_MEDIAMTX_SRT_HOST=""
ARG NEXT_PUBLIC_MEDIAMTX_SRT_ADDRESS=""
ARG NEXT_PUBLIC_BASE_PATH=""
ENV NEXT_PUBLIC_MEDIAMTX_API_URL=${NEXT_PUBLIC_MEDIAMTX_API_URL}
ENV NEXT_PUBLIC_MEDIAMTX_HLS_URL=${NEXT_PUBLIC_MEDIAMTX_HLS_URL}
ENV NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL=${NEXT_PUBLIC_MEDIAMTX_PLAYBACK_URL}
ENV NEXT_PUBLIC_MEDIAMTX_METRICS_URL=${NEXT_PUBLIC_MEDIAMTX_METRICS_URL}
ENV NEXT_PUBLIC_MEDIAMTX_PPROF_URL=${NEXT_PUBLIC_MEDIAMTX_PPROF_URL}
ENV NEXT_PUBLIC_MEDIAMTX_RTMP_HOST=${NEXT_PUBLIC_MEDIAMTX_RTMP_HOST}
ENV NEXT_PUBLIC_MEDIAMTX_RTMP_ADDRESS=${NEXT_PUBLIC_MEDIAMTX_RTMP_ADDRESS}
ENV NEXT_PUBLIC_MEDIAMTX_RTMPS_HOST=${NEXT_PUBLIC_MEDIAMTX_RTMPS_HOST}
ENV NEXT_PUBLIC_MEDIAMTX_RTMPS_ADDRESS=${NEXT_PUBLIC_MEDIAMTX_RTMPS_ADDRESS}
ENV NEXT_PUBLIC_MEDIAMTX_SRT_HOST=${NEXT_PUBLIC_MEDIAMTX_SRT_HOST}
ENV NEXT_PUBLIC_MEDIAMTX_SRT_ADDRESS=${NEXT_PUBLIC_MEDIAMTX_SRT_ADDRESS}
ENV NEXT_PUBLIC_BASE_PATH=${NEXT_PUBLIC_BASE_PATH}

RUN --mount=type=cache,id=next-cache,target=/app/.next/cache \
    npm run build

# -----------------------
# Stage: runner (minimal)
# -----------------------
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Next standalone server reads HOSTNAME (not HOST) to choose the bind address.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
RUN mkdir -p .next && chown nextjs:nodejs .next
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
