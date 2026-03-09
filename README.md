# 🎧 EchoDeck

**EchoDeck** is a high-performance, collaborative streaming queue engine designed for creators and listeners. It allows real-time session synchronization and multi-platform content resolution via YouTube and Spotify.

> [!IMPORTANT]
> **Video Playback Restrictions**: Due to YouTube's owner restrictions, some videos (e.g., from VEVO, T-Series, or major music labels) cannot be played within the embedded player. This is a platform-level limitation.

---

## ✨ Key Features

### 📡 Real-time Collaborative Queue
*   **Dynamic Upvoting**: A democratic queue system where listeners can upvote suggestions to prioritize the next track.
*   **Creator Sovereignty**: Creators have full control over the playback, with absolute authority to skip, pause, or clear the queue.
*   **Persistent State**: All queue data and voting history are backed by PostgreSQL, ensuring session continuity even after restarts.

### 🧠 Content Resolution
EchoDeck features a multi-layered engine to resolve media from various sources:
*   **Spotify & YouTube Support**: Handle tracks or playlist URLs from both major platforms.
*   **Playlist Importing**: Batch-import entire YouTube or Spotify playlists directly into the live session queue.

### 🔄 Database-Backed Heartbeat Sync
*   **Custom Synchronization**: Uses a custom database-backed **Heartbeat System** for multi-listener synchronization without relying on expensive websocket services.
*   **Creator-to-Listener Sync**: The creator's player state (current time, pause/play status) is periodically pushed to the database and syncs across all listeners.

---

## 🛠️ Technical Details

### 🔊 Spotify Resolution
Since Spotify tracks cannot be directly embedded as video streams, EchoDeck implements the following resolution flow:
1.  **Metadata Retrieval**: Fetching track metadata (title, artist, album art) via fallback layers:
    *   Authenticated User OAuth Token.
    *   App-level Client Credentials.
    *   High-speed Scraper.
2.  **Mapping logic**: The metadata is used to resolve the corresponding audio/video on YouTube for playback.

### 🎥 Media Playback Note
While the application attempts to find the best matching media, some content is restricted from embedding by YouTube or the content owner.
*   **Server-Side Resolution**: We use `yt-dlp` on the server to attempt to resolve raw stream URLs for enhanced playback compatibility where possible.

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | [Next.js 15 (App Router)](https://nextjs.org/) |
| **Language** | [TypeScript](https://www.typescriptlang.org/) |
| **Database** | [PostgreSQL](https://www.postgresql.org/) |
| **ORM** | [Prisma](https://www.prisma.io/) |
| **Authentication** | [NextAuth.js (Google OAuth)](https://next-auth.js.org/) |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/) + [Framer Motion](https://www.framer.com/motion/) |
| **Media Resolution** | `yt-dlp-exec`, `youtube-search-api`, `spotify-url-info` |

---

## 🚀 Setup & Installation

### 1. Prerequisites
*   Node.js 18+
*   PostgreSQL Instance
*   YouTube API Key (Optional)
*   Spotify Developer Credentials

### 2. Environment Configuration
Create a `.env` or `.env.local` file:
```env
DATABASE_URL="postgresql://user:password@localhost:5432/echodeck"
NEXTAUTH_SECRET="your_secret_here"
GOOGLE_CLIENT_ID="your_google_id"
GOOGLE_CLIENT_SECRET="your_google_secret"
SPOTIFY_CLIENT_ID="your_spotify_id"
SPOTIFY_CLIENT_SECRET="your_spotify_secret"
```

### 3. Database Initialization
```bash
npx prisma generate
npx prisma migrate dev --name init
```

### 4. Run Development Server
```bash
npm run dev
```

---

## 📁 Repository Structure
```bash
app/
├── api/
│   ├── streams/
│   │   ├── heartbeat/   # Synchronization engine
│   │   ├── resolve/     # yt-dlp stream resolution
│   │   └── playlist/    # Multi-platform playlist importer
├── components/          # Premium UI components
├── lib/                 # Core logic & utilities
└── prisma/              # Database schema & migrations
```

---

## 📄 License
MIT © 2025 EchoDeck Team
