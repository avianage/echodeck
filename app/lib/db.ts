import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { logger } from '@/lib/logger';

declare global {
  var prisma: PrismaClient | undefined;
}

const getPrismaClient = () => {
  if (globalThis.prisma) return globalThis.prisma;

  // Check if env var is missing during build
  if (!process.env.DATABASE_URL) {
    if (process.env.NODE_ENV === 'production') {
       
      logger.warn('⚠️ DATABASE_URL is missing. Prisma Client will not be initialized.');
    }
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const client = new PrismaClient({ adapter });

  if (process.env.NODE_ENV !== 'production') globalThis.prisma = client;
  return client;
};

export const prismaClient =
  globalThis.prisma ||
  (process.env.DATABASE_URL
    ? getPrismaClient()
    : (new Proxy(
        {},
        {
          get: (_, prop) => {
            if (prop === 'then') return undefined;
            return () => {
              throw new Error(
                `PrismaClient accessed at build time or without DATABASE_URL. Property: ${String(prop)}`,
              );
            };
          },
        },
      ) as unknown as PrismaClient));
