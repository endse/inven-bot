"use client"
import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { processBatchInvoices } from "./actions"
import { toast } from "sonner"
import { useDropzone } from "react-dropzone"
import { UploadCloud, FileImage, X, Loader2, Camera } from "lucide-react"
import { compressImage } from "@/lib/image"

export default function UploadPage() {
  const router = useRouter()
  const [files, setFiles] = useState<(File & { preview: string })[]>([])
  const [type, setType] = useState<"purchase" | "sale">("purchase")
  const [isProcessing, setIsProcessing] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [
      ...prev,
      ...acceptedFiles.map(file => Object.assign(file, {
        preview: URL.createObjectURL(file)
      }))
    ]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': []
    }
  });

  const removeFile = (name: string) => {
    setFiles(files => files.filter(file => file.name !== name));
  };

  useEffect(() => {
    // Revoke the data uris to avoid memory leaks
    return () => files.forEach(file => URL.revokeObjectURL(file.preview));
  }, [files]);

  const handleUpload = async () => {
    if (files.length === 0) return

    setIsProcessing(true)
    const formData = new FormData()
    formData.append("type", type)
    
    try {
      const compressedFiles = await Promise.all(files.map(f => compressImage(f)))
      compressedFiles.forEach(f => formData.append("files", f))
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
    <div className="space-y-8 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Upload Invoices</h1>
        <p className="text-muted-foreground mt-2">Upload multiple images at once to extract them using AI.</p>
      </div>

      <Card className="border-2 overflow-hidden shadow-lg shadow-primary/5">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 border-b">
          <CardTitle className="flex items-center justify-between">
            <span>Transaction Type</span>
            <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
              <button
                onClick={() => setType("purchase")}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${type === "purchase" ? 'bg-white dark:bg-slate-700 text-emerald-600 dark:text-emerald-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Purchase
              </button>
              <button
                onClick={() => setType("sale")}
                className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${type === "sale" ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
              >
                Sale
              </button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-10">
          <div className="flex justify-center mb-6">
             <input 
               type="file" 
               accept="image/*" 
               capture="environment" 
               id="camera-input" 
               className="hidden" 
               onChange={(e) => {
                 if (e.target.files && e.target.files.length > 0) {
                   onDrop(Array.from(e.target.files));
                 }
               }} 
             />
             <Button type="button" onClick={() => document.getElementById('camera-input')?.click()} variant="outline" className="w-full sm:w-auto font-semibold py-6 text-base border-primary/20 hover:bg-primary/5 text-primary">
               <Camera className="w-5 h-5 mr-2" />
               Capture Photo
             </Button>
          </div>
          <div 
            {...getRootProps()} 
            className={`
              border-3 border-dashed rounded-3xl p-12 text-center cursor-pointer transition-all duration-300
              flex flex-col items-center justify-center min-h-[300px]
              ${isDragActive ? 'border-primary bg-primary/5 scale-[1.02]' : 'border-slate-200 dark:border-slate-800 hover:border-primary/50 hover:bg-slate-50 dark:hover:bg-slate-900'}
            `}
          >
            <input {...getInputProps()} />
            <div className={`p-4 rounded-full mb-4 ${isDragActive ? 'bg-primary/20 text-primary' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
              <UploadCloud className={`w-10 h-10 ${isDragActive ? 'animate-bounce' : ''}`} />
            </div>
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300 mb-2">
              {isDragActive ? "Drop invoices here!" : "Drag & drop invoices"}
            </h3>
            <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Supports JPG, PNG, WEBP. We recommend uploading 5-10 receipts at a time for optimal processing speed.
            </p>
          </div>

          {files.length > 0 && (
            <div className="mt-10 animate-in slide-in-from-bottom-4 fade-in duration-500">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg flex items-center gap-2">
                  <FileImage className="h-5 w-5 text-primary" /> Selected Files ({files.length})
                </h3>
                <Button 
                  onClick={() => setFiles([])} 
                  variant="ghost" 
                  size="sm" 
                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  Clear All
                </Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                {files.map((file) => (
                  <div key={file.name} className="relative group rounded-xl overflow-hidden border bg-slate-50 dark:bg-slate-900 aspect-[3/4]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={file.preview}
                      alt={file.name}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
                      onLoad={() => { URL.revokeObjectURL(file.preview) }}
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeFile(file.name); }}
                        className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 hover:scale-110 transition-all shadow-lg"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end border-t pt-6">
                <Button 
                  onClick={handleUpload} 
                  disabled={isProcessing} 
                  className="h-14 px-8 text-lg rounded-xl shadow-lg shadow-primary/20 w-full sm:w-auto"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Processing {files.length} images...
                    </>
                  ) : (
                    `Upload & Extract ${files.length} Invoices`
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
