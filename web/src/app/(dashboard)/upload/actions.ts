"use server"

import { extractInvoiceItems } from "@/lib/ocr";
import { matchProduct } from "@/lib/matching";
import { prisma } from "@/lib/prisma";
import { InvoiceService } from "@/services/InvoiceService";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";

export async function processBatchInvoices(formData: FormData) {
  const files = formData.getAll("files") as File[];
  const transactionType = formData.get("type") as "purchase" | "sale";

  if (!files || files.length === 0) throw new Error("No files uploaded");

  const processingResults = await Promise.all(
    files.map(async (file) => {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const mimeType = file.type;
      const base64Image = buffer.toString('base64');
      const imageUrl = `data:${mimeType};base64,${base64Image}`;

      const draft = await prisma.invoiceDraft.create({
        data: {
          imageUrl,
          transactionType,
          status: "processing"
        }
      });

      // Enqueue the draft for background processing
      await prisma.uploadQueue.create({
        data: {
          draftId: draft.id,
          status: "pending"
        }
      });

      return { id: draft.id, success: true, queued: true };
    })
  );

  // Trigger background processing asynchronously (fire and forget)
  InvoiceService.processUploadQueueBatch(5).catch(err => {
    console.error("Async queue processing error:", err);
  });

  return processingResults;
}

export async function approveDraft(draftId: string, finalData: any) {
  const draft = await prisma.invoiceDraft.findUnique({ where: { id: draftId } });
  if (!draft) throw new Error("Draft not found");

  const { invoice_date, items } = finalData;
  const transactionType = draft.transactionType as "purchase" | "sale";

  await prisma.$transaction(async (tx) => {
    for (const item of items) {
      if (item.action === "ignore") continue;

      let productId = item.productId;
      if (item.action === "create_new" || !productId) {
        const newProduct = await tx.product.create({
          data: {
            name: item.product_name,
            lastRate: item.rate
          }
        });
        productId = newProduct.id;
      }

      await tx.transaction.create({
        data: {
          productId,
          invoiceDraftId: draftId,
          transactionType,
          transactionDate: new Date(invoice_date || new Date()),
          dateSource: invoice_date ? "extracted" : "current",
          quantity: item.quantity,
          rate: item.rate,
          amount: item.amount,
        }
      });
    }

    await tx.invoiceDraft.update({
      where: { id: draftId },
      data: { status: "approved" }
    });
  });
}

export async function rejectDraft(draftId: string) {
  await prisma.invoiceDraft.update({
    where: { id: draftId },
    data: { status: "rejected" }
  });
}
