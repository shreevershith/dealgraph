"use client";

import React from "react";
import { CopilotPopup } from "@copilotkit/react-ui";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { AnalysisResult, Competitor } from "@/lib/types";
import { CompetitorCard, FounderCard, MarketCard, DealSummaryCard } from "@/components/cards";

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
            .map((c) => ({
              name: String(c.name ?? "Unknown"),
              total_raised: Number(c.total_raised ?? 0),
              stage: String(c.stage ?? "Unknown"),
              employee_count: c.employee_count ? Number(c.employee_count) : undefined,
            }));
        }
      } catch { /* parse error */ }
      if (competitors.length === 0 && analysis?.competitors) competitors = analysis.competitors;
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
