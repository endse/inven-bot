import { prisma } from './src/lib/prisma';

async function main() {
  const pending = await prisma.uploadQueue.count({ where: { status: 'pending' } });
  const processing = await prisma.uploadQueue.count({ where: { status: 'processing' } });
  const failed = await prisma.uploadQueue.count({ where: { status: 'failed' } });
  const completed = await prisma.uploadQueue.count({ where: { status: 'completed' } });
  console.log(`Pending: ${pending}, Processing: ${processing}, Failed: ${failed}, Completed: ${completed}`);

  // Let's reset processing to pending
  if (processing > 0) {
    await prisma.uploadQueue.updateMany({
      where: { status: 'processing' },
      data: { status: 'pending' }
    });
    console.log('Reset processing to pending.');
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
