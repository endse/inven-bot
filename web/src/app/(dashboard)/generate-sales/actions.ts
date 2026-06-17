"use server"

import { prisma } from "@/lib/prisma";
import { generateSmartSale, GeneratedSaleItem } from "@/lib/generator";
import { revalidatePath } from "next/cache";

export async function queueGenerateBillAction(minAmount: number, maxAmount: number) {
  // Check how many pending generated bills exist (to avoid clutter)
  const pendingCount = await prisma.invoiceDraft.count({
    where: {
      imageUrl: "SYSTEM_GENERATED",
      status: "pending_review"
    }
  });

  if (pendingCount >= 5) {
    throw new Error("Queue Full: You already have 5 pending auto-generated bills. Please review or delete them before generating more.");
  }

  // Create a queue entry
  const queueItem = await prisma.generateQueue.create({
    data: {
      minAmount,
      maxAmount,
      status: "pending",
    }
  });

  revalidatePath("/generate-sales");
  revalidatePath("/generate-sales/history");
  
  // Also try to process queue immediately without blocking
  processQueueAction().catch(e => console.error("Immediate queue processing failed:", e));

  return queueItem;
}

export async function processQueueAction() {
  // Find one pending task that is due
  const task = await prisma.generateQueue.findFirst({
    where: {
      status: "pending",
      nextRetryAt: { lte: new Date() }
    },
    orderBy: { createdAt: 'asc' }
  });

  if (!task) return { processed: 0 };

  // Mark as processing
  await prisma.generateQueue.update({
    where: { id: task.id },
    data: { status: "processing", attempts: task.attempts + 1 }
  });

  try {
    const products = await prisma.product.findMany({
      select: { id: true, name: true, lastRate: true },
      where: { lastRate: { not: null } }
    });

    if (products.length === 0) {
      throw new Error("No products with rates found in the inventory to generate a sale from.");
    }

    const formattedProducts = products.map(p => ({
      id: p.id,
      name: p.name,
      rate: Number(p.lastRate)
    }));

    // Generate sale via Gemini
    const generated = await generateSmartSale(formattedProducts, task.minAmount, task.maxAmount);
    
    // Save to Persistent Database Queue as an InvoiceDraft
    await prisma.invoiceDraft.create({
      data: {
        imageUrl: "SYSTEM_GENERATED",
        transactionType: "sale",
        status: "pending_review",
        extractedData: {
          invoice_date: new Date().toISOString(),
          items: generated.items,
          totalAmount: generated.totalAmount
        } as any
      }
    });

    // Mark task completed
    await prisma.generateQueue.update({
      where: { id: task.id },
      data: { status: "completed", errorMessage: null }
    });

    revalidatePath("/generate-sales");
    revalidatePath("/generate-sales/history");
    return { processed: 1 };

  } catch (error: any) {
    const errMsg = error.message || "Unknown error";
    const isRateLimit = errMsg.includes("429") || errMsg.toLowerCase().includes("rate limit") || errMsg.toLowerCase().includes("quota");

    if (isRateLimit) {
      // Retry after 6 hours
      const nextRetry = new Date();
      nextRetry.setHours(nextRetry.getHours() + 6);
      
      await prisma.generateQueue.update({
        where: { id: task.id },
        data: { 
          status: "pending", 
          nextRetryAt: nextRetry,
          errorMessage: "Rate limit exceeded. Will retry in 6 hours."
        }
      });
    } else {
      // Other error, mark failed
      await prisma.generateQueue.update({
        where: { id: task.id },
        data: { 
          status: "failed", 
          errorMessage: errMsg
        }
      });
    }

    revalidatePath("/generate-sales");
    revalidatePath("/generate-sales/history");
    return { processed: 0, error: errMsg };
  }
}

export async function approveBillAction(draftId: string, items: GeneratedSaleItem[]) {
  if (!items || items.length === 0) {
    throw new Error("No items to save.");
  }

  await prisma.$transaction(async (tx) => {
    // Update the draft status to approved
    const draft = await tx.invoiceDraft.update({
      where: { id: draftId },
      data: { status: "approved" }
    });

    for (const item of items) {
      await tx.transaction.create({
        data: {
          productId: item.productId,
          invoiceDraftId: draft.id,
          transactionType: "sale",
          transactionDate: new Date(),
          dateSource: "current",
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }
      });
    }
  });

  revalidatePath("/generate-sales");
  revalidatePath("/inventory");
  revalidatePath("/history");
  
  return { success: true };
}

export async function deleteBillAction(draftId: string) {
  await prisma.invoiceDraft.delete({
    where: { id: draftId }
  });
  revalidatePath("/generate-sales");
  return { success: true };
}

export async function clearQueueAction() {
  await prisma.generateQueue.deleteMany({});
  revalidatePath("/generate-sales/history");
  return { success: true };
}
