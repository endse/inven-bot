import { prisma } from "@/lib/prisma";

export class InventoryService {
  /**
   * Retrieves paginated inventory data with calculated balances for a specific month.
   */
  static async getCalculatedInventory(page: number, pageSize: number, monthParam?: string) {
    const validPage = Math.max(1, isNaN(page) ? 1 : page);
    const validPageSize = Math.min(100, Math.max(1, isNaN(pageSize) ? 10 : pageSize));

    const totalCount = await prisma.product.count();
    const totalPages = Math.ceil(totalCount / validPageSize);

    const products = await prisma.product.findMany({
      include: { transactions: true },
      orderBy: { name: 'asc' },
      skip: (validPage - 1) * validPageSize,
      take: validPageSize
    });

    let targetMonthStart = new Date();
    let displayMonth = "";

    if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
      const [y, m] = monthParam.split('-');
      targetMonthStart = new Date(Number(y), Number(m) - 1, 1);
      displayMonth = monthParam;
    } else {
      const latestTx = await prisma.transaction.findFirst({
        orderBy: { transactionDate: 'desc' }
      });
      if (latestTx) {
        targetMonthStart = new Date(latestTx.transactionDate.getFullYear(), latestTx.transactionDate.getMonth(), 1);
        const m = (targetMonthStart.getMonth() + 1).toString().padStart(2, '0');
        displayMonth = `${targetMonthStart.getFullYear()}-${m}`;
      }
    }
    
    const targetMonthEnd = new Date(targetMonthStart.getFullYear(), targetMonthStart.getMonth() + 1, 1);

    const inventory = products.map((p, index) => {
      let openingBalance = 0;
      let purchases = 0;
      let sales = 0;

      p.transactions.forEach(tx => {
        if (tx.transactionDate < targetMonthStart) {
          if (tx.transactionType === "purchase") openingBalance += Number(tx.quantity);
          if (tx.transactionType === "sale") openingBalance -= Number(tx.quantity);
        } else if (tx.transactionDate >= targetMonthStart && tx.transactionDate < targetMonthEnd) {
          if (tx.transactionType === "purchase") purchases += Number(tx.quantity);
          if (tx.transactionType === "sale") sales += Number(tx.quantity);
        }
      });

      const stock = openingBalance + purchases - sales;

      return { 
        ...p, 
        sno: (validPage - 1) * validPageSize + index + 1,
        openingBalance, 
        purchases, 
        sales, 
        stock 
      };
    });

    return {
      inventory,
      displayMonth,
      totalPages,
      currentPage: validPage
    };
  }
}
