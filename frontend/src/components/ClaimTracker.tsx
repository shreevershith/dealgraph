"use client";

import { useState, useEffect } from "react";
import { Claim } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CATEGORY_CONFIG: Record<
  Claim["category"],
  { label: string; bg: string; text: string; border: string }
> = {
  market_size: {
    label: "Market",
    bg: "rgba(59, 130, 246, 0.12)",
    text: "#60a5fa",
    border: "rgba(59, 130, 246, 0.25)",
  },
  traction: {
    label: "Traction",
    bg: "rgba(108, 92, 231, 0.12)",
    text: "#a78bfa",
    border: "rgba(108, 92, 231, 0.25)",
  },
  team: {
    label: "Team",
    bg: "rgba(0, 210, 160, 0.12)",
    text: "#00d2a0",
    border: "rgba(0, 210, 160, 0.25)",
  },
  competition: {
    label: "Competition",
    bg: "rgba(255, 169, 77, 0.12)",
    text: "#ffa94d",
    border: "rgba(255, 169, 77, 0.25)",
  },
  financial: {
    label: "Financial",
    bg: "rgba(250, 204, 21, 0.12)",
    text: "#facc15",
    border: "rgba(250, 204, 21, 0.25)",
  },
};

const STATUS_CONFIG: Record<
  Claim["status"],
  { label: string; color: string; bold: boolean }
> = {
  verified: { label: "Verified", color: "#00d2a0", bold: false },
  partial: { label: "Partial", color: "#ffa94d", bold: false },
  unverified: { label: "Unverified", color: "#8888a0", bold: false },
  red_flag: { label: "RED FLAG", color: "#ff6b6b", bold: true },
};

// ── Skeleton row for loading state ──

function SkeletonRow() {
  return (
    <TableRow className="border-b-[var(--dg-border)]">
      <TableCell className="py-3 pl-4">
        <div className="h-3 w-5 animate-pulse rounded bg-[var(--dg-border)]" />
      </TableCell>
      <TableCell className="py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-[80%] animate-pulse rounded bg-[var(--dg-border)]" />
          <div className="h-3 w-[50%] animate-pulse rounded bg-[var(--dg-border)]" />
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="h-5 w-16 animate-pulse rounded-full bg-[var(--dg-border)]" />
      </TableCell>
      <TableCell className="py-3">
        <div className="h-4 w-20 animate-pulse rounded bg-[var(--dg-border)]" />
      </TableCell>
      <TableCell className="py-3">
        <div className="space-y-1.5">
          <div className="h-3 w-[70%] animate-pulse rounded bg-[var(--dg-border)]" />
          <div className="h-3 w-[40%] animate-pulse rounded bg-[var(--dg-border)]" />
        </div>
      </TableCell>
    </TableRow>
  );
}

interface ClaimTrackerProps {
  claims?: Claim[];
  loading?: boolean;
}

export default function ClaimTracker({ claims, loading = false }: ClaimTrackerProps) {
  const [visibleRows, setVisibleRows] = useState<Set<number>>(new Set());

  // Staggered fade-in when claims arrive
  useEffect(() => {
    if (!claims || claims.length === 0) {
      setVisibleRows(new Set());
      return;
    }
    // Reset then stagger
    setVisibleRows(new Set());
    const timeouts: NodeJS.Timeout[] = [];
    claims.forEach((_, i) => {
      timeouts.push(
        setTimeout(() => {
          setVisibleRows((prev) => new Set(prev).add(i));
        }, i * 100)
      );
    });
    return () => timeouts.forEach(clearTimeout);
  }, [claims]);

  const hasClaims = claims && claims.length > 0;

  const verified = hasClaims ? claims.filter((c) => c.status === "verified").length : 0;
  const unverified = hasClaims ? claims.filter((c) => c.status === "unverified").length : 0;
  const partial = hasClaims ? claims.filter((c) => c.status === "partial").length : 0;
  const redFlags = hasClaims ? claims.filter((c) => c.status === "red_flag").length : 0;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--dg-border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-medium text-[var(--dg-text)]">
            Claims Tracker
          </h2>
          {hasClaims && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: "rgba(108, 92, 231, 0.12)",
                color: "var(--dg-accent)",
                border: "1px solid rgba(108, 92, 231, 0.25)",
              }}
            >
              {claims.length} claims analyzed
            </span>
          )}
          {loading && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: "rgba(108, 92, 231, 0.12)",
                color: "var(--dg-accent)",
                border: "1px solid rgba(108, 92, 231, 0.25)",
              }}
            >
              Analyzing...
            </span>
          )}
        </div>

        {/* Status summary chips */}
        {hasClaims && (
          <div className="flex items-center gap-3 text-[11px]">
            {verified > 0 && (
              <span className="flex items-center gap-1.5 text-[#00d2a0]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#00d2a0]" />
                {verified} verified
              </span>
            )}
            {unverified > 0 && (
              <span className="flex items-center gap-1.5 text-[#8888a0]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#8888a0]" />
                {unverified} unverified
              </span>
            )}
            {partial > 0 && (
              <span className="flex items-center gap-1.5 text-[#ffa94d]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ffa94d]" />
                {partial} partial
              </span>
            )}
            {redFlags > 0 && (
              <span className="flex items-center gap-1.5 font-semibold text-[#ff6b6b]">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-[#ff6b6b]" />
                {redFlags} red {redFlags === 1 ? "flag" : "flags"}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {/* Empty state */}
        {!loading && !hasClaims && (
          <div className="flex h-full items-center justify-center py-10">
            <div className="text-center">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--dg-border)]">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--dg-dim)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="opacity-50"
                >
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
                </svg>
              </div>
              <p className="text-sm text-[var(--dg-dim)]">
                No claims analyzed yet
              </p>
              <p className="mt-1 text-xs text-[var(--dg-dim)] opacity-60">
                Upload a deck to begin
              </p>
            </div>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && !hasClaims && (
          <Table>
            <TableHeader>
              <TableRow className="border-b-[var(--dg-border)] hover:bg-transparent">
                <TableHead className="w-[40px] text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">#</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Claim</TableHead>
                <TableHead className="w-[110px] text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Category</TableHead>
                <TableHead className="w-[130px] text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Array.from({ length: 6 }).map((_, i) => (
                <SkeletonRow key={i} />
              ))}
            </TableBody>
          </Table>
        )}

        {/* Claims table with staggered fade-in */}
        {hasClaims && (
          <Table>
            <TableHeader>
              <TableRow className="border-b-[var(--dg-border)] hover:bg-transparent">
                <TableHead className="w-[40px] text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">#</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Claim</TableHead>
                <TableHead className="w-[110px] text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Category</TableHead>
                <TableHead className="w-[130px] text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Status</TableHead>
                <TableHead className="text-[10px] uppercase tracking-widest text-[var(--dg-dim)]">Evidence</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {claims.map((claim, i) => {
                const cat = CATEGORY_CONFIG[claim.category];
                const status = STATUS_CONFIG[claim.status];
                const isRedFlag = claim.status === "red_flag";
                const isVerified = claim.status === "verified";
                const isVisible = visibleRows.has(i);

                return (
                  <TableRow
                    key={claim.id}
                    className={`border-b-[var(--dg-border)] ${isRedFlag && isVisible ? "red-flag-row red-flag-entrance" : ""}`}
                    style={{
                      backgroundColor: isRedFlag
                        ? "rgba(255, 107, 107, 0.08)"
                        : isVerified
                          ? "rgba(0, 210, 160, 0.03)"
                          : "transparent",
                      borderLeft: isRedFlag ? "3px solid #ff6b6b" : "3px solid transparent",
                      opacity: isVisible ? 1 : 0,
                      transform: isVisible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.98)",
                      transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
                    }}
                  >
                    <TableCell className="py-3 pl-4 text-xs tabular-nums text-[var(--dg-dim)]">
                      {claim.id}
                    </TableCell>
                    <TableCell className="py-3 text-[13px] leading-snug text-[var(--dg-text)]">
                      {claim.text}
                    </TableCell>
                    <TableCell className="py-3">
                      <Badge
                        variant="outline"
                        className="whitespace-nowrap text-[10px] font-medium"
                        style={{
                          backgroundColor: cat.bg,
                          color: cat.text,
                          borderColor: cat.border,
                        }}
                      >
                        {cat.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-3">
                      <span
                        className="inline-flex items-center gap-1.5 text-xs"
                        style={{
                          color: status.color,
                          fontWeight: status.bold ? 700 : 500,
                        }}
                      >
                        <span
                          className="inline-block h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: status.color }}
                        />
                        {status.label}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-[480px] py-3 text-[11px] leading-relaxed text-[var(--dg-dim)]">
                      {claim.evidence}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
