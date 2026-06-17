"use client"
import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { approveDraft, rejectDraft } from "../upload/actions"
import { toast } from "sonner"

export default function ReviewClient({ initialDrafts }: { initialDrafts: any[] }) {
  const [drafts, setDrafts] = useState(initialDrafts)
  const [activeDraft, setActiveDraft] = useState<any | null>(null)
  const [zoom, setZoom] = useState(1);
  
  if (drafts.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No pending invoices in the review queue!</div>
  }

  if (!activeDraft) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {drafts.map((draft) => (
          <Card key={draft.id} className="cursor-pointer hover:border-blue-500 transition-colors shadow-sm hover:shadow-md" onClick={() => setActiveDraft(draft)}>
            <CardHeader>
              <CardTitle>Draft ID: {draft.id.slice(0,8)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Type: <span className="font-medium capitalize">{draft.transactionType}</span></p>
              <p>Date: {draft.extractedData?.invoice_date || "Unknown"}</p>
              <p>Items Detected: {draft.extractedData?.items?.length || 0}</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/images/${draft.id}`} alt="thumbnail" className="mt-4 h-32 w-full object-cover rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // Active Draft View
  const handleApprove = async () => {
    try {
      await approveDraft(activeDraft.id, activeDraft.extractedData);
      setDrafts(drafts.filter(d => d.id !== activeDraft.id));
      setActiveDraft(null);
      setZoom(1);
      toast.success("Invoice approved and transactions recorded!")
    } catch (e) {
      toast.error("Error approving draft. Please try again.")
    }
  }

  const handleReject = async () => {
    try {
      await rejectDraft(activeDraft.id);
      setDrafts(drafts.filter(d => d.id !== activeDraft.id));
      setActiveDraft(null);
      setZoom(1);
      toast.success("Invoice rejected and removed from queue.")
    } catch (e) {
      toast.error("Error rejecting draft.")
    }
  }

  return (
    <div className="flex gap-6 items-start relative pb-12">
      <div className="w-1/2 h-[calc(100vh-8rem)] sticky top-6 border rounded-lg bg-slate-100 flex flex-col overflow-hidden">
        <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white/80 backdrop-blur-sm p-1 rounded-md shadow-sm border">
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}>-</Button>
          <div className="px-2 py-1 text-sm font-medium">{Math.round(zoom * 100)}%</div>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(3, z + 0.25))}>+</Button>
          <Button variant="ghost" size="sm" onClick={() => setZoom(1)}>Reset</Button>
        </div>
        <div className="flex-1 overflow-auto p-4 cursor-grab active:cursor-grabbing">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src={`/api/images/${activeDraft.id}`} 
            alt="Invoice" 
            className="shadow-sm transition-transform duration-200 origin-top-left" 
            style={{ transform: `scale(${zoom})`, minWidth: zoom > 1 ? '100%' : 'auto' }}
          />
        </div>
      </div>
      <div className="w-1/2 flex flex-col gap-4 overflow-visible">
        <div className="flex gap-2 mb-2 sticky top-0 bg-slate-50 z-10 py-2 border-b">
           <Button onClick={() => setActiveDraft(null)} variant="outline">Back to Queue</Button>
           <Button onClick={handleApprove} className="bg-emerald-600 hover:bg-emerald-700 ml-auto">Approve & Save</Button>
           <Button onClick={handleReject} variant="destructive">Reject</Button>
        </div>
        
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0">
            <CardTitle>Extracted Data ({activeDraft.transactionType})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 px-0">
            <div>
              <label className="text-sm font-medium">Invoice Date</label>
              <Input 
                value={activeDraft.extractedData.invoice_date || ""} 
                onChange={e => setActiveDraft({...activeDraft, extractedData: {...activeDraft.extractedData, invoice_date: e.target.value}})} 
              />
            </div>
            <div className="space-y-4 mt-4">
              <h3 className="font-semibold border-b pb-2">Line Items</h3>
              {activeDraft.extractedData.items.map((item: any, idx: number) => (
                <div key={idx} className="p-4 border rounded-lg shadow-sm space-y-3 bg-white">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Product Name</label>
                      <Input value={item.product_name} onChange={e => {
                        const newItems = [...activeDraft.extractedData.items];
                        newItems[idx].product_name = e.target.value;
                        setActiveDraft({...activeDraft, extractedData: {...activeDraft.extractedData, items: newItems}})
                      }} />
                    </div>
                    <div className="w-24">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Qty</label>
                      <Input type="number" value={item.quantity} onChange={e => {
                        const newItems = [...activeDraft.extractedData.items];
                        const val = Number(e.target.value);
                        newItems[idx].quantity = val;
                        newItems[idx].amount = val * Number(newItems[idx].rate || 0);
                        setActiveDraft({...activeDraft, extractedData: {...activeDraft.extractedData, items: newItems}})
                      }} />
                    </div>
                    <div className="w-32">
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rate</label>
                      <Input type="number" value={item.rate} onChange={e => {
                        const newItems = [...activeDraft.extractedData.items];
                        const val = Number(e.target.value);
                        newItems[idx].rate = val;
                        newItems[idx].amount = Number(newItems[idx].quantity || 0) * val;
                        setActiveDraft({...activeDraft, extractedData: {...activeDraft.extractedData, items: newItems}})
                      }} />
                    </div>
                  </div>
                  <div className="flex gap-2 items-center text-sm bg-slate-50 p-2 rounded">
                    <span className="font-medium text-slate-600">Action:</span>
                    <select 
                      className="border rounded p-1.5 flex-1 bg-white"
                      value={item.action} 
                      onChange={e => {
                        const newItems = [...activeDraft.extractedData.items];
                        newItems[idx].action = e.target.value;
                        // Also update productId if they explicitly switch to use_existing
                        if (e.target.value === "use_existing") {
                          newItems[idx].productId = item.match?.suggestedProductId;
                        }
                        setActiveDraft({...activeDraft, extractedData: {...activeDraft.extractedData, items: newItems}})
                      }}
                    >
                      <option value="create_new">✨ Create New Product</option>
                      {item.match?.suggestedProductId && (
                        <option value="use_existing">🔗 Link: {item.match.suggestedProductName} ({item.match.similarityScore.toFixed(0)}% match)</option>
                      )}
                      <option value="ignore">❌ Ignore Item</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
