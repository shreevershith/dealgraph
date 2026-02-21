"use client";

import { useEffect, useState, useRef } from "react";
import { DealScore } from "@/lib/types";

function getScoreColor(score: number): string {
  if (score >= 8.5) return "#51cf66";
  if (score >= 7.0) return "#00d2a0";
  if (score >= 5.5) return "#ffd43b";
  if (score >= 4.0) return "#ffa94d";
  return "#ff6b6b";
}

const DIMENSIONS: {
  key: keyof DealScore["breakdown"];
  label: string;
  weight: string;
}[] = [
  { key: "team", label: "Team", weight: "30%" },
  { key: "market", label: "Market", weight: "25%" },
  { key: "traction", label: "Traction", weight: "20%" },
  { key: "competition", label: "Competition", weight: "15%" },
  { key: "financials", label: "Financials", weight: "10%" },
];

// ── Animated count-up hook ──

function useCountUp(target: number, duration: number, active: boolean) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target * 10) / 10);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, active]);

  return value;
}

function ScoreRing({ score, animate }: { score: number; animate: boolean }) {
  const [mounted, setMounted] = useState(false);
  const displayScore = useCountUp(score, 1000, animate);
  const color = getScoreColor(score);

  useEffect(() => {
    if (!animate) {
      setMounted(false);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const radius = 38;
  const stroke = 5;
  const center = radius + stroke;
  const size = center * 2;
  const circumference = 2 * Math.PI * radius;
  const progress = score / 10;
  const offset = circumference * (1 - progress);

  return (
    <div className="relative flex shrink-0 items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="#1a1a26"
          strokeWidth={stroke}
        />
        {/* Progress arc */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={animate && mounted ? offset : circumference}
          style={{
            transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)",
            filter: `drop-shadow(0 0 6px ${color}40)`,
          }}
        />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-[28px] font-bold leading-none tabular-nums tracking-tight"
          style={{ color }}
        >
          {animate ? displayScore : "--"}
        </span>
        <span className="mt-0.5 text-xs text-[var(--dg-dim)]">/ 10</span>
      </div>
    </div>
  );
}

function BreakdownBar({
  label,
  weight,
  value,
  delay,
  animate,
}: {
  label: string;
  weight: string;
  value: number;
  delay: number;
  animate: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const displayValue = useCountUp(value, 800, animate);
  const color = getScoreColor(value);

  useEffect(() => {
    if (!animate) {
      setMounted(false);
      return;
    }
    const id = setTimeout(() => setMounted(true), delay);
    return () => clearTimeout(id);
  }, [delay, animate]);

  return (
    <div className="flex items-center gap-3">
      <div className="flex w-[120px] shrink-0 items-baseline gap-1.5">
        <span className="text-xs font-medium text-[var(--dg-text)]">
          {label}
        </span>
        <span className="text-[10px] text-[var(--dg-dim)]">({weight})</span>
      </div>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1a1a26]">
        <div
          className="h-full rounded-full"
          style={{
            width: animate && mounted ? `${(value / 10) * 100}%` : "0%",
            backgroundColor: color,
            boxShadow: animate && mounted ? `0 0 8px ${color}30` : "none",
            transition: "width 0.8s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        />
      </div>
      <span
        className="w-[32px] shrink-0 text-right text-sm font-semibold tabular-nums"
        style={{ color: animate ? color : "var(--dg-dim)" }}
      >
        {animate ? displayValue : "--"}
      </span>
    </div>
  );
}

// ── Skeleton for loading state ──

function ScorecardSkeleton() {
  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2.5 border-b border-[var(--dg-border)] px-4 py-2">
        <h2 className="text-sm font-medium text-[var(--dg-text)]">Deal Score</h2>
      </div>
      <div className="flex flex-1 items-center gap-4 px-4 py-3">
        {/* Skeleton ring */}
        <div className="relative flex shrink-0 items-center justify-center">
          <div
            className="h-[86px] w-[86px] animate-pulse rounded-full"
            style={{
              background: "conic-gradient(var(--dg-border) 0deg, transparent 120deg, var(--dg-border) 360deg)",
              mask: "radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 5px))",
              WebkitMask: "radial-gradient(farthest-side, transparent calc(100% - 5px), black calc(100% - 5px))",
            }}
          />
        </div>
        {/* Skeleton bars */}
        <div className="flex flex-1 flex-col gap-1.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-[120px] shrink-0">
                <div className="h-3 w-16 animate-pulse rounded bg-[var(--dg-border)]" />
              </div>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#1a1a26]">
                <div
                  className="h-full animate-pulse rounded-full bg-[var(--dg-border)]"
                  style={{ width: `${30 + i * 10}%` }}
                />
              </div>
              <div className="h-4 w-[32px] shrink-0 animate-pulse rounded bg-[var(--dg-border)]" />
            </div>
          ))}
        </div>
      </div>
      {/* Skeleton footer */}
      <div className="border-t border-[var(--dg-border)] px-4 py-2">
        <div className="h-6 w-48 animate-pulse rounded-full bg-[var(--dg-border)]" />
      </div>
    </div>
  );
}

interface DealScorecardProps {
  score?: DealScore;
  loading?: boolean;
}

export default function DealScorecard({ score, loading = false }: DealScorecardProps) {
  const [animate, setAnimate] = useState(false);

  // Trigger animation when score arrives
  useEffect(() => {
    if (score) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
    setAnimate(false);
  }, [score]);

  if (loading && !score) {
    return <ScorecardSkeleton />;
  }

  const overallColor = score ? getScoreColor(score.overall) : "var(--dg-dim)";

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="border-b border-[var(--dg-border)] px-4 py-2">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-medium text-[var(--dg-text)]">
            Deal Score
          </h2>
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 items-center gap-4 px-4 py-3">
        <ScoreRing score={score?.overall ?? 0} animate={animate} />
        <div className="flex flex-1 flex-col gap-1.5">
          {DIMENSIONS.map((dim, i) => (
            <BreakdownBar
              key={dim.key}
              label={dim.label}
              weight={dim.weight}
              value={score?.breakdown[dim.key] ?? 0}
              delay={i * 100}
              animate={animate}
            />
          ))}
        </div>
      </div>

      {/* Recommendation Badge */}
      <div className="border-t border-[var(--dg-border)] px-4 py-2">
        <div className="flex items-center gap-2.5">
          <span className="text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">
            Recommendation
          </span>
          {score ? (
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold transition-opacity duration-500"
              style={{
                backgroundColor: `${overallColor}18`,
                color: overallColor,
                border: `1px solid ${overallColor}30`,
                opacity: animate ? 1 : 0,
              }}
            >
              {score.recommendation}
            </span>
          ) : (
            <span className="text-xs text-[var(--dg-dim)]">--</span>
          )}
        </div>
      </div>
    </div>
  );
}
