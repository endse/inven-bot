import { prisma } from "@/lib/prisma";

export class ExportService {
  /**
   * Generates a CSV string for the entire inventory including total purchases, sales, and current stock.
   */
  static async getInventoryCSV(): Promise<string> {
    const products = await prisma.product.findMany({
      include: { transactions: true },
      orderBy: { name: 'asc' }
    });

    const csvRows = [
      ["S.No", "Name", "HSN", "Rate", "Total Purchases", "Total Sales", "Current Stock"]
    ];

    products.forEach((p, index) => {
      let purchases = 0;
      let sales = 0;

      p.transactions.forEach(tx => {
        if (tx.transactionType === "purchase") purchases += Number(tx.quantity);
        if (tx.transactionType === "sale") sales += Number(tx.quantity);
      });

      const stock = purchases - sales;

      csvRows.push([
        (index + 1).toString(),
        `"${(p.name || '').replace(/"/g, '""')}"`, // Escape quotes
        `"${p.hsn || ""}"`,
        p.lastRate?.toString() || "0",
        purchases.toString(),
        sales.toString(),
        stock.toString()
      ]);
    });

    return csvRows.map(row => row.join(",")).join("\n");
  }

  /**
   * Generates a CSV string for the approved invoice history.
   */
  static async getHistoryCSV(): Promise<string> {
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
          `"${(tx.product?.name || '').replace(/"/g, '""')}"`,
          tx.quantity.toString(),
          tx.rate?.toString() || "0",
          tx.amount?.toString() || "0"
        ]);
      });
    });

    return csvRows.map(row => row.join(",")).join("\n");
  }
}
