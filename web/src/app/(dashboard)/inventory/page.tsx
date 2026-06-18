import { prisma } from "@/lib/prisma"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import Pagination from "@/components/Pagination"
import { InventoryService } from "@/services/InventoryService"

import InventoryFilter from "./InventoryFilter"
import DirectEntryDialog from "./DirectEntryDialog"

export const dynamic = 'force-dynamic';

export default async function InventoryPage(props: { searchParams: Promise<{ month?: string, page?: string }> }) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 20;

  const { inventory, displayMonth, totalPages } = await InventoryService.getCalculatedInventory(page, pageSize, searchParams.month);

  const allProducts = await prisma.product.findMany({
    select: { id: true, name: true, hsn: true },
    orderBy: { name: 'asc' }
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">Inventory Balance Sheet</h1>
        <div className="flex gap-4 items-center">
          <InventoryFilter currentMonth={displayMonth} />
          <DirectEntryDialog products={allProducts} defaultMonth={displayMonth} />
          <a href="/api/export/inventory" download>
            <Button variant="outline" className="gap-2">
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
          </a>
        </div>
      </div>
      <div className="border rounded-xl bg-white shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>S.no</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>H.S.N no</TableHead>
              <TableHead>Rate</TableHead>
              <TableHead className="text-right">Opening balance</TableHead>
              <TableHead className="text-right">Purchases</TableHead>
              <TableHead className="text-right">Sales</TableHead>
              <TableHead className="text-right font-bold">Balance Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {inventory.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">No inventory items found.</TableCell>
              </TableRow>
            )}
            {inventory.map(item => (
              <TableRow key={item.id}>
                <TableCell>{item.sno}</TableCell>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{item.hsn || "-"}</TableCell>
                <TableCell>₹{item.lastRate?.toString() || "0.00"}</TableCell>
                <TableCell className="text-right">{item.openingBalance}</TableCell>
                <TableCell className="text-right text-emerald-600">+{item.purchases}</TableCell>
                <TableCell className="text-right text-rose-600">-{item.sales}</TableCell>
                <TableCell className="text-right font-bold">{item.stock}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination totalPages={totalPages} currentPage={page} />
    </div>
  )
}
