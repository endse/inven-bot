"use client"
import { useState } from "react"
import { deleteInvoiceDraft, updateInvoiceDraft } from "./actions"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function HistoryClient({ initialDrafts }: { initialDrafts: any[] }) {
  const router = useRouter()
  const [drafts, setDrafts] = useState(initialDrafts)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  
  const [editingDraft, setEditingDraft] = useState<any | null>(null)
  const [editForm, setEditForm] = useState<any[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [zoom, setZoom] = useState(1)

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this invoice? All associated transactions will be removed from your inventory.")) return;
    setDeletingId(id)
    try {
      await deleteInvoiceDraft(id)
      setDrafts(drafts.filter(d => d.id !== id))
      toast.success("Invoice and associated transactions deleted.")
      router.refresh()
    } catch (err) {
      toast.error("Failed to delete invoice")
    }
    setDeletingId(null)
  }

  const handleEditOpen = (draft: any) => {
    setEditingDraft(draft)
    setZoom(1)
    setEditForm(draft.transactions.map((t: any) => ({
      id: t.id,
      quantity: Number(t.quantity),
      rate: Number(t.rate || 0)
    })))
  }

  const handleEditSave = async () => {
    setIsSaving(true)
    try {
      await updateInvoiceDraft(editForm)
      
      const updatedDrafts = drafts.map(d => {
        if (d.id === editingDraft.id) {
          return {
            ...d,
            transactions: d.transactions.map((t: any) => {
              const updated = editForm.find(ef => ef.id === t.id)
              return updated ? { ...t, quantity: updated.quantity, rate: updated.rate } : t
            })
          }
        }
        return d
      })
      setDrafts(updatedDrafts)
      setEditingDraft(null)
      toast.success("Invoice transactions successfully updated.")
      router.refresh()
    } catch (err) {
      toast.error("Failed to save changes")
    }
    setIsSaving(false)
  }

  if (editingDraft) {
    return (
      <div className="flex h-[calc(100vh-10rem)] gap-6 items-start">
        <div className="w-1/2 h-full border rounded-lg bg-slate-100 flex flex-col relative overflow-hidden">
          <div className="absolute top-4 left-4 z-10">
            <button 
              onClick={() => setEditingDraft(null)}
              className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded border shadow-sm text-sm font-medium hover:bg-white"
            >
              ← Back
            </button>
          </div>
          <div className="absolute top-4 right-4 z-10 flex gap-2 bg-white/80 backdrop-blur-sm p-1 rounded-md shadow-sm border">
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="px-2 hover:bg-slate-100 rounded text-sm font-medium">-</button>
            <div className="px-2 py-1 text-sm font-medium">{Math.round(zoom * 100)}%</div>
            <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="px-2 hover:bg-slate-100 rounded text-sm font-medium">+</button>
            <button onClick={() => setZoom(1)} className="px-2 hover:bg-slate-100 rounded text-sm font-medium text-slate-500">Reset</button>
          </div>
          <div className="flex-1 overflow-auto p-4 cursor-grab active:cursor-grabbing flex items-center justify-center">
            <img 
              src={editingDraft.imageUrl} 
              alt="Invoice" 
              className="shadow-sm transition-transform duration-200" 
              style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
            />
          </div>
        </div>
        <div className="w-1/2 flex flex-col h-full bg-white border rounded-lg overflow-hidden">
          <div className="p-4 border-b bg-slate-50 flex justify-between items-center">
            <div>
              <h2 className="font-semibold text-lg">Edit Invoice Transactions</h2>
              <p className="text-sm text-slate-500">Update extracted line items to sync inventory</p>
            </div>
            <button 
              onClick={handleEditSave}
              disabled={isSaving}
              className="bg-emerald-600 text-white px-4 py-2 rounded-md font-medium text-sm hover:bg-emerald-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
          <div className="flex-1 overflow-auto p-4 space-y-4">
            {editingDraft.transactions.map((tx: any, idx: number) => {
              const formItem = editForm.find(ef => ef.id === tx.id)
              if (!formItem) return null
              
              return (
                <div key={tx.id} className="p-3 border rounded shadow-sm bg-slate-50 space-y-2">
                  <div className="text-xs font-semibold text-slate-500 uppercase">Item {idx + 1} ID: {tx.productId.slice(0, 8)}</div>
                  <div className="flex gap-4">
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-700">Quantity</label>
                      <input 
                        type="number" 
                        value={formItem.quantity}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setEditForm(editForm.map(ef => ef.id === tx.id ? { ...ef, quantity: val } : ef))
                        }}
                        className="w-full border rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs font-medium text-slate-700">Rate (₹)</label>
                      <input 
                        type="number" 
                        value={formItem.rate}
                        onChange={(e) => {
                          const val = Number(e.target.value)
                          setEditForm(editForm.map(ef => ef.id === tx.id ? { ...ef, rate: val } : ef))
                        }}
                        className="w-full border rounded px-2 py-1 text-sm bg-white"
                      />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {drafts.map(draft => {
        const totalItems = draft.transactions.length
        const totalAmount = draft.transactions.reduce((sum: number, t: any) => sum + (Number(t.quantity) * Number(t.rate || 0)), 0)
        
        return (
          <div key={draft.id} className="border bg-white rounded-lg overflow-hidden shadow-sm flex flex-col">
            <div className="h-48 bg-slate-100 overflow-hidden relative border-b">
              <img src={draft.imageUrl} alt="Invoice" className="w-full h-full object-cover" />
              <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded backdrop-blur-sm">
                {new Date(draft.createdAt).toLocaleDateString()}
              </div>
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="font-semibold">{draft.transactionType === "purchase" ? "Purchase Invoice" : "Sales Invoice"}</h3>
                  <p className="text-sm text-slate-500">{totalItems} items extracted</p>
                </div>
                <div className="text-right">
                  <span className="font-medium text-green-600">₹{totalAmount.toLocaleString()}</span>
                </div>
              </div>
              <div className="mt-auto pt-4 flex gap-2">
                <button 
                  onClick={() => handleEditOpen(draft)}
                  className="flex-1 px-3 py-1.5 border rounded text-sm font-medium hover:bg-slate-50 transition-colors text-slate-700"
                >
                  Edit
                </button>
                <button 
                  onClick={() => handleDelete(draft.id)}
                  disabled={deletingId === draft.id}
                  className="px-3 py-1.5 border border-red-200 text-red-600 rounded text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  {deletingId === draft.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
