"use client";

import React from "react";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { AnalysisResult, Competitor } from "@/lib/types";

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

// ── Funding Bar Chart ──

function FundingBarChart({
  competitors,
  targetCompany,
}: {
  competitors: Competitor[];
  targetCompany: string;
}) {
  const sorted = [...competitors].sort(
    (a, b) => b.total_raised - a.total_raised,
  );
  const maxFunding = sorted[0]?.total_raised || 1;

  return (
    <div className="space-y-2">
      {sorted.map((c) => {
        const pct = Math.max(2, (c.total_raised / maxFunding) * 100);
        const isTarget =
          c.name.toLowerCase() === targetCompany.toLowerCase();
        return (
          <div key={c.name} className="group">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <span
                  className={`text-sm ${isTarget ? "text-purple-400 font-bold" : "text-gray-300 font-medium"}`}
                >
                  {c.name}
                  {isTarget && (
                    <span className="ml-2 text-[10px] bg-purple-500/20 text-purple-300 px-1.5 py-0.5 rounded">
                      TARGET
                    </span>
                  )}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{
                    backgroundColor: `${stageColor(c.stage)}20`,
                    color: stageColor(c.stage),
                  }}
                >
                  {c.stage}
                </span>
                <span className="text-sm font-mono font-bold text-white">
                  {formatFunding(c.total_raised)}
                </span>
              </div>
            </div>
            <div className="h-3 w-full rounded-full bg-gray-800 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${pct}%`,
                  background: isTarget
                    ? "linear-gradient(90deg, #7c3aed, #a78bfa)"
                    : "linear-gradient(90deg, #0d9488, #2dd4bf)",
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Founder Card ──

function FounderCard({
  name,
  status,
  result,
}: {
  name: string;
  status: string;
  result?: string;
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

  return (
    <div className="rounded-xl border border-blue-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-lg">
            {name
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2)}
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">{name}</h3>
            {status === "executing" ? (
              <span className="text-yellow-400 text-xs flex items-center gap-1.5">
                <span className="w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
                Verifying credentials...
              </span>
            ) : (
              <span className="text-gray-400 text-xs">Knowledge Graph Lookup</span>
            )}
          </div>
        </div>
        {status === "complete" && (
          <span
            className={`px-3 py-1 rounded-full text-xs font-bold ${isVerified ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30"}`}
          >
            {isVerified ? "FOUND IN GRAPH" : "NOT IN GRAPH"}
          </span>
        )}
      </div>

      {hasData && (
        <div className="space-y-2 mt-3">
          {parsedData.map((entry, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-4 py-3">
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                {entry.prev_company && (
                  <p className="text-sm text-white font-medium">
                    {entry.prev_role || "Role"} at{" "}
                    <span className="text-blue-400">{entry.prev_company}</span>
                    {entry.prev_years && (
                      <span className="text-gray-500 ml-1">({entry.prev_years})</span>
                    )}
                  </p>
                )}
                {entry.current_company && !entry.prev_company && (
                  <p className="text-sm text-white font-medium">
                    {entry.role || "Founder"} at{" "}
                    <span className="text-purple-400">{entry.current_company}</span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
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

// ── Market Intelligence Card (handles Neo4j format: tam_estimate, growth_rate) ──

function MarketCard({
  marketName,
  status,
  result,
}: {
  marketName: string;
  status: string;
  result?: string;
}) {
  // Parse the Neo4j result which returns: [{name, tam_estimate, growth_rate, description}]
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

  // Transform Neo4j market data into display metrics
  const displayMetrics: { label: string; value: string; sub?: string }[] = [];
  if (hasData) {
    const entry = marketEntries[0];
    const tam = entry.tam_estimate as number | undefined;
    const growth = entry.growth_rate as number | undefined;
    const name = entry.name as string | undefined;

    if (tam) {
      displayMetrics.push({
        label: "Total Addressable Market",
        value: tam >= 1_000_000_000 ? `$${(tam / 1_000_000_000).toFixed(0)}B` : `$${(tam / 1_000_000).toFixed(0)}M`,
      });
    }
    if (growth) {
      displayMetrics.push({
        label: "Annual Growth Rate",
        value: `${growth}%`,
        sub: "Year-over-year",
      });
    }
    if (name) {
      displayMetrics.push({
        label: "Market Sector",
        value: name,
      });
    }
    if (entry.description) {
      displayMetrics.push({
        label: "Description",
        value: String(entry.description),
      });
    }
  }

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
          <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
            DATA FOUND
          </span>
        )}
      </div>

      {displayMetrics.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {displayMetrics.map((m, i) => (
            <div key={i} className="rounded-lg bg-gray-800/50 p-4">
              <p className="text-gray-400 text-xs mb-1">{m.label}</p>
              <p className="text-white font-bold text-lg">{m.value}</p>
              {m.sub && <p className="text-green-400 text-xs mt-1">{m.sub}</p>}
            </div>
          ))}
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

// ── Main Component: registers CopilotKit hooks + renders floating popup ──

export default function CopilotPopupChat({
  analysis,
}: {
  analysis: AnalysisResult | null;
}) {
  // Make analysis data available to the agent
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
    render: ({
      args,
      status,
      result,
    }: {
      args: Record<string, string>;
      status: string;
      result?: string;
    }) => {
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
                <h3 className="text-teal-400 font-bold text-lg">Competitive Landscape</h3>
                <span className="text-gray-500 text-xs">Querying Neo4j for {args.company_name}...</span>
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

      if (competitors.length > 0) {
        return (
          <div className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-teal-400 font-bold text-lg">Funding Comparison</h3>
                  <span className="text-gray-500 text-xs">{competitors.length} companies</span>
                </div>
              </div>
              <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
                COMPLETE
              </span>
            </div>
            <FundingBarChart competitors={competitors} targetCompany={args.company_name} />
          </div>
        );
      }

      return (
        <div className="rounded-xl border border-teal-500/20 bg-gradient-to-br from-gray-900 to-gray-950 p-5 my-3 w-full">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-3 h-3 bg-teal-400 rounded-full" />
            <span className="text-teal-400 font-bold">Competitive Landscape</span>
            <span className="text-green-400 text-xs">Complete</span>
          </div>
          <p className="text-gray-300 text-sm">
            {typeof result === "string" ? result.slice(0, 300) : "No competitor data found in knowledge graph."}
          </p>
        </div>
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
    render: ({
      args,
      status,
      result,
    }: {
      args: Record<string, string>;
      status: string;
      result?: string;
    }) => <FounderCard name={args.founder_name} status={status} result={result} />,
  });

  // ── Generative UI: Market Intelligence ──
  useCopilotAction({
    name: "check_market",
    description: "Check market data",
    available: "disabled" as const,
    parameters: [
      { name: "market_name", type: "string" as const, required: true },
    ],
    render: ({
      args,
      status,
      result,
    }: {
      args: Record<string, string>;
      status: string;
      result?: string;
    }) => <MarketCard marketName={args.market_name} status={status} result={result} />,
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
