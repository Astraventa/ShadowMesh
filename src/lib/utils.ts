import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format an ISO date string to a readable format
 * @param iso - ISO date string or null/undefined
 * @returns Formatted date string or "TBA" if invalid
 */
export function formatDate(iso?: string | null): string {
  if (!iso) return "TBA";
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return "TBA";
    
    // Format: "Jan 15, 2024" or "Jan 15, 2024, 2:30 PM"
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    
    // Check if time is included (not just date)
    const hasTime = iso.includes("T") && iso.includes(":");
    if (hasTime) {
      options.hour = "numeric";
      options.minute = "2-digit";
      options.hour12 = true;
    }
    
    return date.toLocaleDateString("en-US", options);
  } catch {
    return "TBA";
  }
}