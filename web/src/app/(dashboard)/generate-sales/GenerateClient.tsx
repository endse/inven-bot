"use client"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Sparkles, Check, RefreshCw, DollarSign, Package, Trash2, LayoutList, History } from "lucide-react"
import { queueGenerateBillAction, approveBillAction, deleteBillAction } from "./actions"
import { toast } from "sonner"
import Link from "next/link"

const RANGES = [
  { id: "small", label: "Small Bill", min: 500, max: 1000 },
  { id: "medium", label: "Medium Bill", min: 1000, max: 3000 },
  { id: "large", label: "Large Bill", min: 3000, max: 5000 },
]

export default function GenerateClient({ initialDrafts = [] }: { initialDrafts?: any[] }) {
  const [selectedRange, setSelectedRange] = useState(RANGES[1])
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    const m = (d.getMonth() + 1).toString().padStart(2, '0');
    return `${d.getFullYear()}-${m}`;
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState<string | null>(null)
  
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null)
  
  const activeDraft = initialDrafts?.find(d => d.id === activeDraftId)
  const generatedData = activeDraft?.extractedData

  // Poll queue every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/process-queue').catch(e => console.error(e));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      await queueGenerateBillAction(selectedRange.min, selectedRange.max, selectedMonth)
      toast.success("Generation request added to queue!")
    } catch (err: any) {
      toast.error(err.message || "Failed to generate bill")
    }
    setIsGenerating(false)
  }

  const handleApprove = async () => {
    if (!activeDraft || !generatedData) return;
    setIsSaving(true)
    try {
      await approveBillAction(activeDraft.id, generatedData.items)
      toast.success("Bill approved and transactions recorded!")
      setActiveDraftId(null)
    } catch (err: any) {
      toast.error(err.message || "Failed to save bill")
    }
    setIsSaving(false)
  }

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setIsDeleting(id)
    try {
      await deleteBillAction(id)
      toast.success("Discarded auto-generated bill")
      if (activeDraftId === id) setActiveDraftId(null)
    } catch (err: any) {
      toast.error("Failed to delete bill")
    }
    setIsDeleting(null)
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 items-start relative animate-in fade-in zoom-in-95 duration-500">
      
      {/* Configuration & Queue Panel */}
      <div className="w-full lg:w-4/12 flex flex-col gap-6 shrink-0">
        
        {/* Generator Box */}
        <div className="bg-white/80 backdrop-blur-2xl border border-zinc-200/60 rounded-3xl shadow-sm p-6 relative overflow-hidden transition-all">
          <h2 className="font-semibold text-zinc-900 text-xl mb-6 flex items-center gap-2 tracking-tight">
            <Sparkles className="h-5 w-5 text-zinc-800" /> Setup Bill
          </h2>
          
          <div className="space-y-5 mb-6">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Select Target Month</label>
              <input 
                type="month" 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full h-12 px-4 rounded-xl border border-zinc-200 bg-white text-zinc-800 font-medium focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950 transition-all"
              />
            </div>

            <div className="grid grid-cols-1 gap-3">
              {RANGES.map(range => (
                <button
                  key={range.id}
                  onClick={() => setSelectedRange(range)}
                  className={`flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 ${
                    selectedRange.id === range.id 
                      ? 'border-zinc-900 bg-zinc-50 shadow-sm' 
                      : 'border-zinc-200/60 bg-transparent hover:border-zinc-300 hover:bg-zinc-50/50'
                  }`}
                >
                  <span className={`font-medium ${selectedRange.id === range.id ? 'text-zinc-900' : 'text-zinc-600'}`}>
                    {range.label}
                  </span>
                  <span className={`text-sm ${selectedRange.id === range.id ? 'font-semibold text-zinc-900' : 'text-zinc-400'}`}>
                    ₹{range.min} - ₹{range.max}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <Button 
            onClick={handleGenerate} 
            disabled={isGenerating || isSaving}
            className="w-full h-14 rounded-2xl text-lg font-medium bg-zinc-900 text-white hover:bg-zinc-800 transition-all active:scale-[0.98] shadow-lg shadow-zinc-900/10"
          >
            {isGenerating ? (
              <span className="flex items-center gap-2"><RefreshCw className="h-5 w-5 animate-spin text-zinc-400" /> Queuing...</span>
            ) : (
              <span className="flex items-center gap-2">Queue Magic Bill</span>
            )}
          </Button>

          <Link href="/generate-sales/history" className="w-full">
            <Button variant="outline" className="w-full h-12 rounded-2xl font-medium mt-3 border-zinc-200 text-zinc-700 hover:bg-zinc-100/50 transition-colors">
              <History className="h-4 w-4 mr-2 text-zinc-500" /> Queue History
            </Button>
          </Link>
          
          <div className="mt-4 text-center text-xs font-medium text-zinc-400">
            {initialDrafts.length} / 5 Pending Review
          </div>
        </div>
        
        {/* Queue List Box */}
        {initialDrafts.length > 0 && (
          <div className="bg-white/80 backdrop-blur-2xl border border-zinc-200/60 rounded-3xl shadow-sm overflow-hidden flex flex-col max-h-[500px]">
             <div className="px-6 py-5 bg-transparent border-b border-zinc-100 flex items-center gap-2 font-semibold text-zinc-800 tracking-tight">
               <LayoutList className="h-5 w-5 text-zinc-400" /> Pending Review
             </div>
             <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-zinc-50/30">
                {initialDrafts.map((draft: any) => (
                  <div 
                    key={draft.id}
                    onClick={() => setActiveDraftId(draft.id)}
                    className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${activeDraftId === draft.id ? 'bg-white border-zinc-300 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/60'}`}
                  >
                    <div>
                      <div className="text-sm font-semibold text-zinc-900">₹{Number(draft.extractedData?.totalAmount || 0).toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
                      <div className="text-xs font-medium text-zinc-500 mt-0.5">{draft.extractedData?.items?.length || 0} items</div>
                    </div>
                    <button 
                      onClick={(e) => handleDelete(draft.id, e)}
                      disabled={isDeleting === draft.id}
                      className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
             </div>
          </div>
        )}
      </div>

      {/* Preview Panel */}
      <div className="w-full lg:w-8/12 flex flex-col min-h-[600px] bg-white/80 backdrop-blur-2xl border border-zinc-200/60 rounded-3xl shadow-xl shadow-zinc-200/40 overflow-hidden">
        <div className="px-8 py-6 border-b border-zinc-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0">
          <div>
            <h2 className="font-semibold text-zinc-900 text-xl flex items-center gap-2 tracking-tight">
              Preview <DollarSign className="h-5 w-5 text-zinc-400" />
            </h2>
            <p className="text-sm text-zinc-500 mt-1">Review the generated bundle before approving.</p>
          </div>
          {generatedData && (
            <Button 
              onClick={handleApprove}
              disabled={isSaving}
              className="w-full sm:w-auto bg-zinc-900 hover:bg-zinc-800 text-white px-6 py-2.5 rounded-full font-medium text-sm shadow-sm transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? "Saving..." : <><Check className="h-4 w-4" /> Approve & Record Sales</>}
            </Button>
          )}
        </div>
        
        <div className="flex-1 p-8 bg-zinc-50/50">
          {!generatedData ? (
            <div className="h-full flex flex-col items-center justify-center text-center text-zinc-400 space-y-4 py-20">
              <Package className="h-16 w-16 text-zinc-200" />
              <p className="font-medium text-zinc-500">Select a pending bill to preview or queue a new one.</p>
            </div>
          ) : (
            <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white rounded-3xl border border-zinc-100 p-8 flex items-center justify-between shadow-sm">
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Total Amount</div>
                  <div className="text-4xl font-semibold tracking-tight text-zinc-900">₹{generatedData.totalAmount?.toLocaleString(undefined, {minimumFractionDigits: 2}) || 0}</div>
                </div>
                <div className="h-14 w-14 rounded-full bg-zinc-100 flex items-center justify-center border border-zinc-200/50">
                  <Check className="h-6 w-6 text-zinc-700" />
                </div>
              </div>

              <div className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden">
                <table className="w-full text-sm text-left">
                  <thead className="bg-zinc-50/50 text-zinc-500 font-medium border-b border-zinc-100">
                    <tr>
                      <th className="px-6 py-4">Product Name</th>
                      <th className="px-6 py-4">HSN</th>
                      <th className="px-6 py-4 text-center">Qty</th>
                      <th className="px-6 py-4 text-right">Rate</th>
                      <th className="px-6 py-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {generatedData.items?.map((item: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-50/30 transition-colors">
                        <td className="px-6 py-5 font-medium text-zinc-800">{item.product_name}</td>
                        <td className="px-6 py-5 text-zinc-500 text-sm">{item.hsn || '-'}</td>
                        <td className="px-6 py-5 text-center text-zinc-500">{item.quantity}</td>
                        <td className="px-6 py-5 text-right text-zinc-500">₹{Number(item.rate).toFixed(2)}</td>
                        <td className="px-6 py-5 text-right font-medium text-zinc-900">₹{Number(item.amount).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
      
    </div>
  )
}
