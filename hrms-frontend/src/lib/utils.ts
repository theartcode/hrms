import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Shows only the last 4 characters — used anywhere a bank account number
// renders on screen, so it isn't fully legible on a shared screen/screenshot.
export function maskAccountNumber(accountNumber: string): string {
  const last4 = accountNumber.slice(-4)
  return `${"•".repeat(Math.max(accountNumber.length - 4, 0))}${last4}`
}
