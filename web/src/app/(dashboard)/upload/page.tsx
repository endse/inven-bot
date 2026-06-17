"use client"
import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { processBatchInvoices } from "./actions"
import { toast } from "sonner"

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<File[]>([])
  const [type, setType] = useState<"purchase" | "sale">("purchase")
  const [isProcessing, setIsProcessing] = useState(false)

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault()
    if (files.length === 0) return

    setIsProcessing(true)
    const formData = new FormData()
    formData.append("type", type)
    files.forEach(f => formData.append("files", f))
    
    try {
      await processBatchInvoices(formData)
      toast.success("Invoices successfully processed! Sent to Review Queue.")
      setFiles([])
      router.push("/review")
    } catch (err) {
      console.error(err)
      toast.error("Failed to process invoices. Please try again.")
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Upload Invoices (Batch)</h1>
      <Card>
        <CardHeader>
          <CardTitle>Select Images (5-10 recommended)</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpload} className="space-y-4">
            <div className="flex gap-4">
              <label><input type="radio" name="type" value="purchase" checked={type === "purchase"} onChange={() => setType("purchase")} /> Purchase</label>
              <label><input type="radio" name="type" value="sale" checked={type === "sale"} onChange={() => setType("sale")} /> Sale</label>
            </div>
            <Input type="file" multiple accept="image/*" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
            <Button type="submit" disabled={files.length === 0 || isProcessing}>
              {isProcessing ? `Processing ${files.length} images with AI... Please wait.` : `Upload & Extract ${files.length} Invoices`}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
