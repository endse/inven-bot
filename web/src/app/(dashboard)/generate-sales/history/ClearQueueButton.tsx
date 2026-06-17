"use client"

import { Button } from "@/components/ui/button"
import { Trash2 } from "lucide-react"
import { clearQueueAction } from "../actions"
import { toast } from "sonner"
import { useState } from "react"

export function ClearQueueButton() {
  const [isClearing, setIsClearing] = useState(false);

  const handleClear = async () => {
    if (!confirm("Are you sure you want to clear the entire queue?")) return;
    setIsClearing(true);
    try {
      await clearQueueAction();
      toast.success("Queue cleared successfully!");
    } catch (e: any) {
      toast.error("Failed to clear queue");
    }
    setIsClearing(false);
  }

  return (
    <Button 
      variant="ghost" 
      onClick={handleClear}
      disabled={isClearing}
      className="text-red-500 hover:text-red-600 hover:bg-red-50/50 font-medium rounded-full px-5 transition-colors"
    >
      <Trash2 className="h-4 w-4 mr-2" />
      {isClearing ? "Clearing..." : "Clear Queue"}
    </Button>
  );
}
