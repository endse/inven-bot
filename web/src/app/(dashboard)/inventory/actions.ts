"use server"

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import { parseInvoiceDate } from "@/lib/utils";

export async function addDirectTransactionAction(data: {
  productName: string;
  transactionType: "purchase" | "sale";
  date: string;
  quantity: number;
  rate: number;
  amount: number;
  hsn?: string;
}) {
  const { productName, transactionType, date, quantity, rate, amount, hsn } = data;
  
  if (!productName || !transactionType || !date || quantity <= 0) {
    throw new Error("Invalid input data");
  }

  const txDate = parseInvoiceDate(date);

  await prisma.$transaction(async (tx) => {
    // 1. Find or create product
    let product = await tx.product.findUnique({
      where: { name: productName }
    });

    if (!product) {
      product = await tx.product.create({
        data: {
          name: productName,
          hsn: hsn || null,
          lastRate: rate
        }
      });
    } else {
      // Update product lastRate and optionally HSN
      await tx.product.update({
        where: { id: product.id },
        data: {
          lastRate: rate,
          ...(hsn && !product.hsn ? { hsn } : {}) // Only set HSN if not already set
        }
      });
    }

    // 2. Create direct transaction
    await tx.transaction.create({
      data: {
        productId: product.id,
        transactionType,
        transactionDate: txDate,
        dateSource: "current",
        quantity,
        rate,
        amount
      }
    });
  });

  revalidatePath("/inventory");
  revalidatePath("/");
  
  return { success: true };
}
