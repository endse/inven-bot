import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function parseInvoiceDate(dateStr: string | null | undefined): Date {
  if (!dateStr || typeof dateStr !== 'string') return new Date();
  
  const cleanStr = dateStr.trim();
  
  // 1. Try YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanStr)) {
    const d = new Date(cleanStr);
    if (!isNaN(d.getTime())) return d;
  }
  
  // 2. Try DD-MM-YYYY or DD/MM/YYYY
  const match = cleanStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1; // 0-indexed
    const year = parseInt(match[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Fallback to standard new Date
  const d = new Date(cleanStr);
  if (!isNaN(d.getTime())) return d;

  return new Date();
}
