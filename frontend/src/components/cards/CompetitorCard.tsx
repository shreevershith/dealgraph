"use client";

import React from "react";
import { AnalysisResult, Competitor } from "@/lib/types";
import { formatFunding, stageColor, scoreColor } from "@/lib/utils";

export function CompetitorCard({
  competitors,
  targetCompany,
  analysis,
  status,
}: {
  competitors: Competitor[];
  targetCompany: string;
  analysis: AnalysisResult | null;
  status: string;
}) {
  if (status === "executing") {
    return (
      <div className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <div>
            <h3 className="text-teal-400 font-bold text-lg">{targetCompany} vs Competitors</h3>
            <span className="text-gray-500 text-xs">Querying knowledge graph...</span>
          </div>
        </div>
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="flex justify-between mb-1">
                <div className="h-3 bg-gray-700 rounded w-24" />
                <div className="h-3 bg-gray-700 rounded w-16" />
              </div>
              <div className="h-3 bg-gray-800 rounded-full w-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (competitors.length === 0) {
    return (
      <div className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-3 h-3 bg-yellow-400 rounded-full" />
          <span className="text-teal-400 font-bold">Competitive Landscape</span>
        </div>
        <p className="text-gray-400 text-sm">No competitor data found for &quot;{targetCompany}&quot;.</p>
      </div>
    );
  }

  const totalFunding = competitors.reduce((s, c) => s + c.total_raised, 0);
  const market = competitors[0]?.market;
  const sorted = [...competitors].sort((a, b) => b.total_raised - a.total_raised);
  const maxFunding = sorted[0]?.total_raised || 1;

  return (
    <div className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
          </div>
          <div>
            <h3 className="text-teal-400 font-bold text-lg">{targetCompany} vs Competitors</h3>
            <span className="text-gray-500 text-xs">{market ? `${market} market` : "Knowledge Graph"}</span>
          </div>
        </div>
        <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
          {competitors.length} FOUND
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-gray-800/40 px-3 py-2 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Competitors</p>
          <p className="text-white font-bold text-lg">{competitors.length}</p>
        </div>
        <div className="rounded-lg bg-gray-800/40 px-3 py-2 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Total Raised</p>
          <p className="text-white font-bold text-lg">{formatFunding(totalFunding)}</p>
        </div>
        <div className="rounded-lg bg-gray-800/40 px-3 py-2 text-center">
          <p className="text-gray-500 text-[10px] uppercase tracking-wider">Deal Score</p>
          <p className="font-bold text-lg" style={{ color: analysis?.score ? scoreColor(analysis.score.overall) : "#6b7280" }}>
            {analysis?.score?.overall ? `${analysis.score.overall}/10` : "N/A"}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        {sorted.map((c) => {
          const pct = Math.max(2, (c.total_raised / maxFunding) * 100);
          const isTarget = c.name.toLowerCase() === targetCompany.toLowerCase();
          return (
            <div key={c.name} className="group">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm ${isTarget ? "text-purple-400 font-bold" : "text-gray-300 font-medium"}`}>
                    {c.name}
                    {isTarget && <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">YOUR COMPANY</span>}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${stageColor(c.stage)}20`, color: stageColor(c.stage) }}>{c.stage}</span>
                  <span className="text-sm font-mono font-bold text-white">{formatFunding(c.total_raised)}</span>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
                <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: `${pct}%`, background: isTarget ? "linear-gradient(90deg, #7c3aed, #a78bfa)" : "linear-gradient(90deg, #0d9488, #2dd4bf)" }} />
              </div>
            </div>
          );
        })}
      </div>

      {!sorted.some((c) => c.name.toLowerCase() === targetCompany.toLowerCase()) && analysis?.company_name && (
        <>
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px bg-purple-500/30" />
            <span className="text-purple-400 text-[10px] font-bold uppercase tracking-widest">vs your company</span>
            <div className="flex-1 h-px bg-purple-500/30" />
          </div>
          <div className="rounded-lg border border-purple-500/30 bg-purple-500/5 px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <span className="text-purple-300 font-bold text-sm">{analysis.company_name}</span>
                <span className="text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">FROM PDF</span>
              </div>
              <span className="text-gray-400 text-xs">{analysis.score ? `Score: ${analysis.score.overall}/10` : "Analyzing..."}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
