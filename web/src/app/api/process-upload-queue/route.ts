import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { extractInvoiceItems } from '@/lib/ocr';
import { matchProduct } from '@/lib/matching';

export const maxDuration = 60; // Max execution time for Vercel

export async function GET(req: Request) {
  try {
    // Auth check: verify token or allow if it's called internally by localhost queue worker
    // For simplicity, we just process exactly like process-queue does
    
    // Find pending or retryable failed tasks
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
      take: 2, // Process max 2 at a time to respect rate limits
      orderBy: { createdAt: 'asc' }
    });

    if (queueItems.length === 0) {
      return NextResponse.json({ message: 'No items to process', processed: 0 });
    }

    let processedCount = 0;

    for (const item of queueItems) {
      // Mark as processing
      await prisma.uploadQueue.update({
        where: { id: item.id },
        data: { status: 'processing' }
      });

      try {
        const draft = await prisma.invoiceDraft.findUnique({
          where: { id: item.draftId }
        });

        if (!draft) {
          throw new Error(`Draft ${item.draftId} not found`);
        }

        // Extract mimeType and base64 from imageUrl
        // imageUrl format: data:image/png;base64,iVBOR...
        const matches = draft.imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) {
          throw new Error('Invalid imageUrl format');
        }

        const mimeType = matches[1];
        const base64Image = matches[2];

        const extracted = await extractInvoiceItems(base64Image, mimeType);

        const draftItems = [];
        for (const extractedItem of extracted.items) {
          const match = await matchProduct(extractedItem.product_name);
          let itemStatus = 'pending';
          if (match && match.similarityScore > 95) {
            itemStatus = 'matched_high';
          } else if (match && match.similarityScore >= 60) {
            itemStatus = 'matched_low';
          } else {
            itemStatus = 'new';
          }
          draftItems.push({ 
            ...extractedItem, 
            match, 
            itemStatus, 
            action: match ? 'use_existing' : 'create_new' 
          });
        }

        // Successfully extracted and matched
        await prisma.$transaction([
          prisma.invoiceDraft.update({
            where: { id: draft.id },
            data: {
              extractedData: { invoice_date: extracted.invoice_date, items: draftItems },
              status: 'pending_review'
            }
          }),
          prisma.uploadQueue.delete({
            where: { id: item.id }
          })
        ]);

        processedCount++;
      } catch (error: any) {
        console.error(`Error processing upload queue item ${item.id}:`, error);

        const newAttempts = item.attempts + 1;
        
        if (newAttempts >= 3) {
          // Permanently fail the draft
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
          // Schedule retry: 5 minutes after 1st failure, 6 hours after 2nd failure
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

    return NextResponse.json({ message: 'Processed batch', processed: processedCount });
  } catch (error: any) {
    console.error('Queue processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
