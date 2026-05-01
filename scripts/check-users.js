const { PrismaClient } = await import('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: {
      email: true,
      username: true,
      platformRole: true,
    },
  });
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(users, null, 2));
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
