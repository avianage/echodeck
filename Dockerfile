# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for yt-dlp-exec and other native modules
RUN apk add --no-cache python3 build-base g++

# Install dependencies with increased memory limit
COPY package*.json ./
COPY prisma ./prisma/
ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN --mount=type=cache,target=/root/.npm \
    npm ci

# Generate Prisma client at build time — must happen while node_modules are writable
RUN npx prisma generate

# Copy source code and build the app
COPY . .

# After npm install, verify yt-dlp binary exists and is executable
RUN test -f ./node_modules/yt-dlp-exec/bin/yt-dlp || \
    (echo "❌ yt-dlp binary missing after install" && exit 1)

# Build the app with increased memory limit
ARG ALLOW_OWNER_CREATION
ENV ALLOW_OWNER_CREATION=$ALLOW_OWNER_CREATION
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies for yt-dlp (system package), ffmpeg, and python3
RUN apk add --no-cache python3 ffmpeg yt-dlp

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create user and set correct permission for prerender cache
RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs \
    && mkdir -p .next \
    && chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.js ./prisma.config.js
COPY --from=builder --chown=nextjs:nodejs /app/docker-bootstrap.sh ./docker-bootstrap.sh

# Explicitly copy generated Prisma client and WASM binaries
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Install full Prisma CLI in an isolated prefix for runtime migrations
# Consolidate all root-level work into one block
USER root
RUN npm install --prefix /prisma-cli prisma --no-save --ignore-scripts \
    && chown -R nextjs:nodejs /prisma-cli/node_modules/prisma \
    && chown -R nextjs:nodejs /prisma-cli/node_modules/.bin/prisma \
    && chown -R nextjs:nodejs /prisma-cli/node_modules/@prisma 2>/dev/null || true \
    && chown -R nextjs:nodejs /prisma-cli/node_modules/.cache 2>/dev/null || true \
    && chmod +x ./docker-bootstrap.sh

# Add a HEALTHCHECK before switching to nextjs user
HEALTHCHECK --interval=30s --timeout=15s --start-period=180s --retries=5 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

USER nextjs

ENV PORT=3002
EXPOSE 3002

# Use the bootstrap script to run migrations before starting the app
CMD ["./docker-bootstrap.sh"]
