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
    const validPage = Math.max(1, isNaN(page) ? 1 : page);
    const validPageSize = Math.min(100, Math.max(1, isNaN(pageSize) ? 10 : pageSize));

    const totalCount = await prisma.invoiceDraft.count({ where: { status: "approved" } });
    const totalPages = Math.ceil(totalCount / validPageSize);

    const draftsData = await prisma.invoiceDraft.findMany({
      where: { status: "approved" },
      select: { id: true, transactionType: true, status: true, extractedData: true, createdAt: true, updatedAt: true, transactions: true },
      orderBy: { createdAt: "desc" },
      skip: (validPage - 1) * validPageSize,
      take: validPageSize,
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

    return { approvedDrafts, totalPages, currentPage: validPage };
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
          },
          {
            status: 'processing',
            updatedAt: { lte: new Date(Date.now() - 5 * 60 * 1000) }
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
      // Optimistic locking to prevent duplicate processing by concurrent worker calls
      const affected = await prisma.uploadQueue.updateMany({
        where: {
          id: item.id,
          updatedAt: item.updatedAt
        },
        data: { status: 'processing' }
      });

      if (affected.count === 0) {
        continue;
      }

      try {
        const draft = await prisma.invoiceDraft.findUnique({
          where: { id: item.draftId }
        });

        if (!draft) {
          await prisma.uploadQueue.update({
            where: { id: item.id },
            data: { status: 'failed', errorMessage: `Draft ${item.draftId} not found`, attempts: 3 }
          });
          continue;
        }

        if (!draft.imageUrl || typeof draft.imageUrl !== 'string') {
          throw new Error('Missing or invalid imageUrl');
        }

        const prefixEnd = draft.imageUrl.indexOf(';base64,');
        if (prefixEnd === -1 || !draft.imageUrl.startsWith('data:')) {
          throw new Error('Invalid imageUrl format');
        }
        const mimeType = draft.imageUrl.substring(5, prefixEnd);
        const base64Image = draft.imageUrl.substring(prefixEnd + 8);

        const products = await prisma.product.findMany({ select: { name: true } });
        const productNames = products.map(p => p.name);

        const extracted = await extractInvoiceItems(base64Image, mimeType, productNames);
        
        if (!extracted || !Array.isArray(extracted.items)) {
          throw new Error('OCR returned invalid or missing items array');
        }

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
