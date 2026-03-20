#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy

echo "Starting the application..."
exec node server.js
```

---

## Why remove runtime `prisma generate`?
```
Build time:  npm ci → prisma generate → next build
             ↓
             Generated client baked into .next/standalone
             ↓
Runner stage: copies .prisma + @prisma/client + @prisma/engines
             ↓
Runtime:     prisma migrate deploy (applies any pending migrations)
             node server.js (uses already-generated client)