import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const drafts = await prisma.invoiceDraft.findMany({
      where: { status: "approved" },
      include: { transactions: { include: { product: true } } },
      orderBy: { createdAt: "desc" }
    });

    const csvRows = [
      ["Invoice Date", "Type", "Status", "Product", "Quantity", "Rate", "Total Amount"]
    ];

    drafts.forEach((draft) => {
      const extracted = draft.extractedData as any;
      const invoiceDate = extracted?.invoice_date || draft.createdAt.toISOString().split('T')[0];
      
      draft.transactions.forEach(tx => {
        csvRows.push([
          `"${invoiceDate}"`,
          `"${draft.transactionType}"`,
          `"${draft.status}"`,
          `"${tx.product.name.replace(/"/g, '""')}"`,
          tx.quantity.toString(),
          tx.rate?.toString() || "0",
          tx.amount?.toString() || "0"
        ]);
      });
    });

    const csvContent = csvRows.map(row => row.join(",")).join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="history-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error("Export error", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
