FROM node:22.11.0-alpine
WORKDIR /app

# python3/build-base compile the native @discordjs/opus binding; ffmpeg
# transcodes the resolved audio stream into Opus for Discord voice.
RUN apk add --no-cache python3 build-base ffmpeg

COPY package*.json ./
RUN for i in $(seq 1 10); do \
      npm install --no-audit --no-fund --omit=dev && exit 0; \
      echo "Retry $i/10..."; \
      sleep 10; \
    done; \
    exit 1

COPY . .

CMD ["node", "index.js"]
