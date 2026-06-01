import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formats a duration in seconds into a standard M:SS string.
 */
export const formatTime = (seconds: number): string => {
  const m = Math.floor(Math.max(0, seconds) / 60);
  const s = Math.floor(Math.max(0, seconds) % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

/** Converts numeric player colors into CSS hex values. */
export function colorToHex(color: number) {
  return `#${color.toString(16).padStart(6, "0")}`;
}
