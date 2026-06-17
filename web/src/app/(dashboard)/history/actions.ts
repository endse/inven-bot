"use server"

import { prisma } from "@/lib/prisma"

export async function deleteInvoiceDraft(id: string) {
  // Cascading deletes in Prisma will automatically remove all associated Transaction records
  await prisma.invoiceDraft.delete({
    where: { id }
  })
}

export async function updateInvoiceDraft(transactions: { id: string, quantity: number, rate: number }[]) {
  await prisma.$transaction(async (tx: any) => {
    for (const item of transactions) {
      await tx.transaction.update({
        where: { id: item.id },
        data: {
          quantity: item.quantity,
          rate: item.rate,
          amount: item.quantity * item.rate
        }
      })
    }
  })
}
