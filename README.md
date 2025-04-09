# 🎧 EchoDeck

**EchoDeck** is a collaborative streaming queue web app where creators can manage video queues and listeners can upvote or suggest tracks in real time. Built with **Next.js 14 App Router**, **Prisma**, **PostgreSQL**, and **NextAuth**, it delivers a smooth and interactive experience for managing media queues.

---

## 🚀 Features

- 🔐 **Google Authentication** via NextAuth
- 🎥 **Video Queue System** for creators
- 👍 **Upvote mechanism** to prioritize videos
- 👥 **Multiple user roles**: Creator & Listener
- 🧹 **Queue clearing logic** with persistent database sync
- 📡 **Dynamic rendering** of the current video and playlist
- 💾 **PostgreSQL + Prisma ORM** for type-safe DB operations
- ⚡ Real-time state updates (planned with websockets or polling)

---

## 🧱 Tech Stack

| Tech             | Description                                |
|------------------|--------------------------------------------|
| **Next.js 14**   | App Router for file-based routing          |
| **TypeScript**   | Strong typing across the app               |
| **PostgreSQL**   | Relational database                        |
| **Prisma**       | Type-safe ORM with codegen                 |
| **NextAuth**     | Auth system with Google OAuth              |
| **Tailwind CSS** | Styling framework (optional, if used)      |

---

## 🧠 Database Models

The app uses the following main Prisma models:

- `User` — Authenticated user info
- `Stream` — Represents each media item
- `CurrentStream` — Tracks the currently playing stream
- `Upvote` — Voting table for prioritizing queue

Refer to `prisma/schema.prisma` for detailed definitions.

---

## 🛠️ Setup Instructions

1. **Clone the repo**
   ```bash
   git clone https://github.com/yourusername/echodeck.git
   cd echodeck
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**

   Create a `.env` file in the root:

   ```env
   DATABASE_URL=postgresql://your-db-url
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   NEXTAUTH_SECRET=your-nextauth-secret
   ```

4. **Set up Prisma**
   ```bash
   npx prisma generate
   npx prisma migrate dev --name init
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

---

## 📁 Folder Structure

```
app/
│
├── api/
│   ├── streams/
│   │   ├── route.ts          # Fetch streams
│   │   └── clear/route.ts    # Clear queue logic
│   └── auth/[...nextauth]/   # NextAuth route handler
│
├── lib/
│   └── db.ts                 # Prisma client instance
│
├── creator/[creatorId]/      # Creator dashboard
└── ...
```

---

## 📌 Future Plans

- [ ] WebSocket support for real-time queue updates
- [ ] Admin dashboard for creators
- [ ] Spotify integration
- [ ] Listener chatroom feature


## 🤝 Contributing

Pull requests and feedback are welcome! Let's build a better streaming experience together.


## 📄 License

MIT © 2025 Aakash Joshi


Let me know if you'd like to add badges, a demo link, or tailor this for deployment (like Vercel/Render/etc).

```
