# 🎧 EchoDeck

**EchoDeck** is a high-performance, collaborative streaming queue engine built for creators and their audiences. It delivers real-time session synchronization, multi-platform content resolution (YouTube + Spotify), a democratic upvote queue, and a full admin/moderation suite — all in a single self-hostable Next.js application.

---

## ✨ Features

### 📡 Real-time Collaborative Queue
- **Dynamic Upvoting & Downvoting**: A democratic queue where listeners vote to prioritize the next track.
- **Creator Sovereignty**: Full playback control — skip, pause, clear queue, remove individual items.
- **Playlist Import**: Batch-import entire YouTube or Spotify playlists into the live queue.
- **Fix-Video**: Automatically re-resolve a broken or restricted video to a working alternative.
- **Recommendations**: Smart track suggestions based on the current queue context.

### 🔄 Heartbeat Sync Engine
- Uses a custom **database-backed heartbeat** for multi-listener synchronization — no WebSocket infrastructure needed.
- The creator's player state (current time, playback status) is periodically written to the database and polled by listeners to stay in sync.

### 🧠 Multi-Platform Content Resolution
- **Spotify → YouTube**: Fetches Spotify track metadata (title, artist, album art) via OAuth token, client credentials, or a scraper fallback, then resolves the best matching YouTube video.
- **Server-Side `yt-dlp` Resolution**: Resolves raw stream URLs server-side for enhanced playback compatibility with restricted content.
- **YouTube Search**: Integrated search API for direct YouTube track discovery.

### 👥 Roles & Permissions
- **Platform Roles**: `OWNER`, `CREATOR`, `VIEWER`
- **Stream-Level Roles**: Granular permissions (e.g., `vote:cast`, `queue:add`, `queue:manage`, `stream:manage`)
- **Moderators**: Creators can designate moderators with elevated queue management permissions.

### 🔒 Access Control & Privacy
- **Public / Private Accounts**: Creators can make their stream private, requiring explicit viewer approval via a friend/access request system.
- **Stream Access Requests**: Pending, approved, and rejected access states.
- **Guest Join**: Token-based guest access for unauthenticated listeners.
- **Ban System**: Permanent and time-limited bans, both at the stream and platform level.

### 🛡️ Admin Panel
- User management: search, view, ban, unban, delete users.
- **Assign Creator**: Promote users to the `CREATOR` platform role.
- **Maintenance Mode**: Take the platform offline for all non-exempt users via a toggle.
- Admin-only streams overview.

### 🔐 Authentication
- **Google OAuth** (primary sign-in)
- **Spotify Account Linking** (connect Spotify for enhanced track resolution)
- **Magic Link / Email OTP** via Resend (passwordless sign-in)
- Post-signup **Username Setup** flow
- Banned account redirect page

### 📱 Progressive Web App (PWA)
- Offline support with a custom offline page.
- Add-to-homescreen install prompt.
- Mobile-optimized UI with a fixed bottom navigation bar.

### 🔍 Discovery
- Public stream discovery page to find and join active creator sessions.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) |
| **ORM** | [Prisma 7 (pg adapter)](https://www.prisma.io/) |
| **Authentication** | [NextAuth.js v4](https://next-auth.js.org/) — Google OAuth, Spotify, Email |
| **Real-time** | Database-backed heartbeat polling |
| **Email** | [Resend](https://resend.com/) + Nodemailer |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/) + [shadcn/ui](https://ui.shadcn.com/) |
| **Media Resolution** | `yt-dlp-exec`, `youtube-search-api`, `spotify-url-info`, `spotify-web-api-node` |
| **Validation** | [Zod](https://zod.dev/) |
| **Containerization** | Docker (multi-stage, `node:20-alpine`) |

---

## 🚀 Setup & Installation

### Prerequisites
- Node.js 20+
- PostgreSQL instance
- Google OAuth credentials
- Spotify Developer app credentials
- Resend API key (for transactional emails)

### 1. Clone & Install
```bash
git clone <your-repo-url>
cd app
npm install
```

### 2. Environment Configuration
Copy the template and fill in your values:
```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_URL` | Your public app URL (e.g. `http://localhost:3000`) |
| `NEXTAUTH_SECRET` | Random secret — `openssl rand -base64 32` |
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret |
| `SPOTIFY_CLIENT_ID` | Spotify Developer App Client ID |
| `SPOTIFY_CLIENT_SECRET` | Spotify Developer App Client Secret |
| `RESEND_API_KEY` | Resend API key for transactional emails |
| `NEXT_PUBLIC_ALLOW_OWNER_CREATION` | Set to `true` only on first deploy to create the platform owner account |

### 3. Database Initialization
```bash
npx prisma generate
npx prisma migrate deploy
```

### 4. Run Development Server
```bash
npm run dev
```
The app will be available at `http://localhost:3000`.

---

## 🐳 Docker / Production

### Build & Run
The app is fully containerized. The multi-stage `Dockerfile` installs `yt-dlp`, `ffmpeg`, and `python3` at the system level in the production image and runs Prisma migrations automatically on startup via `docker-bootstrap.sh`.

> [!NOTE]
> The container runs on **port 3002** by default.

**Build the image:**
```bash
docker build \
  --build-arg NEXT_PUBLIC_ALLOW_OWNER_CREATION=false \
  -t echodeck:latest .
```

**Run with docker compose** (using a pre-built image):
```bash
# Create .env.production with all required secrets first
docker compose up -d
```

### Health Check
A built-in health endpoint is available at:
```
GET /api/health
```
This is used by Docker's `HEALTHCHECK` instruction.

### First-Time Owner Account
To create the first platform owner:
1. Pass `NEXT_PUBLIC_ALLOW_OWNER_CREATION=true` as a **Docker build arg**.
2. After the owner account is created, **redeploy with `false`** to prevent further owner self-registration.

---

## 📁 Project Structure

```
app/
├── app/
│   ├── api/
│   │   ├── streams/           # Queue, upvote/downvote, heartbeat, resolve, playlist, sync, fix-video, proxy...
│   │   ├── user/              # Profile, privacy, favorites, username, setup, delete...
│   │   ├── admin/             # User management, bans, assign-creator, maintenance, streams
│   │   ├── friends/           # Friend requests & activity feed
│   │   ├── auth/              # NextAuth handler
│   │   ├── config/            # Runtime app config
│   │   └── health/            # Health check endpoint
│   ├── components/
│   │   ├── admin/             # Admin-specific UI (UsersTable, etc.)
│   │   ├── StreamView.tsx     # Main listener/creator view
│   │   ├── StreamManagement.tsx # Creator stream management panel
│   │   ├── PlayerSection.tsx  # YouTube/embedded player
│   │   ├── QueueSection.tsx   # Queue display + voting
│   │   ├── SearchBar.tsx      # Track search
│   │   ├── PlaylistModal.tsx  # Playlist import modal
│   │   ├── BanModal.tsx       # Ban management modal
│   │   ├── GuestJoinModal.tsx # Guest access modal
│   │   ├── FriendActivityFeed.tsx
│   │   ├── BottomNav.tsx      # Mobile bottom navigation
│   │   └── Appbar.tsx         # Top navigation bar
│   ├── auth/                  # Auth pages (signin, setup, verify, banned, link-account...)
│   ├── admin/                 # Admin dashboard page
│   ├── dashboard/             # Creator/viewer dashboard
│   ├── stream/                # Creator stream control page
│   ├── party/[username]/      # Listener join page
│   ├── discover/              # Public stream discovery
│   ├── account/               # User account settings
│   ├── maintenance/           # Maintenance mode page
│   └── offline/               # Offline fallback page
├── lib/                       # Auth config, Prisma client, permissions, helpers
├── prisma/                    # Prisma schema & migrations
├── public/                    # Static assets
├── proxy.ts                   # Next.js middleware (CORS, auth guard, role gate)
├── Dockerfile                 # Multi-stage production Docker build
├── docker-compose.yml         # Compose config for pre-built image deployment
├── docker-bootstrap.sh        # Entrypoint: runs migrations then starts app
└── next.config.ts
```

---

## 🗺️ Pages

| Route | Description |
|---|---|
| `/` | Public landing page |
| `/discover` | Browse public streams |
| `/dashboard` | Authenticated user dashboard |
| `/stream` | Creator stream management (CREATOR/OWNER only) |
| `/party/[username]` | Join a creator's live session (authenticated) |
| `/account` | User account & profile settings |
| `/admin` | Platform admin panel (OWNER only) |
| `/auth/signin` | Sign-in (Google, Email magic link) |
| `/auth/setup` | Username setup (first login) |
| `/auth/verify` | Email OTP verification |
| `/auth/link-account` | Spotify account linking |
| `/auth/banned` | Banned account information page |
| `/maintenance` | Maintenance mode splash |
| `/offline` | PWA offline fallback |

---

## 📄 License
MIT © 2025 EchoDeck
