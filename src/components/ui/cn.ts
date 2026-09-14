/** Merge Tailwind class lists, resolving conflicts (e.g. `px-2` vs `px-4`). */
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
