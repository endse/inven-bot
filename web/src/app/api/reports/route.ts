import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get("month");
  
  if (!month) return NextResponse.json({ error: "Month required" }, { status: 400 });

  const [year, m] = month.split("-");
  
  const products = await prisma.product.findMany({
    include: { transactions: true },
    orderBy: { name: 'asc' }
  });

  const targetMonthStart = new Date(Number(year), Number(m) - 1, 1);
  const targetMonthEnd = new Date(Number(year), Number(m), 1);

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(`GST_${month.replace('-', '_')}`);

  worksheet.columns = [
    { header: "S.no", key: "sno", width: 10 },
    { header: "Name", key: "name", width: 35 },
    { header: "H.S.N no", key: "hsn", width: 15 },
    { header: "Rate", key: "rate", width: 15 },
    { header: "Opening balance", key: "opening", width: 20 },
    { header: `${month} purchase`, key: "purchase", width: 20 },
    { header: "Sales", key: "sales", width: 15 },
    { header: "balance stock", key: "stock", width: 20 },
  ];

  products.forEach((p: any, index: number) => {
    let openingBalance = 0;
    let purchases = 0;
    let sales = 0;

    p.transactions.forEach((tx: any) => {
      const qty = Number(tx.quantity);
      if (tx.transactionDate < targetMonthStart) {
        if (tx.transactionType === "purchase") openingBalance += qty;
        if (tx.transactionType === "sale") openingBalance -= qty;
      } else if (tx.transactionDate >= targetMonthStart && tx.transactionDate < targetMonthEnd) {
        if (tx.transactionType === "purchase") purchases += qty;
        if (tx.transactionType === "sale") sales += qty;
      }
    });

    const stock = openingBalance + purchases - sales;

    // Only include products that have some activity or stock
    if (openingBalance > 0 || purchases > 0 || sales > 0 || stock > 0) {
      worksheet.addRow({
        sno: index + 1,
        name: p.name,
        hsn: p.hsn || "-",
        rate: Number(p.lastRate || 0),
        opening: openingBalance,
        purchase: purchases,
        sales: sales,
        stock: stock
      });
    }
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="GST_${month.replace('-', '_')}.xlsx"`
    }
  });
}
