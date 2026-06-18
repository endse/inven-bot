import { NextResponse } from 'next/server';
import { InvoiceService } from '@/services/InvoiceService';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Max execution time for Vercel

export async function GET(req: Request) {
  try {
    const processedCount = await InvoiceService.processUploadQueueBatch(2);

    if (processedCount === 0) {
      return NextResponse.json({ message: 'No items to process', processed: 0 });
    }

    return NextResponse.json({ message: 'Processed batch', processed: processedCount });
  } catch (error: any) {
    console.error('Queue processing error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
