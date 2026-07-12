import { prismaClient } from './app/lib/db';

async function main() {
  const creatorId = 'cmn066zcf000001p89sm5jl9t';

  const current = await prismaClient.currentStream.findUnique({ where: { userId: creatorId }, include: { stream: true } });
  console.log('CurrentStream:', JSON.stringify(current, null, 2));

  const streams = await prismaClient.stream.findMany({
    where: { userId: creatorId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  console.log(`\nRecent Stream rows for creator (${streams.length}):`);
  for (const s of streams) {
    console.log(`  id=${s.id} title=${s.title} extractedId=${s.extractedId} played=${s.played} isLive=${s.isLive} createdAt=${s.createdAt.toISOString()}`);
  }

  const blocked = await prismaClient.blockedVideo.findMany({ where: { videoId: '4NRXx6U8ABQ' } });
  console.log('\nBlockedVideo entries for 4NRXx6U8ABQ:', blocked);

  await prismaClient.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
