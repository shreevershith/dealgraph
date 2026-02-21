"use client";

import { useState, useEffect, useCallback, useRef, Component, ReactNode } from "react";
import { AnalysisResult } from "@/lib/types";
import { mockAnalysisResult } from "@/lib/mock-data";
import { analyzeDeck, healthCheck, resolveAudioUrl } from "@/lib/api";
import ClaimTracker from "@/components/ClaimTracker";
import DealScorecard from "@/components/DealScorecard";
import CompetitiveGraph from "@/components/CompetitiveGraph";
import DeckUpload from "@/components/DeckUpload";
import DealChat from "@/components/DealChat";
import CopilotPopupChat from "@/components/CopilotPopupChat";

// ── Page-level Error Boundary ──

interface ErrorBoundaryProps {
  children: ReactNode;
  onError: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

class PageErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// ── Toast notification ──

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div
      className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-xs font-medium shadow-lg transition-all duration-500"
      style={{
        backgroundColor: "rgba(18, 18, 26, 0.95)",
        border: "1px solid var(--dg-border)",
        color: "var(--dg-text)",
        backdropFilter: "blur(8px)",
        opacity: visible ? 1 : 0,
        transform: visible
          ? "translateX(-50%) translateY(0)"
          : "translateX(-50%) translateY(12px)",
      }}
    >
      <div className="flex items-center gap-2">
        <div
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: "var(--dg-success)" }}
        />
        {message}
      </div>
    </div>
  );
}

// ── Audio Player ──

function VoicePlayer({ audioUrl }: { audioUrl: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const resolvedUrl = resolveAudioUrl(audioUrl);

  const formatTime = (s: number) => {
    if (!s || !isFinite(s)) return "--:--";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  return (
    <div className="flex w-full items-center gap-3 px-6">
      <audio
        ref={audioRef}
        src={resolvedUrl}
        preload="metadata"
        onLoadedMetadata={() => {
          if (audioRef.current) setDuration(audioRef.current.duration);
        }}
        onTimeUpdate={() => {
          const audio = audioRef.current;
          if (audio && audio.duration) {
            setCurrentTime(audio.currentTime);
            setProgress((audio.currentTime / audio.duration) * 100);
          }
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
          setCurrentTime(0);
        }}
      />
      <button
        onClick={togglePlay}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300 hover:scale-110 hover:brightness-110"
        style={{
          backgroundColor: "var(--dg-accent)",
          boxShadow: "0 0 12px rgba(108, 92, 231, 0.3)",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="white"
          stroke="none"
        >
          {playing ? (
            <>
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </>
          ) : (
            <polygon points="5 3 19 12 5 21 5 3" />
          )}
        </svg>
      </button>
      <div className="flex-1">
        <div
          className="group relative h-1.5 w-full cursor-pointer rounded-full bg-[var(--dg-border)]"
          onClick={(e) => {
            const audio = audioRef.current;
            if (!audio || !audio.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            const pct = (e.clientX - rect.left) / rect.width;
            audio.currentTime = pct * audio.duration;
          }}
        >
          <div
            className="h-1.5 rounded-full transition-[width] duration-100"
            style={{
              width: `${progress}%`,
              backgroundColor: "var(--dg-accent)",
            }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-[var(--dg-dim)]">
          <span>{formatTime(currentTime)}</span>
          <span>AI-generated summary memo</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Graph Icon ──

function GraphIcon() {
  return (
    <svg
      width="28"
      height="28"
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
  );
}

// ── Cascade delay config (ms after analysis completes) ──
const CASCADE = {
  claims: 0,
  scorecard: 200,
  graph: 400,
  voice: 600,
} as const;

// ── Main Page ──

function DealGraphApp() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [useMockData, setUseMockData] = useState(false);
  const [backendChecked, setBackendChecked] = useState(false);

  // Toast state
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimerRef = useRef<NodeJS.Timeout>();

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    setToastVisible(true);
    toastTimerRef.current = setTimeout(() => setToastVisible(false), 3000);
  }, []);

  // Cascade reveal states
  const [showClaims, setShowClaims] = useState(false);
  const [showScorecard, setShowScorecard] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showVoice, setShowVoice] = useState(false);

  // Health check on mount - auto-detect backend
  useEffect(() => {
    let cancelled = false;
    healthCheck().then((ok) => {
      if (cancelled) return;
      setBackendChecked(true);
      if (ok) {
        setUseMockData(false);
        console.log("Backend is reachable, using API mode");
      } else {
        setUseMockData(true);
        console.log("Backend not available, using mock data");
      }
    });
    return () => { cancelled = true; };
  }, []);

  // Clear stale analysis on mount; only save fresh data after a new analysis
  useEffect(() => {
    try { localStorage.removeItem("dealgraph_analysis"); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (analysis) {
      try {
        localStorage.setItem("dealgraph_analysis", JSON.stringify(analysis));
      } catch { /* ignore quota errors */ }
    }
  }, [analysis]);

  // Trigger cascade when analysis arrives
  useEffect(() => {
    if (!analysis) {
      setShowClaims(false);
      setShowScorecard(false);
      setShowGraph(false);
      setShowVoice(false);
      return;
    }
    const timers = [
      setTimeout(() => setShowClaims(true), CASCADE.claims),
      setTimeout(() => setShowScorecard(true), CASCADE.scorecard),
      setTimeout(() => setShowGraph(true), CASCADE.graph),
      setTimeout(() => setShowVoice(true), CASCADE.voice),
    ];
    return () => timers.forEach(clearTimeout);
  }, [analysis]);

  // Ctrl+M toggles mock/API mode, Ctrl+K toggles copilot/status panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "m") {
        e.preventDefault();
        setUseMockData((prev) => {
          const next = !prev;
          showToast(next ? "Switched to demo mode" : "Switched to API mode");
          return next;
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showToast]);

  const analyzingRef = useRef(false);
  const handleAnalyze = useCallback(
    async (deckText: string) => {
      // Prevent concurrent/duplicate calls
      if (analyzingRef.current) return;
      analyzingRef.current = true;
      setLoading(true);
      setAnalysis(null);

      try {
        if (useMockData) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
          setAnalysis(mockAnalysisResult);
        } else {
          const result = await analyzeDeck(deckText);
          // Only accept results that have actual data
          if (result && (result.claims?.length > 0 || result.score?.overall > 0 || result.memo)) {
            setAnalysis(result);
          } else {
            console.warn("Analysis returned empty - using result anyway", result);
            setAnalysis(result);
          }
        }
      } catch (err) {
        console.error("Analysis failed:", err);
        showToast("Analysis failed - check backend connection");
      } finally {
        setLoading(false);
        analyzingRef.current = false;
      }
    },
    [useMockData, showToast]
  );

  // Don't render until health check completes to avoid flash
  if (!backendChecked) {
    return (
      <div
        className="flex h-screen items-center justify-center"
        style={{ backgroundColor: "var(--dg-bg)" }}
      >
        <div className="flex items-center gap-3">
          <div
            className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
            style={{ borderTopColor: "var(--dg-accent)" }}
          />
          <span className="text-sm text-[var(--dg-dim)]">Connecting...</span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col"
      style={{ backgroundColor: "var(--dg-bg)" }}
    >
      {/* ── Header ── */}
      <header
        className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--dg-border)] px-6"
        style={{
          backgroundColor: "rgba(18, 18, 26, 0.8)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <GraphIcon />
          <div className="flex items-center gap-2.5">
            <h1
              className="text-lg font-semibold tracking-tight"
              style={{
                background: "linear-gradient(135deg, #e4e4ef 0%, #6c5ce7 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              DealGraph
            </h1>
            {loading && (
              <div className="flex items-center gap-1.5">
                <div
                  className="live-dot h-2 w-2 rounded-full"
                  style={{ backgroundColor: "var(--dg-accent)", boxShadow: "0 0 6px rgba(108, 92, 231, 0.5)" }}
                />
                <span className="text-[10px] font-medium text-[var(--dg-accent)]">LIVE</span>
              </div>
            )}
            <span className="hidden text-xs tracking-wide text-[var(--dg-dim)] sm:inline">
              AI Due Diligence Copilot
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Mock/API toggle */}
          <button
            onClick={() => {
              setUseMockData((prev) => {
                const next = !prev;
                showToast(next ? "Switched to demo mode" : "Switched to API mode");
                return next;
              });
            }}
            className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[11px] transition-all duration-200 hover:brightness-125"
            style={{
              backgroundColor: useMockData
                ? "rgba(0, 210, 160, 0.1)"
                : "rgba(108, 92, 231, 0.1)",
              color: useMockData ? "var(--dg-success)" : "var(--dg-accent)",
              border: `1px solid ${useMockData ? "rgba(0, 210, 160, 0.2)" : "rgba(108, 92, 231, 0.2)"}`,
            }}
            title="Toggle mock/API mode (Ctrl+M)"
          >
            <div
              className="h-1.5 w-1.5 rounded-full"
              style={{
                backgroundColor: useMockData
                  ? "var(--dg-success)"
                  : "var(--dg-accent)",
              }}
            />
            {useMockData ? "Demo" : "API"}
            <span className="text-[9px] opacity-50">Ctrl+M</span>
          </button>

          {/* Status indicator */}
          {analysis && (
            <span
              className="rounded-full px-2.5 py-1 text-[10px] font-medium"
              style={{
                backgroundColor: "rgba(0, 210, 160, 0.1)",
                color: "var(--dg-success)",
                border: "1px solid rgba(0, 210, 160, 0.2)",
              }}
            >
              Analysis Complete
            </span>
          )}
        </div>
      </header>

      {/* ── Main Content (scrollable) ── */}
      <div className="flex-1 overflow-y-auto">
        {/* Row 1: Upload/Chat + Competitive Graph */}
        <div className="flex" style={{ minHeight: "420px" }}>
          {/* Left Column - Upload + Chat/Status (40%) */}
          <div className="flex w-[40%] flex-col border-r border-[var(--dg-border)]">
          {/* Upload Panel (shrinks to fit) */}
          {(!analysis || loading) && (
            <div className="dg-surface mx-3 mt-3 overflow-hidden rounded-lg">
              <DeckUpload onAnalyze={handleAnalyze} loading={loading} />
            </div>
          )}

          {/* Status Panel (fills remaining) */}
          <div className="dg-surface m-3 flex min-h-[200px] flex-1 flex-col overflow-hidden rounded-lg">
            <DealChat
              analysis={analysis}
              loading={loading}
            />
          </div>

          {/* New Analysis button (when complete) */}
          {analysis && !loading && (
            <div className="mx-3 mb-3 shrink-0">
              <button
                onClick={() => setAnalysis(null)}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--dg-border)] py-2 text-xs font-medium text-[var(--dg-dim)] transition-colors hover:border-[var(--dg-accent)] hover:text-[var(--dg-text)]"
                style={{ backgroundColor: "var(--dg-surface)" }}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" />
                </svg>
                New Analysis
              </button>
            </div>
          )}
        </div>

        {/* Right Column - Competitive Landscape (60%) */}
        <div className="flex w-[60%] flex-col">
          <div
            className="dg-surface dg-glow m-3 flex flex-1 flex-col overflow-hidden rounded-lg transition-opacity duration-500"
            style={{ opacity: loading ? 1 : showGraph || !analysis ? 1 : 0 }}
          >
            {showGraph && analysis ? (
              <CompetitiveGraph competitors={analysis.competitors} targetCompany={analysis.company_name || "Target Company"} />
            ) : loading ? (
              <CompetitiveGraph loading={true} />
            ) : (
              <>
                <div className="flex items-center justify-between border-b border-[var(--dg-border)] px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-sm font-medium text-[var(--dg-text)]">
                      Competitive Landscape
                    </h2>
                  </div>
                </div>
                <div className="flex flex-1 items-center justify-center">
                  <div className="text-center">
                    <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full border border-[var(--dg-border)]">
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="var(--dg-dim)"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="opacity-50"
                      >
                        <circle cx="12" cy="12" r="3" />
                        <circle cx="5" cy="8" r="2" opacity="0.5" />
                        <circle cx="19" cy="7" r="2.5" opacity="0.5" />
                        <circle cx="17" cy="17" r="1.5" opacity="0.5" />
                        <circle cx="7" cy="17" r="2" opacity="0.5" />
                      </svg>
                    </div>
                    <p className="text-sm text-[var(--dg-dim)]">
                      Competitive landscape visualization
                    </p>
                    <p className="mt-1 text-xs text-[var(--dg-dim)] opacity-60">
                      Awaiting analysis data
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </div>

        {/* ── Bottom Panels ── */}
        <div className="flex flex-col gap-3 p-3">
        {/* Score + Voice Row */}
        <div className="flex gap-3">
          {/* Deal Scorecard */}
          <div
            className="dg-surface flex-1 flex flex-col overflow-hidden rounded-lg transition-opacity duration-500"
            style={{ opacity: loading ? 1 : showScorecard || !analysis ? 1 : 0 }}
          >
            <DealScorecard
              score={showScorecard ? analysis?.score : undefined}
              loading={loading}
            />
          </div>

          {/* Voice Memo Player */}
          <div
            className="dg-surface flex-1 flex flex-col rounded-lg transition-opacity duration-500"
            style={{ opacity: loading ? 1 : showVoice || !analysis ? 1 : 0 }}
          >
            <div className="flex items-center gap-2 border-b border-[var(--dg-border)] px-4 py-2">
              <h2 className="text-sm font-medium text-[var(--dg-text)]">
                Voice Memo
              </h2>
              {loading && (
                <span className="text-[10px] text-[var(--dg-dim)] animate-pulse">
                  Generating...
                </span>
              )}
            </div>
            <div className="flex flex-col">
              <div className="flex items-center justify-center py-4">
                {showVoice && analysis?.audio_url ? (
                  <VoicePlayer audioUrl={analysis.audio_url} />
                ) : loading ? (
                  <div className="flex items-center gap-3 px-6">
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full animate-pulse"
                      style={{ backgroundColor: "rgba(108, 92, 231, 0.2)" }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--dg-dim)" stroke="none" className="opacity-40">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-[var(--dg-dim)] animate-pulse">Generating voice briefing...</p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-[var(--dg-border)]">
                        <div className="h-full rounded-full animate-pulse" style={{ width: "40%", backgroundColor: "rgba(108, 92, 231, 0.3)" }} />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(42, 42, 58, 0.5)" }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="var(--dg-dim)" stroke="none" className="opacity-30">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                    <p className="text-xs text-[var(--dg-dim)] opacity-60">Audio memo after analysis</p>
                  </div>
                )}
              </div>
              {/* Memo Text */}
              {showVoice && analysis?.memo && (
                <div className="border-t border-[var(--dg-border)] px-4 py-3 max-h-[200px] overflow-y-auto">
                  <p className="text-xs leading-relaxed text-[var(--dg-dim)]">
                    {analysis.memo}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Claims Tracker - Full Width */}
        <div
          className="dg-surface flex flex-col overflow-hidden rounded-lg transition-opacity duration-500"
          style={{ opacity: loading ? 1 : showClaims || !analysis ? 1 : 0 }}
        >
          <ClaimTracker
            claims={showClaims ? analysis?.claims : undefined}
            loading={loading}
          />
        </div>
      </div>
      </div>

      {/* Built-with footer */}
      <div
        className="flex shrink-0 items-center justify-center gap-2 py-1.5 transition-opacity duration-300"
        style={{ opacity: 0.35 }}
        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.8")}
        onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.35")}
      >
        <span className="text-[10px] text-[var(--dg-dim)]">Built with</span>
        {[
          { name: "AWS Bedrock", color: "#f59e0b" },
          { name: "Strands Agents", color: "#f59e0b" },
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

      {/* Toast */}
      <Toast message={toastMessage} visible={toastVisible} />

      {/* Floating CopilotKit Chat Popup */}
      <CopilotPopupChat analysis={analysis} />
    </div>
  );
}

// ── Exported wrapper with error boundary ──

export default function Home() {
  const [errorFallback, setErrorFallback] = useState(false);

  if (errorFallback) {
    // Render a minimal fallback that loads mock data directly
    return <FallbackApp />;
  }

  return (
    <PageErrorBoundary onError={() => setErrorFallback(true)}>
      <DealGraphApp />
    </PageErrorBoundary>
  );
}

// ── Fallback app when error boundary catches ──

function FallbackApp() {
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = useCallback(async () => {
    setLoading(true);
    setAnalysis(null);
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setAnalysis(mockAnalysisResult);
    setLoading(false);
  }, []);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ backgroundColor: "var(--dg-bg)" }}
    >
      <header
        className="relative z-10 flex h-14 shrink-0 items-center justify-between border-b border-[var(--dg-border)] px-6"
        style={{
          backgroundColor: "rgba(18, 18, 26, 0.8)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="flex items-center gap-3">
          <GraphIcon />
          <h1
            className="text-lg font-semibold tracking-tight"
            style={{
              background: "linear-gradient(135deg, #e4e4ef 0%, #6c5ce7 100%)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            DealGraph
          </h1>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={{
              backgroundColor: "rgba(255, 169, 77, 0.1)",
              color: "var(--dg-warning)",
              border: "1px solid rgba(255, 169, 77, 0.2)",
            }}
          >
            Safe Mode
          </span>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center">
        {loading ? (
          <div className="flex items-center gap-3">
            <div
              className="h-5 w-5 animate-spin rounded-full border-2 border-transparent"
              style={{ borderTopColor: "var(--dg-accent)" }}
            />
            <span className="text-sm text-[var(--dg-dim)]">Loading demo data...</span>
          </div>
        ) : analysis ? (
          <div className="w-full max-w-4xl p-6">
            <DealScorecard score={analysis.score} />
          </div>
        ) : (
          <div className="text-center">
            <p className="mb-3 text-sm text-[var(--dg-dim)]">
              Something went wrong. Running in safe mode.
            </p>
            <button
              onClick={handleAnalyze}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white"
              style={{
                backgroundColor: "var(--dg-accent)",
                boxShadow: "0 0 12px rgba(108, 92, 231, 0.3)",
              }}
            >
              Load Demo Data
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
