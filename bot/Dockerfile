FROM node:22.11.0-alpine
WORKDIR /app

# python3/build-base compile the native @discordjs/opus binding; ffmpeg
# transcodes audio into Opus for Discord voice; yt-dlp downloads audio
# and pipes directly to ffmpeg (bypasses URL resolution and expiry issues).
RUN apk add --no-cache python3 build-base ffmpeg yt-dlp
# Overwrite the apk-installed yt-dlp with the same pre-downloaded binary
# the app image uses, to ensure version parity.
COPY bin/yt-dlp /usr/local/bin/yt-dlp

COPY bot/package*.json ./
RUN for i in $(seq 1 10); do \
      npm install --no-audit --no-fund --omit=dev && exit 0; \
      echo "Retry $i/10..."; \
      sleep 10; \
    done; \
    exit 1

COPY bot/ .

CMD ["node", "index.js"]
