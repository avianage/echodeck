# Deploying EchoDeck with Docker

This guide covers building and running EchoDeck in production using plain Docker.

## Prerequisites

- Docker installed on the host machine.
- A running PostgreSQL instance (external or on the same host).
- Google and Spotify Developer app credentials.
- A Resend account for transactional emails.

---

## Step 1: Configure Environment

Create a `.env.production` file in the `app/` directory with your production secrets:

```env
DATABASE_URL="postgresql://user:password@host:5432/echodeck"
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
SPOTIFY_CLIENT_ID="your-spotify-client-id"
SPOTIFY_CLIENT_SECRET="your-spotify-client-secret"
RESEND_API_KEY="your-resend-api-key"
```

| Variable                | Description                                  |
| :---------------------- | :------------------------------------------- |
| `DATABASE_URL`          | PostgreSQL connection string                 |
| `NEXTAUTH_URL`          | Your public-facing app URL                   |
| `NEXTAUTH_SECRET`       | Random secret — `openssl rand -base64 32`    |
| `GOOGLE_CLIENT_ID`      | Google OAuth Client ID                       |
| `GOOGLE_CLIENT_SECRET`  | Google OAuth Client Secret                   |
| `SPOTIFY_CLIENT_ID`     | Spotify Developer App Client ID              |
| `SPOTIFY_CLIENT_SECRET` | Spotify Developer App Client Secret          |
| `RESEND_API_KEY`        | Resend API key for transactional emails      |
| `ALLOW_OWNER_CREATION`  | Build-time arg — `true` on first deploy only |

---

## Step 2: Build the Image

Run from the `app/` directory:

```bash
docker build \
  --build-arg ALLOW_OWNER_CREATION=false \
  -t echodeck:latest .
```

> **First deploy only**: set `ALLOW_OWNER_CREATION=true` to enable the platform owner registration page. After the owner account is created, rebuild with `false`.

---

## Step 3: Run the Container

```bash
docker run -d \
  --name echodeck \
  --restart always \
  -p 3002:3002 \
  --env-file .env.production \
  echodeck:latest
```

The app will be available at `http://your-host:3002`.

On startup, `docker-bootstrap.sh` automatically runs `prisma migrate deploy` before starting the Next.js server — no manual migration step needed.

---

## Step 4: Verify

Check the container is healthy:

```bash
docker ps
docker logs echodeck
```

The built-in health endpoint is at:

```
GET /api/health
```

---

## Using Docker Compose

If you prefer Compose, update `docker-compose.yml` to point at your image and env file:

```yaml
services:
  app:
    image: echodeck:latest
    container_name: echodeck
    restart: always
    ports:
      - '3002:3002'
    env_file:
      - .env.production

networks:
  default:
    driver: bridge
```

Then run:

```bash
docker compose up -d
```

---

## Updating

```bash
# Rebuild with latest code
docker build -t echodeck:latest .

# Stop old container and start new one
docker stop echodeck && docker rm echodeck
docker run -d --name echodeck --restart always -p 3002:3002 --env-file .env.production echodeck:latest
```
