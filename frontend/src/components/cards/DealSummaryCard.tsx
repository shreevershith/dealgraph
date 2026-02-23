"use client";

import React from "react";
import { DealScore } from "@/lib/types";
import { scoreColor } from "@/lib/utils";

const DIMENSIONS = [
  { key: "team", label: "Team", weight: "30%" },
  { key: "market", label: "Market", weight: "25%" },
  { key: "traction", label: "Traction", weight: "20%" },
  { key: "competition", label: "Competition", weight: "15%" },
  { key: "financials", label: "Financials", weight: "10%" },
] as const;

export function DealSummaryCard({
  score,
  companyName,
  claimCount,
  competitorCount,
}: {
  score: DealScore;
  companyName: string;
  claimCount: number;
  competitorCount: number;
}) {
  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-amber-400 font-bold text-lg">Deal Summary</h3>
            <span className="text-gray-500 text-xs">{companyName}</span>
          </div>
        </div>
        <div className="w-14 h-14 rounded-full flex items-center justify-center border-2" style={{ borderColor: scoreColor(score.overall) }}>
          <span className="font-bold text-xl" style={{ color: scoreColor(score.overall) }}>{score.overall}</span>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <span className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
          score.recommendation === "Strong Invest" ? "bg-green-500/20 text-green-400 border border-green-500/30" :
          score.recommendation === "Further Diligence" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" :
          "bg-red-500/20 text-red-400 border border-red-500/30"
        }`}>
          {score.recommendation}
        </span>
        <span className="text-gray-500 text-xs">{claimCount} claims analyzed</span>
        <span className="text-gray-500 text-xs">{competitorCount} competitors</span>
      </div>

      <div className="space-y-2.5">
        {DIMENSIONS.map(({ key, label, weight }) => {
          const val = score.breakdown[key] || 0;
          const pct = (val / 10) * 100;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-300 text-sm font-medium">{label} <span className="text-gray-600 text-xs">({weight})</span></span>
                <span className="text-sm font-mono font-bold" style={{ color: scoreColor(val) }}>{val}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: scoreColor(val) }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
