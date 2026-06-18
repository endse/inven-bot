import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
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
        `"${p.name.replace(/"/g, '""')}"`, // Escape quotes
        `"${p.hsn || ""}"`,
        p.lastRate?.toString() || "0",
        purchases.toString(),
        sales.toString(),
        stock.toString()
      ]);
    });

    const csvContent = csvRows.map(row => row.join(",")).join("\n");

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="inventory-export-${new Date().toISOString().split('T')[0]}.csv"`
      }
    });
  } catch (error) {
    console.error("Export error", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
