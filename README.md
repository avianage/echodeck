# 🎧 EchoDeck

**EchoDeck** is a high-performance, collaborative streaming queue engine built for creators and their audiences. It delivers real-time session synchronization, multi-platform content resolution (YouTube + Spotify), a democratic upvote queue, a social layer with friends and activity feeds, and a full admin/moderation suite — all in a single self-hostable Next.js application.

---

## 📦 Tech Stack

- **next, react**: Core UI and application framework.
- **@prisma/client, @prisma/adapter-pg, pg**: PostgreSQL ORM and database driver.
- **next-auth (@next-auth/prisma-adapter)**: Authentication and session management.
- **tailwindcss, framer-motion, lucide-react, shadcn-ui**: UI components, responsive styling, and animations.
- **zod**: Schema validation for API routes and forms.
- **resend, nodemailer**: Transactional email delivery for magic links.
- **react-player, react-youtube, react-lite-youtube-embed**: Cross-platform embedded media playback.
- **yt-dlp-exec, youtube-search-api**: Server-side YouTube resolution and track search.
- **spotify-web-api-node, spotify-url-info**: Spotify track metadata fetching and resolution.
- **axios, cheerio**: HTTP client and web scraping for fallback metadata resolution.

---

## ✅ Implemented Features

### Auth

- **Google OAuth**: One-click social sign-in via Google (route: `/api/auth/[...nextauth]`).
- **Magic Link OTP**: Passwordless authentication via email (route: `/auth/signin`).
- **Spotify Linking**: Connect a Spotify account for enhanced metadata and playlist resolution (route: `/auth/link-account`).
- **Username Setup**: Custom username claiming flow for first-time signups (route: `/auth/setup`).
- **Account Deletion**: Full account deletion with cascading cleanup of all associated data (route: `/api/user/delete`).

### Streams

- **Collaborative Queue**: Viewers can upvote/downvote tracks to dynamically prioritize playback (route: `/api/streams/[streamId]/vote`).
- **Playlist Import**: Batch import full Spotify or YouTube playlists into the active queue via YouTube's InnerTube API and Spotify Web API (route: `/api/streams/playlist`).
- **Stream Title**: Creators can set a custom display title for their session (route: `/api/streams/metadata`).
- **Stream Visibility**: Toggle streams between public and private at any time (route: `/api/streams/[streamId]/visibility`).
- **Fix-Video**: Automatically re-resolves broken or region-locked videos to working alternatives (route: `/api/streams/fix-video`).
- **Real-Time Sync**: Live queue and playback state delivered via native SSE. A DB polling fallback handles reconnections (route: `/api/streams/[streamId]/events`).
- **Heartbeat**: Creator presence tracking gating stream active state (route: `/api/streams/heartbeat`).

### RBAC & Moderation

- **Platform Roles**: Global hierarchy mapping users to `MEMBER`, `CREATOR`, or `OWNER` (schema: `PlatformRole`).
- **Stream-Level Moderation**: Creators can assign `MODERATOR` roles to viewers for specific sessions (route: `/api/streams/moderator`).
- **Access Requests**: Viewers can request access to private creator streams, supporting `PENDING`/`APPROVED`/`REJECTED` states (route: `/api/streams/access`).
- **Stream Banning**: Ban individual users from a specific stream (route: `/api/streams/ban`).
- **Platform Banning**: Owners can issue timed or permanent platform-wide bans via the admin panel (route: `/api/admin/ban`).

### Music Playback

- **Spotify → YouTube**: Automatically fetches Spotify metadata and finds the best matching YouTube video for playback.
- **Server-Side yt-dlp**: Bypasses client-side playback restrictions by resolving raw stream URLs on the server.
- **Cross-Platform Embeds**: Integrated players handling both YouTube and Spotify-resolved content (component: `PlayerSection.tsx`).

### Social

- **Friends System**: Send, accept, and reject friend requests. Block users (route: `/api/friends/`).
- **Activity Feed**: See what friends are currently listening to in real time (route: `/api/friends/activity`).
- **Favorites**: Save and quickly access your favorite creators (route: `/api/user/favorites`).
- **Party Code**: Each user has a unique invite code for sharing their stream directly (schema: `partyCode`).

### Discovery & Profiles

- **Public Feed**: Browse active, public creator sessions (route: `/discover`).
- **User Profiles**: Public profile pages showing display name, avatar, and stream status (route: `/user/[username]`).
- **Guest Access**: Unauthenticated users see blurred stream cards with an inline modal prompting sign-in (component: `GuestJoinModal.tsx`).

### Account & Settings

- **Profile Customization**: Update display name, username (with cooldown), and avatar.
- **Avatar System**: DiceBear-generated avatars with a custom avatar option for OWNER accounts.
- **Privacy Settings**: Toggle friend request visibility and stream discoverability (route: `/api/user/privacy`).
- **Connected Accounts**: Manage linked Google and Spotify providers independently (route: `/api/auth/disconnect-provider`).

### Admin/Owner

- **User Management Panel**: Search, ban, unban, delete users, or promote to `CREATOR` role (route: `/admin`).
- **Global Maintenance Mode**: Toggle the entire application offline for non-exempt users (schema: `MaintenanceMode`).
- **API Documentation**: Built-in Swagger UI at `/api/docs` (toggled by `ENABLE_API_DOCS`).

---

## 🏗️ Architecture Decisions

- **Role derivation strategy**: The `OWNER` account is created securely using the `ALLOW_OWNER_CREATION` environment variable during the first deployment.
- **Stream lifecycle**: A stream's active state and sync are strictly gated by the creator's presence heartbeat. A missed heartbeat within `HEARTBEAT_TIMEOUT_MS` marks the stream inactive.
- **Auth flow**: Hybrid approach using passwordless magic links (via Resend) combined with optional Spotify account linking for creator tools.
- **Playlist resolution**: YouTube playlists are fetched via YouTube's InnerTube API (`/youtubei/v1/browse`) to avoid dependency on brittle page scraping. Spotify playlists resolve through the Spotify Web API with a scraping fallback.
- **Guest discovery**: To increase conversions, guest discovery displays blurred cards with an inline sign-in modal rather than hard-blocking access to the page.
- **Sync strategy**: Real-time session state is delivered via native Server-Sent Events (SSE). The server maintains an active SSE connection per stream session and pushes `sync` and `keepalive` events. A database polling fallback runs alongside SSE to handle reconnections and brief disconnects.
- **Soft deletes**: User accounts use `deletedAt` for soft deletion, allowing cascaded cleanup before permanent removal.

---

## 🔧 Configuration & Environment

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. |
| `NEXTAUTH_URL` | Public canonical URL of your app (e.g., `https://echodeck.example.com`). |
| `NEXTAUTH_SECRET` | Randomly generated secret for NextAuth session cookie encryption. |
| `GOOGLE_CLIENT_ID` | Google OAuth application Client ID. |
| `GOOGLE_CLIENT_SECRET` | Google OAuth application Client Secret. |
| `SPOTIFY_CLIENT_ID` | Spotify Developer App Client ID. |
| `SPOTIFY_CLIENT_SECRET` | Spotify Developer App Client Secret. |
| `RESEND_API_KEY` | API key for transactional email delivery (magic links). |
| `ALLOW_OWNER_CREATION` | Feature flag (`true`/`false`) to allow first-time OWNER account registration. |
| `ENABLE_API_DOCS` | Feature flag (`true`/`false`) to expose Swagger UI at `/api/docs`. |

### Application Settings

| Variable | Default | Description |
|---|---|---|
| `USERNAME_COOLDOWN_DAYS` | `30` | Days between username changes. |
| `SESSION_MAX_AGE_DAYS` | `30` | Session max age in days. |
| `MAX_QUEUE_LENGTH` | `200` | Maximum tracks allowed in a stream queue. |
| `CACHE_TTL_HOURS` | `4` | YouTube resolve cache TTL in hours. |
| `MAGIC_LINK_EXPIRY_MINUTES` | `15` | Magic link token expiry in minutes. |
| `HEARTBEAT_TIMEOUT_MS` | `30000` | Heartbeat timeout window before a stream is marked inactive. |
| `HEARTBEAT_INTERVAL_MS` | `10000` | Heartbeat polling interval on the client. |
| `LOG_LEVEL` | `info` | Logging verbosity (`trace`, `debug`, `info`, `warn`, `error`). |

### Rate Limiting

| Variable | Default | Description |
|---|---|---|
| `RATE_LIMIT_SEARCH` | `30` | Max search requests per minute. |
| `RATE_LIMIT_RESOLVE` | `10` | Max resolve requests per minute. |
| `RATE_LIMIT_CREATE_STREAM` | `20` | Max queue additions per minute. |

### Health Check

| Variable | Default | Description |
|---|---|---|
| `HEALTH_ALLOWED_IPS` | `127.0.0.1,::1` | Comma-separated IPs allowed to call `/api/health`. |

---

## 🐳 Deployment

- **Dockerfile structure**: Multi-stage build (`builder` → `runner`). The `runner` stage installs `python3`, `ffmpeg`, and `yt-dlp` as native system dependencies required for server-side playback resolution.
- **docker-compose setup**: Configures the pre-built `echodeck` image on an isolated bridge network, exposing port `3002`, with secrets bound from `.env.production`.
- **Nginx Proxy Manager + Cloudflare DNS**: Recommended routing setup. NPM handles SSL termination and internal port mapping (to `3002`); Cloudflare manages DNS and edge caching.
- **Known deployment gotchas**:
  - **Prisma CLI**: The standalone Next.js build does not bundle the Prisma CLI. It must be installed globally in the runner stage to run migrations.
  - **`NEXTAUTH_URL`**: Must exactly match your deployed domain including protocol, or auth flows will fail silently.
  - **`server.js` vs `next start`**: The Docker container starts via `docker-bootstrap.sh`, which executes `node server.js` from the `.next/standalone` output directly.

---

## 🐛 Known Issues / In Progress

- **Mobile Playback Layouts**: Ongoing refinements to the fixed bottom navigation bar and inline video player sizing on mobile devices under heavy queue loads.

---

## 📋 Changelog (Latest Changes)

- **YouTube Playlist Fix**: Replaced broken `GetPlaylistData` scraper with YouTube's InnerTube API (`/youtubei/v1/browse`). Playlists now load reliably without requiring a YouTube Data API key.
- **Stream Title**: Creators can now set a custom display title for their active session.
- **Real-Time SSE Engine**: Replaced DB-only polling with a native SSE implementation. The server pushes live queue and playback events to clients, with DB polling retained as a fallback for reconnection resilience.
- **Health Checks**: Added `/api/health` endpoint for Docker container status monitoring.
- **Spotify Enhancements**: Fixed playlist regex issues, improved streaming resolution accuracy, and implemented Spotify account connection.
- **UI & Layout Fixes**: Addressed multiple mobile UI bugs affecting video players and the sign-up page.
- **Middleware Stability**: Refactored Next.js middleware in `middleware.ts` to resolve auth-guard issues.
- **Database & Setup**: Recreated initial Prisma migrations and fixed the `OWNER` creation environment variable logic.

---

## 📄 License

MIT © 2026 EchoDeck
