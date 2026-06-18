"use client"

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";
import { addDirectTransactionAction } from "./actions";
import { toast } from "sonner";

interface ProductOption {
  id: string;
  name: string;
  hsn: string | null;
}

export default function DirectEntryDialog({ 
  products, 
  defaultMonth 
}: { 
  products: ProductOption[];
  defaultMonth?: string;
}) {
  const [open, setOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [hsn, setHsn] = useState("");
  const [transactionType, setTransactionType] = useState<"purchase" | "sale">("purchase");
  
  // Set default date to the selected month's first day or today's date
  const [date, setDate] = useState(() => {
    if (defaultMonth && /^\d{4}-\d{2}$/.test(defaultMonth)) {
      return `${defaultMonth}-01`;
    }
    const today = new Date();
    const y = today.getFullYear();
    const m = (today.getMonth() + 1).toString().padStart(2, '0');
    const d = today.getDate().toString().padStart(2, '0');
    return `${y}-${m}-${d}`;
  });

  const [quantity, setQuantity] = useState<number>(0);
  const [rate, setRate] = useState<number>(0);
  const [amount, setAmount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  // Auto-fill HSN when product name matches an existing product
  useEffect(() => {
    const matched = products.find(p => p.name.toLowerCase() === productName.trim().toLowerCase());
    if (matched) {
      setHsn(matched.hsn || "");
    }
  }, [productName, products]);

  // Recalculate amount when quantity or rate changes
  useEffect(() => {
    setAmount(Number((quantity * rate).toFixed(2)));
  }, [quantity, rate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productName.trim()) {
      toast.error("Please enter a product name.");
      return;
    }
    if (quantity <= 0) {
      toast.error("Quantity must be greater than 0.");
      return;
    }

    setIsLoading(true);
    try {
      await addDirectTransactionAction({
        productName: productName.trim(),
        transactionType,
        date,
        quantity,
        rate,
        amount,
        hsn: hsn.trim() || undefined
      });
      toast.success("Transaction recorded successfully!");
      setOpen(false);
      
      // Reset form
      setProductName("");
      setHsn("");
      setQuantity(0);
      setRate(0);
      setAmount(0);
    } catch (err: any) {
      toast.error(err.message || "Failed to add transaction.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={
        <Button className="gap-2 bg-zinc-900 hover:bg-zinc-800 text-white rounded-xl">
          <Plus className="h-4 w-4" />
          Direct Entry
        </Button>
      } />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Direct Transaction</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Type</Label>
              <select 
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as "purchase" | "sale")}
                className="w-full h-10 px-3 rounded-lg border border-zinc-200 bg-white text-zinc-800 text-sm focus:outline-none focus:ring-1 focus:ring-zinc-950 focus:border-zinc-950"
              >
                <option value="purchase">Purchase</option>
                <option value="sale">Sale</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label>Date</Label>
              <Input 
                type="date" 
                value={date} 
                onChange={(e) => setDate(e.target.value)} 
                required 
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>Product Name</Label>
            <Input 
              type="text" 
              list="direct-products-datalist"
              value={productName} 
              onChange={(e) => setProductName(e.target.value)} 
              placeholder="e.g. 110mm coupler" 
              required 
            />
            <datalist id="direct-products-datalist">
              {products.map(p => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>

          <div className="space-y-1">
            <Label>HSN Code (Optional)</Label>
            <Input 
              type="text" 
              value={hsn} 
              onChange={(e) => setHsn(e.target.value)} 
              placeholder="e.g. 39174000" 
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label>Quantity</Label>
              <Input 
                type="number" 
                step="any"
                value={quantity || ""} 
                onChange={(e) => setQuantity(Number(e.target.value))} 
                placeholder="0"
                required 
              />
            </div>
            <div className="space-y-1">
              <Label>Rate</Label>
              <Input 
                type="number" 
                step="any"
                value={rate || ""} 
                onChange={(e) => setRate(Number(e.target.value))} 
                placeholder="0"
                required 
              />
            </div>
            <div className="space-y-1">
              <Label>Amount</Label>
              <Input 
                type="number" 
                step="any"
                value={amount || ""} 
                onChange={(e) => setAmount(Number(e.target.value))} 
                placeholder="0"
                required 
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-zinc-900 hover:bg-zinc-800 text-white"
            >
              {isLoading ? "Saving..." : "Save Entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
