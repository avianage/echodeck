# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies for yt-dlp-exec and other native modules
RUN apk add --no-cache python3 build-base g++

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# After npm install, verify yt-dlp binary exists and is executable
RUN test -f ./node_modules/yt-dlp-exec/bin/yt-dlp || \
    (echo "❌ yt-dlp binary missing after install" && exit 1)
RUN chmod +x ./node_modules/yt-dlp-exec/bin/yt-dlp

# Copy source code
COPY . .

# Generate Prisma Client
RUN npx prisma generate

# Build the app
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

# Install runtime dependencies for yt-dlp
RUN apk add --no-cache python3 ffmpeg
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
# https://nextjs.org/docs/advanced-features/output-file-tracing
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.js ./prisma.config.js
COPY --from=builder --chown=nextjs:nodejs /app/docker-bootstrap.sh ./docker-bootstrap.sh

# Ensure yt-dlp binary is copied and executable in the runner stage
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/yt-dlp-exec/bin/yt-dlp ./node_modules/yt-dlp-exec/bin/yt-dlp

# Ensure the script is executable
USER root
RUN chmod +x ./docker-bootstrap.sh ./node_modules/yt-dlp-exec/bin/yt-dlp
USER nextjs

EXPOSE 3000

ENV PORT=3000

# Use the bootstrap script to run migrations before starting the app
CMD ["./docker-bootstrap.sh"]
