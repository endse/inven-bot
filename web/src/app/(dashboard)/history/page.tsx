import { prisma } from "@/lib/prisma"
import HistoryClient from "./HistoryClient"

import Pagination from "@/components/Pagination"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

export const dynamic = 'force-dynamic'

export default async function HistoryPage(props: { searchParams: Promise<{ page?: string }> }) {
  const searchParams = await props.searchParams;
  const page = parseInt(searchParams.page || "1", 10);
  const pageSize = 10;
  
  const totalCount = await prisma.invoiceDraft.count({ where: { status: "approved" } });
  const totalPages = Math.ceil(totalCount / pageSize);

  const draftsData = await prisma.invoiceDraft.findMany({
    where: { status: "approved" },
    select: { id: true, transactionType: true, status: true, extractedData: true, createdAt: true, updatedAt: true, transactions: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  })

  // Serialize Decimal to numbers to pass to Client Component
  const approvedDrafts = draftsData.map(draft => ({
    ...draft,
    extractedData: draft.extractedData as any,
    transactions: draft.transactions.map(t => ({
      ...t,
      quantity: t.quantity.toNumber(),
      rate: t.rate?.toNumber() ?? null,
      amount: t.amount?.toNumber() ?? null
    }))
  }))

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-slate-900">Invoice History</h1>
        <a href="/api/export/history" download>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Export CSV
          </Button>
        </a>
      </div>
      
      {approvedDrafts.length === 0 ? (
        <div className="border border-dashed rounded-lg p-12 text-center bg-slate-50">
          <p className="text-slate-500 text-lg">No processed invoices found.</p>
        </div>
      ) : (
        <>
          <HistoryClient initialDrafts={approvedDrafts} />
          <Pagination totalPages={totalPages} currentPage={page} />
        </>
      )}
    </div>
  )
}
