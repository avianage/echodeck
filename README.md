# 🎧 EchoDeck

**EchoDeck** is a high-performance, collaborative streaming queue engine built for creators and their audiences. It delivers real-time session synchronization, multi-platform content resolution (YouTube + Spotify), a democratic upvote queue, and a full admin/moderation suite — all in a single self-hostable Next.js application.

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

## ✅ Implemented Features

### Auth
- **Google OAuth**: One-click social sign-in via Google (route: `/api/auth/[...nextauth]`).
- **Magic Link OTP**: Passwordless authentication via email (route: `/auth/signin`).
- **Spotify Linking**: Connect a Spotify account for enhanced metadata and resolution (route: `/auth/link-account`).
- **Username Setup**: Custom username claiming flow for first-time signups (route: `/auth/setup`).

### Streams
- **Collaborative Queue**: Viewers can upvote/downvote tracks to dynamically prioritize playback (route: `/api/streams/[streamId]/vote`).
- **Playlist Import**: Batch import full Spotify or YouTube playlists into the active queue (route: `/api/streams/playlist`).
- **Fix-Video**: Automatically re-resolves broken or region-locked videos to working alternatives (route: `/api/streams/fix-video`).

### RBAC
- **Platform Roles**: Global hierarchy mapping users to `MEMBER`, `CREATOR`, or `OWNER` (schema: `PlatformRole`).
- **Stream-Level Moderation**: Creators can assign `MODERATOR` roles to viewers for specific sessions (schema: `StreamRole`).
- **Access Requests**: Viewers can request access to private creator streams, supporting pending/approved/rejected states (route: `/api/streams/access`).

### Music Playback
- **Spotify → YouTube**: Automatically fetches Spotify metadata and finds the best matching YouTube video for playback.
- **Server-Side yt-dlp**: Bypasses client-side playback restrictions by resolving raw stream URLs on the server.
- **Cross-Platform Embeds**: Integrated players capable of handling multiple formats smoothly (component: `PlayerSection.tsx`).

### Discovery
- **Public Feed**: Browse active, public creator sessions natively (route: `/discover`).
- **Guest Access**: Unauthenticated users see blurred stream cards with an inline modal prompting them to sign in (component: `GuestJoinModal.tsx`).

### Admin/Owner
- **User Management Panel**: Search, ban, unban, delete users, or promote users to `CREATOR` role (route: `/admin`).
- **Global Maintenance Mode**: Toggle the entire application offline for non-exempt users via the admin dashboard (schema: `MaintenanceMode`).

## 🏗️ Architecture Decisions
- **Role derivation strategy**: The `OWNER` account is created securely using the `NEXT_PUBLIC_ALLOW_OWNER_CREATION` environment variable during the first deployment.
- **Stream lifecycle**: A stream's active state and sync are strictly gated by the creator's presence heartbeat.
- **Auth flow**: Hybrid approach using passwordless magic links (via Resend) combined with Spotify account linking for creator tools.
- **Guest discovery**: To increase conversions, guest discovery displays blurred cards with an inline sign-in modal rather than hard-blocking access to the page.
- **Sync strategy**: Real-time session state is delivered via native Server-Sent Events (SSE). The server maintains an active SSE connection per stream session and pushes `sync` and `keepalive` events to connected clients. A database polling fallback runs alongside SSE to handle reconnections and clients that miss events during brief disconnects.

## 🔧 Configuration & Environment
- `DATABASE_URL`: PostgreSQL connection string.
- `NEXTAUTH_URL`: The public canonical URL of your app (e.g., `http://127.0.0.1:3000`).
- `NEXTAUTH_SECRET`: Randomly generated secret string to encrypt NextAuth session cookies.
- `GOOGLE_CLIENT_ID`: Google OAuth application Client ID.
- `GOOGLE_CLIENT_SECRET`: Google OAuth application Client Secret.
- `SPOTIFY_CLIENT_ID`: Spotify Developer App Client ID.
- `SPOTIFY_CLIENT_SECRET`: Spotify Developer App Client Secret.
- `RESEND_API_KEY`: API key for sending transactional emails.
- `NEXT_PUBLIC_ALLOW_OWNER_CREATION`: Feature flag (`true`/`false`) to allow the registration of the initial platform owner account.

## 🐳 Deployment
- **Dockerfile structure**: Utilizes a multi-stage build (`builder` → `runner`). The `runner` stage installs native system dependencies like `python3`, `ffmpeg`, and `yt-dlp` required for playback resolution.
- **docker-compose setup**: Configures the pre-built `echodeck` image to run on an isolated bridge network, exposing port `3002`, and binding secrets from `.env.production`.
- **Nginx Proxy Manager + Cloudflare DNS config**: Recommended routing setup. NPM handles SSL termination and internal port mapping (to `3002`), while Cloudflare manages DNS records and edge caching.
- **Known deployment gotchas**: 
  - **Prisma CLI**: The standalone Next.js build doesn't bundle the Prisma CLI. It must be explicitly installed globally in the runner stage to run migrations.
  - **`NEXTAUTH_URL`**: Must perfectly match your deployed domain (including protocol) or auth flows will fail.
  - **`server.js` vs `next start`**: The Docker container starts via `docker-bootstrap.sh`, which explicitly executes `node server.js` from the `.next/standalone` output rather than `npm start`.

## 🐛 Known Issues / In Progress
- **Mobile Playback Layouts**: Ongoing refinements to the fixed bottom navigation bar and inline video player sizing on mobile devices under heavy queue loads.

## 📋 Changelog (Latest Changes)
- **Real-time SSE Engine**: Replaced DB-only polling with a native SSE implementation. The server pushes live queue and playback events to clients, with DB polling retained as a fallback for reconnection resilience.
- **Health Checks**: Added `/api/health` endpoint for Docker container status monitoring.
- **Spotify Enhancements**: Fixed playlist regex issues, improved streaming resolution accuracy, and implemented Spotify account connection.
- **UI & Layout Fixes**: Addressed multiple mobile UI bugs affecting video players and the sign-up page.
- **Middleware Stability**: Refactored Next.js middleware in `proxy.ts` to resolve auth-guard issues.
- **Database & Setup**: Recreated initial Prisma migrations and fixed the `OWNER` creation environment variable logic.
- **Repository Maintenance**: Cleaned up the repository by untracking localized `docker-compose.yml` configurations.

---

## 📄 License
MIT © 2025 EchoDeck
