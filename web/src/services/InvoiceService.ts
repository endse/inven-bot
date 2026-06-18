import { prisma } from '@/lib/prisma';
import { extractInvoiceItems } from '@/lib/ocr';
import { matchProduct } from '@/lib/matching';

export class InvoiceService {
  /**
   * Enqueues a new invoice draft for processing.
   */
  static async enqueueDraft(draftId: string) {
    return await prisma.uploadQueue.create({
      data: {
        draftId: draftId,
        status: "pending"
      }
    });
  }

  /**
   * Retrieves paginated invoice history.
   */
  static async getPaginatedHistory(page: number, pageSize: number) {
    const totalCount = await prisma.invoiceDraft.count({ where: { status: "approved" } });
    const totalPages = Math.ceil(totalCount / pageSize);

    const draftsData = await prisma.invoiceDraft.findMany({
      where: { status: "approved" },
      select: { id: true, transactionType: true, status: true, extractedData: true, createdAt: true, updatedAt: true, transactions: true },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    const approvedDrafts = draftsData.map(draft => ({
      ...draft,
      extractedData: draft.extractedData as any,
      transactions: draft.transactions.map(t => ({
        ...t,
        quantity: t.quantity.toNumber(),
        rate: t.rate?.toNumber() ?? null,
        amount: t.amount?.toNumber() ?? null
      }))
    }));

    return { approvedDrafts, totalPages, currentPage: page };
  }

  /**
   * Processes the next batch of uploads in the background queue.
   */
  static async processUploadQueueBatch(batchSize: number = 2) {
    const queueItems = await prisma.uploadQueue.findMany({
      where: {
        OR: [
          { status: 'pending' },
          { 
            status: 'failed', 
            attempts: { lt: 3 },
            nextRetryAt: { lte: new Date() }
          }
        ]
      },
      take: batchSize,
      orderBy: { createdAt: 'asc' }
    });

    if (queueItems.length === 0) {
      return 0;
    }

    let processedCount = 0;

    for (const item of queueItems) {
      await prisma.uploadQueue.update({
        where: { id: item.id },
        data: { status: 'processing' }
      });

      try {
        const draft = await prisma.invoiceDraft.findUnique({
          where: { id: item.draftId }
        });

        if (!draft) throw new Error(`Draft ${item.draftId} not found`);

        const matches = draft.imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) throw new Error('Invalid imageUrl format');

        const mimeType = matches[1];
        const base64Image = matches[2];

        const extracted = await extractInvoiceItems(base64Image, mimeType);
        const draftItems = [];

        for (const extractedItem of extracted.items) {
          const match = await matchProduct(extractedItem.product_name);
          let itemStatus = 'pending';
          if (match && match.similarityScore > 95) itemStatus = 'matched_high';
          else if (match && match.similarityScore >= 60) itemStatus = 'matched_low';
          else itemStatus = 'new';
          
          draftItems.push({ 
            ...extractedItem, 
            match, 
            itemStatus, 
            action: match ? 'use_existing' : 'create_new' 
          });
        }

        await prisma.$transaction([
          prisma.invoiceDraft.update({
            where: { id: draft.id },
            data: {
              extractedData: { invoice_date: extracted.invoice_date, items: draftItems },
              status: 'pending_review'
            }
          }),
          prisma.uploadQueue.update({
            where: { id: item.id },
            data: { status: 'completed' }
          })
        ]);

        processedCount++;
      } catch (error: any) {
        console.error(`Error processing upload queue item ${item.id}:`, error);
        const newAttempts = item.attempts + 1;
        
        if (newAttempts >= 3) {
          await prisma.$transaction([
            prisma.invoiceDraft.update({
              where: { id: item.draftId },
              data: { status: 'rejected' }
            }),
            prisma.uploadQueue.update({
              where: { id: item.id },
              data: {
                status: 'failed',
                attempts: newAttempts,
                errorMessage: error.message || 'Unknown error'
              }
            })
          ]);
        } else {
          const delayMinutes = newAttempts === 1 ? 5 : (6 * 60);
          const nextRetryAt = new Date(Date.now() + delayMinutes * 60000);

          await prisma.uploadQueue.update({
            where: { id: item.id },
            data: {
              status: 'failed',
              attempts: newAttempts,
              nextRetryAt,
              errorMessage: error.message || 'Unknown error'
            }
          });
        }
      }
    }

    return processedCount;
  }
}
// Force reload
