const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Starting database cleanup...');
  
  // Delete in order of dependencies (or just one by one)
  // We'll use a transaction to be safe or just sequential calls.
  
  try {
    const tables = [
      'upvote',
      'currentStream',
      'sessionMember',
      'streamAccess',
      'listeningActivity',
      'friendship',
      'stream',
      'account',
      'session',
      'user'
    ];

    for (const table of tables) {
      console.log(`- Clearing table: ${table}`);
      await prisma[table].deleteMany({});
    }

    console.log('✅ Database cleared successfully.');
  } catch (error) {
    console.error('❌ Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
