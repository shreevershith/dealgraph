"use client";

import React from "react";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { AnalysisResult, Claim, Competitor, DealScore } from "@/lib/types";

// ── Helpers ──

function formatFunding(amount: number): string {
  if (amount >= 1_000_000_000) {
    const b = amount / 1_000_000_000;
    return `$${b % 1 === 0 ? b.toFixed(0) : b.toFixed(1)}B`;
  }
  if (amount >= 1_000_000) return `$${Math.round(amount / 1_000_000)}M`;
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}K`;
  return `$${amount}`;
}

function stageColor(stage: string): string {
  const s = stage.toLowerCase();
  if (s.includes("public")) return "#22c55e";
  if (s.includes("late")) return "#3b82f6";
  if (s.includes("series d") || s.includes("series c")) return "#8b5cf6";
  if (s.includes("series b")) return "#a78bfa";
  if (s.includes("series a")) return "#f59e0b";
  return "#6b7280";
}

function scoreColor(score: number): string {
  if (score >= 8) return "#22c55e";
  if (score >= 6) return "#f59e0b";
  if (score >= 4) return "#f97316";
  return "#ef4444";
}

// ── Competitor Card with "Your Company vs Graph" ──

function CompetitorCard({
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
        <p className="text-gray-400 text-sm">No competitor data found in the knowledge graph for &quot;{targetCompany}&quot;.</p>
      </div>
    );
  }

  const totalFunding = competitors.reduce((s, c) => s + c.total_raised, 0);
  const market = (competitors[0] as Record<string, unknown>)?.market as string | undefined;
  const sorted = [...competitors].sort((a, b) => b.total_raised - a.total_raised);
  const maxFunding = sorted[0]?.total_raised || 1;

  return (
    <div className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full overflow-hidden">
      {/* Header */}
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

      {/* Summary Stats */}
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

      {/* Funding Bars */}
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
                    {isTarget && (
                      <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">YOUR COMPANY</span>
                    )}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${stageColor(c.stage)}20`, color: stageColor(c.stage) }}>
                    {c.stage}
                  </span>
                  <span className="text-sm font-mono font-bold text-white">{formatFunding(c.total_raised)}</span>
                </div>
              </div>
              <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{
                    width: `${pct}%`,
                    background: isTarget ? "linear-gradient(90deg, #7c3aed, #a78bfa)" : "linear-gradient(90deg, #0d9488, #2dd4bf)",
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Vs Divider + Target Company (if not already in the list) */}
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
              <span className="text-gray-400 text-xs">
                {analysis.score ? `Score: ${analysis.score.overall}/10` : "Analyzing..."}
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Founder Card with "PDF Claim vs Graph Evidence" ──

function FounderCard({
  name,
  status,
  result,
  claims,
}: {
  name: string;
  status: string;
  result?: string;
  claims?: Claim[];
}) {
  let parsedData: Record<string, string>[] = [];
  let resultText = "";
  try {
    if (result) {
      const parsed = typeof result === "string" ? JSON.parse(result) : result;
      if (Array.isArray(parsed)) parsedData = parsed;
      else resultText = typeof result === "string" ? result : JSON.stringify(result, null, 2);
    }
  } catch {
    resultText = result || "";
  }

  const hasData = parsedData.length > 0;
  const isVerified = hasData && parsedData.some((d) => d.prev_company || d.current_company);

  const teamClaim = claims?.find(
    (c) => c.category === "team" && c.text.toLowerCase().includes(name.split(" ")[0].toLowerCase()),
  );

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{name}</h3>
            {status === "executing" ? (
              <span className="text-yellow-400 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Verifying against graph...
              </span>
            ) : (
              <span className="text-gray-400 text-xs">Founder Verification</span>
            )}
          </div>
        </div>
        {status === "complete" && (
          <span className={`px-3 py-1 rounded-full text-xs font-bold ${isVerified ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"}`}>
            {isVerified ? "VERIFIED" : "NOT IN GRAPH"}
          </span>
        )}
      </div>

      {/* PDF Claim Section */}
      {teamClaim && (
        <div className="mb-3 rounded-lg border border-purple-500/20 bg-purple-500/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">Pitch Deck Claims</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
              teamClaim.status === "verified" ? "bg-green-500/20 text-green-400" :
              teamClaim.status === "red_flag" ? "bg-red-500/20 text-red-400" :
              "bg-yellow-500/20 text-yellow-400"
            }`}>
              {teamClaim.status.toUpperCase().replace("_", " ")}
            </span>
          </div>
          <p className="text-gray-300 text-sm">{teamClaim.text}</p>
        </div>
      )}

      {/* Graph Evidence Section */}
      {hasData && (
        <>
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-teal-400">Graph Evidence</span>
          </div>
          <div className="space-y-2">
            {parsedData.map((entry, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-teal-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  {entry.prev_company && (
                    <p className="text-sm text-white font-medium">
                      {entry.prev_role || "Role"} at{" "}
                      <span className="text-blue-400">{entry.prev_company}</span>
                      {entry.prev_years && <span className="text-gray-500 ml-1">({entry.prev_years})</span>}
                    </p>
                  )}
                  {entry.current_company && !entry.prev_company && (
                    <p className="text-sm text-white font-medium">
                      {entry.role || "Founder"} at <span className="text-purple-400">{entry.current_company}</span>
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!hasData && resultText && status === "complete" && (
        <div className="mt-3 rounded-lg bg-gray-800/50 p-4">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {resultText.length > 300 ? resultText.slice(0, 300) + "..." : resultText}
          </p>
        </div>
      )}

      {status === "executing" && (
        <div className="space-y-2 mt-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-800/30 px-4 py-3 animate-pulse">
              <div className="w-2 h-2 rounded-full bg-gray-700" />
              <div className="h-3 bg-gray-700 rounded w-3/4" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Market Card with "Deck Claim vs Graph Data" ──

function MarketCard({
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
      {/* Header */}
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
          <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
            DATA FOUND
          </span>
        )}
      </div>

      {/* Side-by-side: Deck Claim vs Graph Data */}
      {status === "complete" && (marketClaim || hasData) && (
        <div className="grid grid-cols-2 gap-3 mb-3">
          {/* Deck Claim Side */}
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

          {/* Graph Data Side */}
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

      {/* Full Graph Metrics */}
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

// ── Deal Summary Card (inline scorecard in chat) ──

function DealSummaryCard({
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
  const dimensions = [
    { key: "team", label: "Team", weight: "30%" },
    { key: "market", label: "Market", weight: "25%" },
    { key: "traction", label: "Traction", weight: "20%" },
    { key: "competition", label: "Competition", weight: "15%" },
    { key: "financials", label: "Financials", weight: "10%" },
  ] as const;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full overflow-hidden">
      {/* Header */}
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
        <div className="flex items-center gap-2">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center border-2"
            style={{ borderColor: scoreColor(score.overall) }}
          >
            <span className="font-bold text-xl" style={{ color: scoreColor(score.overall) }}>
              {score.overall}
            </span>
          </div>
        </div>
      </div>

      {/* Recommendation Badge */}
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

      {/* Score Breakdown */}
      <div className="space-y-2.5">
        {dimensions.map(({ key, label, weight }) => {
          const val = score.breakdown[key] || 0;
          const pct = (val / 10) * 100;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-gray-300 text-sm font-medium">{label} <span className="text-gray-600 text-xs">({weight})</span></span>
                <span className="text-sm font-mono font-bold" style={{ color: scoreColor(val) }}>{val}</span>
              </div>
              <div className="h-2 w-full rounded-full bg-gray-800 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700 ease-out"
                  style={{ width: `${pct}%`, backgroundColor: scoreColor(val) }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ──

export default function CopilotPopupChat({
  analysis,
}: {
  analysis: AnalysisResult | null;
}) {
  useCopilotReadable({
    description: "The current deal analysis results from the dashboard",
    value: analysis
      ? JSON.stringify({
          claims: analysis.claims,
          score: analysis.score,
          memo: analysis.memo,
          competitors: analysis.competitors,
          company_name: analysis.company_name,
        })
      : "No analysis has been run yet. The user should upload a pitch deck on the dashboard first.",
  });

  // ── Generative UI: Competitive Landscape ──
  useCopilotAction({
    name: "query_competitors",
    description: "Find competitors in the knowledge graph",
    available: "disabled" as const,
    parameters: [
      { name: "company_name", type: "string" as const, required: true },
    ],
    render: ({ args, status, result }: { args: Record<string, string>; status: string; result?: string }) => {
      let competitors: Competitor[] = [];
      try {
        if (result) {
          const parsed = typeof result === "string" ? JSON.parse(result) : result;
          const raw: unknown[] = Array.isArray(parsed) ? parsed : parsed?.competitors ?? [];
          competitors = raw
            .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null && "name" in c)
            .map((c) => ({
              name: String(c.name ?? "Unknown"),
              total_raised: Number(c.total_raised ?? 0),
              stage: String(c.stage ?? "Unknown"),
              employee_count: c.employee_count ? Number(c.employee_count) : undefined,
            }));
        }
      } catch { /* parse error */ }

      if (competitors.length === 0 && analysis?.competitors) {
        competitors = analysis.competitors;
      }

      return (
        <CompetitorCard
          competitors={competitors}
          targetCompany={args.company_name || analysis?.company_name || "Target Company"}
          analysis={analysis}
          status={status}
        />
      );
    },
  });

  // ── Generative UI: Founder Verification ──
  useCopilotAction({
    name: "verify_founder_background",
    description: "Verify founder credentials",
    available: "disabled" as const,
    parameters: [
      { name: "founder_name", type: "string" as const, required: true },
    ],
    render: ({ args, status, result }: { args: Record<string, string>; status: string; result?: string }) => (
      <FounderCard
        name={args.founder_name || "Unknown"}
        status={status}
        result={result}
        claims={analysis?.claims}
      />
    ),
  });

  // ── Generative UI: Market Intelligence ──
  useCopilotAction({
    name: "check_market",
    description: "Check market data",
    available: "disabled" as const,
    parameters: [
      { name: "market_name", type: "string" as const, required: true },
    ],
    render: ({ args, status, result }: { args: Record<string, string>; status: string; result?: string }) => (
      <MarketCard
        marketName={args.market_name || "Market"}
        status={status}
        result={result}
        claims={analysis?.claims}
      />
    ),
  });

  // ── Generative UI: Deal Summary ──
  useCopilotAction({
    name: "show_deal_summary",
    description: "Show the deal score summary",
    available: "disabled" as const,
    parameters: [],
    render: ({ status }: { status: string }) => {
      if (status === "executing") {
        return (
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center animate-pulse">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </div>
              <span className="text-amber-400 font-bold">Loading deal summary...</span>
            </div>
          </div>
        );
      }
      if (!analysis?.score) {
        return (
          <div className="rounded-xl border border-amber-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full">
            <p className="text-gray-400 text-sm">No deal score available. Upload a pitch deck first.</p>
          </div>
        );
      }
      return (
        <DealSummaryCard
          score={analysis.score}
          companyName={analysis.company_name || "Unknown Company"}
          claimCount={analysis.claims?.length || 0}
          competitorCount={analysis.competitors?.length || 0}
        />
      );
    },
  });

  return (
    <CopilotPopup
      labels={{
        title: "DealGraph AI Copilot",
        initial: analysis
          ? "Deal analysis is loaded. Ask me anything -- I'll show you visual cards for competitors, founders, and market data."
          : "Welcome to DealGraph. Upload a pitch deck on the dashboard first, then ask me questions.",
        placeholder: "Ask about competitors, founders, funding, market...",
      }}
    />
  );
}
