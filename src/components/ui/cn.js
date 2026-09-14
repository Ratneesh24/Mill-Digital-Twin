/** Merge Tailwind class lists, resolving conflicts (e.g. `px-2` vs `px-4`). */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
