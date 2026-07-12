#!/usr/bin/env node
/**
 * One-off seed: creates the EchoDeck bot service account.
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." npx tsx prisma/seed-bot-user.ts
 *
 * Idempotent — safe to re-run. If the username already exists, the existing
 * user's id is printed and no row is modified.
 *
 * After running, copy the printed id into your env files:
 *   BOT_SERVICE_USER_ID=<id>
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const BOT_USERNAME = 'echodeck-bot';

async function main() {
  const existing = await prisma.user.findUnique({
    where: { username: BOT_USERNAME },
    select: { id: true, platformRole: true, displayName: true },
  });

  if (existing) {
    console.log('Bot service user already exists — no changes made.');
    console.log(`  id:           ${existing.id}`);
    console.log(`  username:     ${BOT_USERNAME}`);
    console.log(`  displayName:  ${existing.displayName}`);
    console.log(`  platformRole: ${existing.platformRole}`);
    console.log(`\nSet in your .env / .env.production:\n  BOT_SERVICE_USER_ID=${existing.id}`);
    return;
  }

  const user = await prisma.user.create({
    data: {
      username: BOT_USERNAME,
      displayName: 'EchoDeck Bot',
      platformRole: 'CREATOR',
      isPublic: true,
    },
  });

  console.log('✅ Bot service user created.');
  console.log(`  id:           ${user.id}`);
  console.log(`  username:     ${user.username}`);
  console.log(`  displayName:  ${user.displayName}`);
  console.log(`  platformRole: ${user.platformRole}`);
  console.log(`\nSet in your .env / .env.production:\n  BOT_SERVICE_USER_ID=${user.id}`);
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
