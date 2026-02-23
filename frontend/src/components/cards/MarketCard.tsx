"use client";

import React from "react";
import { Claim } from "@/lib/types";

export function MarketCard({
  marketName,
  status,
  result,
  claims,
}: {
  marketName: string;
  status: string;
  result?: string;
  claims?: Claim[];
}) {
  let marketEntries: Record<string, unknown>[] = [];
  let resultText = "";
  try {
    if (result) {
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      if (Array.isArray(parsed)) marketEntries = parsed;
      else resultText = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    }
  } catch {
    resultText = result || "";
  }

  const hasData = marketEntries.length > 0;
  const entry = hasData ? marketEntries[0] : null;
  const tam = entry?.tam_estimate as number | undefined;
  const growth = entry?.growth_rate as number | undefined;
  const sectorName = entry?.name as string | undefined;
  const description = entry?.description as string | undefined;
  const marketClaim = claims?.find((c) => c.category === "market_size");

  return (
    <div className="rounded-xl border border-purple-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <div>
            <h3 className="text-purple-400 font-bold text-lg">Market Intelligence</h3>
            <span className="text-gray-500 text-xs">{marketName}</span>
          </div>
        </div>
        {status === "complete" && hasData && (
          <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">DATA FOUND</span>
        )}
      </div>

      {status === "complete" && (marketClaim || hasData) && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div className="rounded-lg border border-purple-500/20 bg-purple-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-purple-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Deck Claims</span>
            </div>
            {marketClaim ? (
              <>
                <p className="text-white text-sm font-medium mb-1">{marketClaim.text}</p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                  marketClaim.status === "verified" ? "bg-green-500/20 text-green-400" :
                  marketClaim.status === "red_flag" ? "bg-red-500/20 text-red-400" :
                  "bg-yellow-500/20 text-yellow-400"
                }`}>
                  {marketClaim.status.toUpperCase().replace("_", " ")}
                </span>
              </>
            ) : (
              <p className="text-gray-500 text-sm">No market claims in deck</p>
            )}
          </div>
          <div className="rounded-lg border border-teal-500/20 bg-teal-500/5 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-teal-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Graph Data</span>
            </div>
            {hasData ? (
              <div className="space-y-1">
                {tam && <p className="text-white text-sm font-medium">TAM: {tam >= 1_000_000_000 ? `$${(tam / 1_000_000_000).toFixed(0)}B` : `$${(tam / 1_000_000).toFixed(0)}M`}</p>}
                {growth && <p className="text-teal-300 text-sm">Growth: {growth}% YoY</p>}
                {sectorName && <p className="text-gray-400 text-xs">{sectorName}</p>}
              </div>
            ) : (
              <p className="text-gray-500 text-sm">No data in graph</p>
            )}
          </div>
        </div>
      )}

      {hasData && (
        <div className="grid grid-cols-2 gap-3">
          {tam && (
            <div className="rounded-lg bg-gray-800/50 p-3">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Total Addressable Market</p>
              <p className="text-white font-bold text-xl">{tam >= 1_000_000_000 ? `$${(tam / 1_000_000_000).toFixed(0)}B` : `$${(tam / 1_000_000).toFixed(0)}M`}</p>
            </div>
          )}
          {growth && (
            <div className="rounded-lg bg-gray-800/50 p-3">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Annual Growth Rate</p>
              <p className="text-white font-bold text-xl">{growth}%</p>
              <p className="text-green-400 text-[10px]">Year-over-year</p>
            </div>
          )}
          {description && (
            <div className="rounded-lg bg-gray-800/50 p-3 col-span-2">
              <p className="text-gray-400 text-[10px] uppercase tracking-wider mb-1">Description</p>
              <p className="text-gray-300 text-sm">{description}</p>
            </div>
          )}
        </div>
      )}

      {!hasData && resultText && status === "complete" && (
        <div className="mt-3 rounded-lg bg-gray-800/50 p-4">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {resultText.length > 400 ? resultText.slice(0, 400) + "..." : resultText}
          </p>
        </div>
      )}

      {status === "executing" && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-lg bg-gray-800/30 p-4 animate-pulse">
              <div className="h-2 bg-gray-700 rounded w-1/2 mb-2" />
              <div className="h-5 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
