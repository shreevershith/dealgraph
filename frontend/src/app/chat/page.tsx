"use client";

import React, { useState, useEffect } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { AnalysisResult, Competitor } from "@/lib/types";
import { scoreColor } from "@/lib/utils";
import { CompetitorCard, FounderCard, MarketCard, DealSummaryCard } from "@/components/cards";

export default function ChatPage() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("dealgraph_analysis");
      if (saved) setAnalysis(JSON.parse(saved));
    } catch { /* ignore */ }
  }, []);

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

  useCopilotAction({
    name: "query_competitors",
    description: "Find competitors in the knowledge graph",
    available: "disabled" as const,
    parameters: [{ name: "company_name", type: "string" as const, required: true }],
    render: ({ args, status, result }: { args: Record<string, string>; status: string; result?: string }) => {
      let competitors: Competitor[] = [];
      try {
        if (result) {
          const parsed = typeof result === "string" ? JSON.parse(result) : result;
          const raw: unknown[] = Array.isArray(parsed) ? parsed : parsed?.competitors ?? [];
          competitors = raw
            .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null && "name" in c)
            .map((c) => ({ name: String(c.name ?? "Unknown"), total_raised: Number(c.total_raised ?? 0), stage: String(c.stage ?? "Unknown"), employee_count: c.employee_count ? Number(c.employee_count) : undefined }));
        }
      } catch { /* parse error */ }
      if (competitors.length === 0 && analysis?.competitors) competitors = analysis.competitors;
      return <CompetitorCard competitors={competitors} targetCompany={args.company_name || analysis?.company_name || "Target Company"} analysis={analysis} status={status} />;
    },
  });

  useCopilotAction({
    name: "verify_founder_background",
    description: "Verify founder credentials",
    available: "disabled" as const,
    parameters: [{ name: "founder_name", type: "string" as const, required: true }],
    render: ({ args, status, result }: { args: Record<string, string>; status: string; result?: string }) => (
      <FounderCard name={args.founder_name || "Unknown"} status={status} result={result} claims={analysis?.claims} />
    ),
  });

  useCopilotAction({
    name: "check_market",
    description: "Check market data",
    available: "disabled" as const,
    parameters: [{ name: "market_name", type: "string" as const, required: true }],
    render: ({ args, status, result }: { args: Record<string, string>; status: string; result?: string }) => (
      <MarketCard marketName={args.market_name || "Market"} status={status} result={result} claims={analysis?.claims} />
    ),
  });

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
      return <DealSummaryCard score={analysis.score} companyName={analysis.company_name || "Unknown Company"} claimCount={analysis.claims?.length || 0} competitorCount={analysis.competitors?.length || 0} />;
    },
  });

  return (
    <div className="flex h-screen w-screen flex-col" style={{ backgroundColor: "#0a0a0f" }}>
      <header className="flex shrink-0 items-center justify-between border-b border-gray-800 px-6 py-3">
        <div className="flex items-center gap-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--dg-accent)]">
            <circle cx="6" cy="6" r="2" /><circle cx="18" cy="6" r="2" /><circle cx="18" cy="18" r="2" /><circle cx="6" cy="18" r="2" /><circle cx="12" cy="12" r="2" />
            <path d="M7.5 7.5l3 3" /><path d="M13.5 13.5l3 3" /><path d="M16.5 7.5l-3 3" /><path d="M7.5 16.5l3-3" />
          </svg>
          <h1 className="text-xl font-bold" style={{ background: "linear-gradient(135deg, #e4e4ef 0%, #6c5ce7 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>DealGraph</h1>
          <span className="text-sm text-gray-400">AI Due Diligence Copilot</span>
          {analysis && (
            <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-[10px] font-medium text-green-400 border border-green-500/20">Analysis loaded</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a href="/" className="rounded-lg border border-gray-700 px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Dashboard</a>
          <div className="flex gap-1">
            {[
              { name: "FastAPI", color: "#009688" },
              { name: "Strands Agents", color: "#f59e0b" },
              { name: "Groq · Ollama · OpenAI", color: "#f59e0b" },
              { name: "Tavily", color: "#22c55e" },
              { name: "Memgraph", color: "#22c55e" },
              { name: "CopilotKit", color: "#a78bfa" },
              { name: "edge-tts", color: "#3b82f6" },
              { name: "Next.js", color: "#e4e4ef" },
            ].map((t) => (
              <span key={t.name} className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${t.color}15`, color: t.color, border: `1px solid ${t.color}25` }}>{t.name}</span>
            ))}
          </div>
        </div>
      </header>

      <div className="copilotkit-chat-fullpage" style={{ height: "calc(100vh - 52px)" }}>
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
