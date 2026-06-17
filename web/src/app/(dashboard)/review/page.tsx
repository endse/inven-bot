import { prisma } from "@/lib/prisma"
import ReviewClient from "./ReviewClient"

export const dynamic = 'force-dynamic';

export default async function ReviewPage() {
  const drafts = await prisma.invoiceDraft.findMany({
    where: { status: "pending_review" },
    orderBy: { createdAt: "asc" }
  })

  // We serialize drafts because extractedData is Json and needs to be passed to Client Component
  const serializedDrafts = drafts.map(d => ({
    ...d,
    extractedData: d.extractedData as any
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Review Queue</h1>
      <ReviewClient initialDrafts={serializedDrafts} />
    </div>
  )
}
