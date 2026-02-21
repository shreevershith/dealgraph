"use client";

import React, { useState, useEffect } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
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

// ── Funding Bar Chart (CSS-based, no D3 dependency) ──

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
  // Parse result to extract structured data
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
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {/* Avatar */}
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
              <span className="text-gray-400 text-xs">
                Knowledge Graph Lookup
              </span>
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

      {/* Experience timeline from graph data */}
      {hasData && (
        <div className="space-y-2 mt-3">
          {parsedData.map((entry, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-gray-800/50 px-4 py-3"
            >
              <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0" />
              <div className="flex-1 min-w-0">
                {entry.prev_company && (
                  <p className="text-sm text-white font-medium">
                    {entry.prev_role || "Role"} at{" "}
                    <span className="text-blue-400">{entry.prev_company}</span>
                    {entry.prev_years && (
                      <span className="text-gray-500 ml-1">
                        ({entry.prev_years})
                      </span>
                    )}
                  </p>
                )}
                {entry.current_company && !entry.prev_company && (
                  <p className="text-sm text-white font-medium">
                    {entry.role || "Founder"} at{" "}
                    <span className="text-purple-400">
                      {entry.current_company}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fallback text result */}
      {!hasData && resultText && status === "complete" && (
        <div className="mt-3 rounded-lg bg-gray-800/50 p-4">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {resultText.length > 300 ? resultText.slice(0, 300) + "..." : resultText}
          </p>
        </div>
      )}

      {/* Loading skeleton */}
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

// ── Market Intelligence Card ──

function MarketCard({
  marketName,
  status,
  result,
}: {
  marketName: string;
  status: string;
  result?: string;
}) {
  let parsedData: Record<string, string | number>[] = [];
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
            <h3 className="text-purple-400 font-bold text-lg">
              Market Intelligence
            </h3>
            <span className="text-gray-500 text-xs">{marketName}</span>
          </div>
        </div>
        {status === "complete" && (
          <span className="bg-green-500/20 text-green-400 px-3 py-1 rounded-full text-xs font-bold border border-green-500/30">
            DATA FOUND
          </span>
        )}
      </div>

      {/* Market data cards */}
      {hasData && (
        <div className="grid grid-cols-2 gap-3 mt-3">
          {parsedData.slice(0, 4).map((entry, i) => (
            <div key={i} className="rounded-lg bg-gray-800/50 p-4">
              <p className="text-gray-400 text-xs mb-1">
                {entry.metric || entry.name || `Metric ${i + 1}`}
              </p>
              <p className="text-white font-bold text-lg">
                {entry.value || entry.market_size || "--"}
              </p>
              {entry.growth && (
                <p className="text-green-400 text-xs mt-1">
                  {entry.growth}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Fallback text */}
      {!hasData && resultText && status === "complete" && (
        <div className="mt-3 rounded-lg bg-gray-800/50 p-4">
          <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
            {resultText.length > 400 ? resultText.slice(0, 400) + "..." : resultText}
          </p>
        </div>
      )}

      {/* Loading */}
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

// ── Main Chat Page ──

export default function ChatPage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dealgraph_analysis");
      if (saved) {
        setAnalysis(JSON.parse(saved));
      }
    } catch {
      /* ignore */
    }
  }, []);

  useCopilotReadable({
    description: "The current deal analysis results from the dashboard",
    value: analysis
      ? JSON.stringify({
          claims: analysis.claims,
          score: analysis.score,
          memo: analysis.memo,
          competitors: analysis.competitors,
        })
      : "No analysis has been run yet. The user should upload a pitch deck on the dashboard first.",
  });

  // ── GENERATIVE UI: Competitive Landscape with Funding Bar Chart ──
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

      // Parse competitors from result
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

      // Also try to use analysis competitors as fallback
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

  // ── GENERATIVE UI: Founder Verification Card ──
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
    }) => (
      <FounderCard name={args.founder_name} status={status} result={result} />
    ),
  });

  // ── GENERATIVE UI: Market Intelligence Card ──
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
    }) => (
      <MarketCard
        marketName={args.market_name}
        status={status}
        result={result}
      />
    ),
  });

  return (
    <div
      className="flex h-screen w-screen flex-col"
      style={{ backgroundColor: "#0a0a0f" }}
    >
      {/* Header */}
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-[var(--dg-accent)]"
          >
            <circle cx="6" cy="6" r="2" />
            <circle cx="18" cy="6" r="2" />
            <circle cx="18" cy="18" r="2" />
            <circle cx="6" cy="18" r="2" />
            <circle cx="12" cy="12" r="2" />
            <path d="M7.5 7.5l3 3" />
            <path d="M13.5 13.5l3 3" />
            <path d="M16.5 7.5l-3 3" />
            <path d="M7.5 16.5l3-3" />
          </svg>
          <h1
            className="text-xl font-bold"
            style={{
              background:
                "linear-gradient(135deg, #e4e4ef 0%, #6c5ce7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            DealGraph
          </h1>
          <span className="text-sm text-gray-400">
            AI Due Diligence Copilot
          </span>
          {analysis && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400 border border-green-500/20">
              Analysis loaded
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Dashboard
          </a>
          <div className="flex gap-1">
            {[
              { name: "AWS Bedrock", color: "#f59e0b" },
              { name: "Strands", color: "#f59e0b" },
              { name: "Neo4j", color: "#22c55e" },
              { name: "CopilotKit", color: "#a78bfa" },
              { name: "MiniMax", color: "#3b82f6" },
              { name: "Datadog", color: "#a78bfa" },
            ].map((t) => (
              <span
                key={t.name}
                className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                style={{
                  backgroundColor: `${t.color}15`,
                  color: t.color,
                  border: `1px solid ${t.color}25`,
                }}
              >
                {t.name}
              </span>
            ))}
          </div>
        </div>
      </header>

      {/* Chat area */}
      <div
        className="copilotkit-chat-fullpage"
        style={{ height: "calc(100vh - 52px)" }}
      >
        <CopilotChat
          labels={{
            title: "DealGraph AI Copilot",
            initial: analysis
              ? "Deal analysis is loaded. Ask me anything -- I'll show you visual cards for competitors, founders, and market data."
              : "Welcome to DealGraph. Go to the Dashboard first to upload and analyze a pitch deck, then come back here to explore the results.",
            placeholder: "Ask about competitors, founders, funding, market...",
          }}
        />
      </div>
    </div>
  );
}
