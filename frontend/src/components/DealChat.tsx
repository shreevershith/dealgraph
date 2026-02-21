"use client";

import { useState, useEffect, Component, ReactNode } from "react";
import { CopilotChat } from "@copilotkit/react-ui";
import { AnalysisResult } from "@/lib/types";

// ── Error Boundary to catch CopilotKit connection failures ──

interface ErrorBoundaryProps {
  fallback: ReactNode;
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class ChatErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

// ── Status Panel (fallback when CopilotKit is unavailable) ──

interface StatusStep {
  label: string;
  doneLabel: string;
  key: string;
}

const STEPS: StatusStep[] = [
  {
    label: "Extracting claims from pitch deck...",
    doneLabel: "Claims extracted",
    key: "claims",
  },
  {
    label: "Checking facts against knowledge graph...",
    doneLabel: "Fact-check complete",
    key: "facts",
  },
  {
    label: "Scoring deal across 5 dimensions...",
    doneLabel: "Deal scored",
    key: "score",
  },
  {
    label: "Mapping competitive landscape...",
    doneLabel: "Competitors mapped",
    key: "competitors",
  },
  {
    label: "Generating voice memo...",
    doneLabel: "Voice memo generated",
    key: "audio",
  },
];

function StatusPanel({
  analysis,
  loading,
}: {
  analysis: AnalysisResult | null;
  loading: boolean;
}) {
  const [activeStep, setActiveStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      setActiveStep(0);
      return;
    }
    // Advance steps during loading
    const interval = setInterval(() => {
      setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
    }, 400);
    return () => clearInterval(interval);
  }, [loading]);

  const isComplete = analysis !== null && !loading;

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-[var(--dg-border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-medium text-[var(--dg-text)]">
            Analysis Pipeline
          </h2>
          {isComplete && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-medium"
              style={{
                backgroundColor: "rgba(0, 210, 160, 0.1)",
                color: "#00d2a0",
                border: "1px solid rgba(0, 210, 160, 0.2)",
              }}
            >
              Ready
            </span>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        {!loading && !analysis ? (
          // Idle state
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div
              className="mb-3 flex h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(108, 92, 231, 0.1)" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--dg-accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
              </svg>
            </div>
            <p className="text-sm text-[var(--dg-dim)]">
              Upload a pitch deck or describe a startup to analyze.
            </p>
            <p className="mt-1 text-[11px] text-[var(--dg-dim)] opacity-60">
              Pipeline will extract claims, verify facts, and score the deal
            </p>
          </div>
        ) : (
          // Steps display
          <div className="space-y-1">
            {STEPS.map((step, i) => {
              const isDone = isComplete || (loading && i < activeStep);
              const isCurrent = loading && i === activeStep;
              const isPending = loading && i > activeStep;

              return (
                <div
                  key={step.key}
                  className="flex items-start gap-3 rounded-lg px-3 py-2.5 transition-all duration-300"
                  style={{
                    backgroundColor: isCurrent
                      ? "rgba(108, 92, 231, 0.06)"
                      : "transparent",
                    opacity: isPending ? 0.35 : 1,
                  }}
                >
                  {/* Icon / spinner */}
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-sm">
                    {isCurrent ? (
                      <div
                        className="h-4 w-4 animate-spin rounded-full border-2 border-transparent"
                        style={{ borderTopColor: "var(--dg-accent)" }}
                      />
                    ) : isDone ? (
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ backgroundColor: "#00d2a0" }}
                      />
                    ) : (
                      <div
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: "var(--dg-border)" }}
                      />
                    )}
                  </div>

                  {/* Label */}
                  <div className="min-w-0 flex-1">
                    <p
                      className="text-xs transition-colors duration-300"
                      style={{
                        color: isDone
                          ? "var(--dg-text)"
                          : isCurrent
                            ? "var(--dg-text)"
                            : "var(--dg-dim)",
                        fontWeight: isCurrent ? 500 : 400,
                      }}
                    >
                      {isDone ? step.doneLabel : step.label}
                    </p>
                    {/* Extra detail when complete */}
                    {isDone && isComplete && analysis && (
                      <p className="mt-0.5 text-[11px] text-[var(--dg-dim)]">
                        {step.key === "claims" &&
                          `${analysis.claims.length} claims identified`}
                        {step.key === "facts" &&
                          `${analysis.claims.filter((c) => c.status === "verified").length} verified, ${analysis.claims.filter((c) => c.status === "red_flag").length} red flags`}
                        {step.key === "score" &&
                          `Overall: ${analysis.score.overall}/10`}
                        {step.key === "competitors" &&
                          `${analysis.competitors.length} companies mapped`}
                        {step.key === "audio" && "Ready to play"}
                      </p>
                    )}
                  </div>

                  {/* Done checkmark */}
                  {isDone && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#00d2a0"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="mt-0.5 shrink-0"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main DealChat Component ──

interface DealChatProps {
  analysis: AnalysisResult | null;
  loading: boolean;
  useCopilot?: boolean;
}

export default function DealChat({
  analysis,
  loading,
  useCopilot = false,
}: DealChatProps) {
  if (!useCopilot) {
    return <StatusPanel analysis={analysis} loading={loading} />;
  }

  return (
    <ChatErrorBoundary
      fallback={<StatusPanel analysis={analysis} loading={loading} />}
    >
      <div className="copilotkit-chat-wrapper flex h-full flex-col overflow-hidden">
        <CopilotChat
          labels={{
            title: "DealGraph",
            initial: "Upload a pitch deck or describe a startup to analyze.",
            placeholder: "Ask about the deal...",
          }}
          className="h-full"
        />
      </div>
    </ChatErrorBoundary>
  );
}
