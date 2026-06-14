import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const streams = await prisma.$queryRawUnsafe(`
    SELECT id, title, "createdAt" FROM "Stream" ORDER BY "createdAt" DESC LIMIT 5;
  `);
  console.log(JSON.stringify(streams, null, 2));
  
  const currentStreams = await prisma.$queryRawUnsafe(`
    SELECT "userId", title, "updatedAt" FROM "CurrentStream" LIMIT 5;
  `);
  console.log('Current Streams:');
  console.log(JSON.stringify(currentStreams, null, 2));
}

main()
  .catch((e) => console.error(e))
  .finally(async () => await prisma.$disconnect());
