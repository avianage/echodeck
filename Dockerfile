# Build stage
FROM node:22.11.0-alpine AS builder
WORKDIR /app

# Install build dependencies for yt-dlp-exec and other native modules
RUN apk add --no-cache python3 build-base g++

# Install dependencies with increased memory limit
COPY package*.json ./
COPY prisma ./prisma/
ENV NODE_OPTIONS="--dns-result-order=ipv4first --max-old-space-size=4096"
RUN for i in $(seq 1 10); do \
      npm install --no-audit --no-fund --ignore-scripts && exit 0; \
      echo "Retry $i/10..."; \
      sleep 10; \
    done; \
    exit 1

# Generate Prisma client at build time — must happen while node_modules are writable
ENV NODE_OPTIONS="--dns-result-order=ipv4first --max-old-space-size=4096 --experimental-require-module"
RUN for i in $(seq 1 5); do \
      npx prisma generate && exit 0; \
      echo "Prisma generate retry $i/5..."; \
      sleep 5; \
    done; \
    exit 1

# Copy source code and build the app
COPY . .

# Build the app with increased memory limit
ARG ALLOW_OWNER_CREATION
ENV ALLOW_OWNER_CREATION=$ALLOW_OWNER_CREATION
ENV NEXT_TELEMETRY_DISABLED=1
RUN npx next build --webpack

# Bundle prisma CLI with all dependencies for runtime migrations
RUN node /app/scripts/bundle-prisma.js

# Production stage
FROM node:22.11.0-alpine AS runner
WORKDIR /app

# Install runtime dependencies for yt-dlp (system package), ffmpeg, and python3
RUN apk add --no-cache python3 ffmpeg yt-dlp
# Overwrite the apk-installed yt-dlp with the latest binary (pre-downloaded on
# the host by the deploy script to avoid Docker bridge network issues).
COPY bin/yt-dlp /usr/local/bin/yt-dlp

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

# Copy bundled Prisma CLI for runtime migrations
COPY --from=builder --chown=nextjs:nodejs /prisma-bundle/node_modules /prisma-cli/node_modules
USER root
RUN chmod +x ./docker-bootstrap.sh

# Add a HEALTHCHECK before switching to nextjs user
HEALTHCHECK --interval=30s --timeout=15s --start-period=180s --retries=5 \
  CMD wget -qO- --header="x-forwarded-for: 127.0.0.1" http://127.0.0.1:3002/api/health || exit 1

USER nextjs

ENV PORT=3002
EXPOSE 3002

# Use the bootstrap script to run migrations before starting the app
CMD ["./docker-bootstrap.sh"]
