import { prisma } from './src/lib/prisma';

async function main() {
  const failed = await prisma.uploadQueue.findMany({ where: { status: 'failed' } });
  console.log('Failed:', failed);
  
  const processing = await prisma.uploadQueue.findMany({ where: { status: 'processing' } });
  console.log('Processing:', processing);
}

main().catch(console.error);
