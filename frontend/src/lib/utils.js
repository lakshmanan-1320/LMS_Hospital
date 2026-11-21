import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind classes with clsx conditionals safely
 */
export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

