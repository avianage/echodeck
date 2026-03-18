require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { partyCode: null },
        { partyCode: "" }
      ]
    }
  });
  
  console.log(`Backfilling ${users.length} users...`);
  
  for (const user of users) {
    await prisma.user.update({
      where: { id: user.id },
      data: { partyCode: crypto.randomUUID() }
    });
  }
  
  console.log("Done!");
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
