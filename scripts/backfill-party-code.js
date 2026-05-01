const { PrismaClient } = await import('@prisma/client');
const crypto = await import('crypto');
const { config } = await import('dotenv');

config();

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ partyCode: null }, { partyCode: '' }],
    },
  });

  // eslint-disable-next-line no-console
  console.log(`Backfilling ${users.length} users...`);

  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { partyCode: crypto.randomUUID() },
    });
  }

  // eslint-disable-next-line no-console
  console.log('Done!');
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
