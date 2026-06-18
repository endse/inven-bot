import { prisma } from './src/lib/prisma';
import { InvoiceService } from './src/services/InvoiceService';

async function m() {
  try {
    const r = await InvoiceService.processUploadQueueBatch(2);
    console.log("Result:", r);
  } catch (e) {
    console.error("Caught error:", e);
  }
}
m();
