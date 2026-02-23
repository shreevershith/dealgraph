import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatFunding(amount: number): string {
  if (amount >= 1_000_000_000) {
    const b = amount / 1_000_000_000;
    return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
  }
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}

export function stageColor(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("public")) return "#22c55e";
  if (s.includes("late")) return "#3b82f6";
  if (s.includes("series d") || s.includes("series c")) return "#8b5cf6";
  if (s.includes("series b")) return "#a78bfa";
  if (s.includes("series a")) return "#f59e0b";
  return "#6b7280";
}

export function scoreColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#f59e0b";
  if (score >= 4) return "#f97316";
  return "#ef4444";
}
