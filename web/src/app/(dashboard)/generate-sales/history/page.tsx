import { prisma } from "@/lib/prisma"
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw, ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ClearQueueButton } from "./ClearQueueButton"

export const dynamic = 'force-dynamic';

export default async function GenerateHistoryPage() {
  const queueItems = await prisma.generateQueue.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  });

  return (
    <div className="flex flex-col gap-8 max-w-6xl mx-auto py-4 animate-in fade-in duration-500">
      <div className="flex items-center justify-between bg-white/80 backdrop-blur-2xl p-6 rounded-3xl shadow-sm border border-zinc-200/60">
        <div className="flex items-center gap-5">
          <Link href="/generate-sales">
            <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full hover:bg-zinc-100 transition-colors">
              <ArrowLeft className="h-5 w-5 text-zinc-500" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-semibold text-zinc-900 tracking-tight">Queue History</h1>
            <p className="text-zinc-500 mt-1 font-medium">Track the status of your automated bill generation requests</p>
          </div>
        </div>
        <ClearQueueButton />
      </div>

      <div className="bg-white/80 backdrop-blur-2xl border border-zinc-200/60 rounded-3xl shadow-sm overflow-hidden">
        {queueItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-zinc-400 bg-zinc-50/50">
            <Clock className="h-12 w-12 text-zinc-300 mb-4" />
            <p className="font-medium">No generation requests found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-zinc-50/50 text-zinc-500 font-medium border-b border-zinc-200/60">
                <tr>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Amount Range</th>
                  <th className="px-8 py-5">Attempts</th>
                  <th className="px-8 py-5">Next Retry / Time</th>
                  <th className="px-8 py-5">Error / Info</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {queueItems.map((item) => {
                  let StatusIcon = Clock;
                  let statusColor = "text-zinc-600";
                  let bgStatus = "bg-zinc-100/80";
                  let iconColor = "text-zinc-500";
                  
                  if (item.status === "completed") {
                    StatusIcon = CheckCircle;
                    statusColor = "text-emerald-700";
                    bgStatus = "bg-emerald-50";
                    iconColor = "text-emerald-500";
                  } else if (item.status === "failed") {
                    StatusIcon = XCircle;
                    statusColor = "text-red-700";
                    bgStatus = "bg-red-50";
                    iconColor = "text-red-500";
                  } else if (item.status === "processing") {
                    StatusIcon = Loader2;
                    statusColor = "text-blue-700";
                    bgStatus = "bg-blue-50";
                    iconColor = "text-blue-500";
                  } else if (item.status === "pending") {
                    StatusIcon = RefreshCw;
                    statusColor = "text-amber-700";
                    bgStatus = "bg-amber-50";
                    iconColor = "text-amber-500";
                  }

                  const isDelayed = item.status === "pending" && new Date(item.nextRetryAt).getTime() > new Date().getTime();

                  return (
                    <tr key={item.id} className="hover:bg-zinc-50/30 transition-colors">
                      <td className="px-8 py-5">
                        <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold tracking-wide ${statusColor} ${bgStatus}`}>
                          <StatusIcon className={`h-3.5 w-3.5 ${iconColor} ${item.status === 'processing' ? 'animate-spin' : ''}`} />
                          <span className="capitalize">{item.status}</span>
                        </div>
                      </td>
                      <td className="px-8 py-5 font-medium text-zinc-800">
                        ${item.minAmount} - ${item.maxAmount}
                      </td>
                      <td className="px-8 py-5 text-zinc-500">
                        {item.attempts}
                      </td>
                      <td className="px-8 py-5 text-zinc-600">
                        {isDelayed ? (
                          <span className="text-amber-600 font-medium">
                            Retrying ~{new Date(item.nextRetryAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        ) : (
                          <span className="text-zinc-500">{new Date(item.createdAt).toLocaleString([], {month:'short', day:'numeric', hour: '2-digit', minute:'2-digit'})}</span>
                        )}
                      </td>
                      <td className="px-8 py-5 max-w-xs truncate text-zinc-500">
                        {item.errorMessage ? (
                          <div className="flex items-center gap-2 text-red-600 font-medium" title={item.errorMessage}>
                            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
                            <span className="truncate">{item.errorMessage}</span>
                          </div>
                        ) : (
                          <span className="text-zinc-300">-</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
