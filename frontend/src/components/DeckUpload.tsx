"use client";

import { useState, useRef, useEffect, useCallback, DragEvent } from "react";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const PROGRESS_STEPS = [
  "Extracting claims from pitch deck...",
  "Checking facts against knowledge graph...",
  "Scoring deal across 5 dimensions...",
  "Mapping competitive landscape...",
  "Generating investment memo...",
];

/**
 * Extract text from a PDF file by uploading to the backend.
 */
async function extractTextFromPdf(file: File): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/extract-pdf`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.text || "";
}

interface DeckUploadProps {
  onAnalyze: (deckText: string) => void;
  loading: boolean;
}

export default function DeckUpload({ onAnalyze, loading }: DeckUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [extractedPdfText, setExtractedPdfText] = useState("");
  const [extracting, setExtracting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [progressIdx, setProgressIdx] = useState(0);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Cycle progress text while loading
  useEffect(() => {
    if (!loading) {
      setProgressIdx(0);
      return;
    }
    const interval = setInterval(() => {
      setProgressIdx((i) => (i + 1) % PROGRESS_STEPS.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [loading]);

  const handleFile = useCallback(async (file: File) => {
    setFileName(file.name);
    setTextInput("");
    setError("");
    setExtracting(true);

    try {
      const text = await extractTextFromPdf(file);
      if (text.trim().length < 20) {
        setError("Could not extract text from PDF. Try pasting the text instead.");
        setExtractedPdfText("");
      } else {
        setExtractedPdfText(text);
      }
    } catch (err) {
      console.error("PDF extraction failed:", err);
      setError("Failed to read PDF. Try pasting the text instead.");
      setExtractedPdfText("");
    } finally {
      setExtracting(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file && file.type === "application/pdf") {
        handleFile(file);
      }
    },
    [handleFile]
  );

  const handleAnalyze = () => {
    // Use extracted PDF text if available, otherwise use textarea input
    const text = extractedPdfText || textInput;
    if (text.trim()) {
      onAnalyze(text);
    }
  };

  const handleClear = () => {
    setFileName(null);
    setTextInput("");
    setExtractedPdfText("");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const hasFile = Boolean(fileName);

  // ── Loading state ──
  if (loading) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--dg-border)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-medium text-[var(--dg-text)]">
              Analyzing Deck
            </h2>
          </div>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6">
          {/* Spinner */}
          <div className="relative">
            <div className="h-16 w-16 rounded-full border-2 border-[var(--dg-border)]" />
            <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-2 border-transparent border-t-[var(--dg-accent)]" />
            <div
              className="absolute inset-2 h-12 w-12 animate-spin rounded-full border-2 border-transparent border-b-[var(--dg-accent)]"
              style={{
                animationDirection: "reverse",
                animationDuration: "1.5s",
              }}
            />
          </div>

          {/* Progress text */}
          <div className="space-y-2 text-center">
            <p
              className="text-sm font-medium text-[var(--dg-text)] transition-opacity duration-300"
              key={progressIdx}
            >
              {PROGRESS_STEPS[progressIdx]}
            </p>
            {/* Step dots */}
            <div className="flex items-center justify-center gap-1.5">
              {PROGRESS_STEPS.map((_, i) => (
                <div
                  key={i}
                  className="h-1 rounded-full transition-all duration-300"
                  style={{
                    width: i === progressIdx ? 16 : 4,
                    backgroundColor:
                      i === progressIdx
                        ? "var(--dg-accent)"
                        : i < progressIdx
                          ? "var(--dg-accent)"
                          : "var(--dg-border)",
                    opacity: i <= progressIdx ? 1 : 0.4,
                  }}
                />
              ))}
            </div>
          </div>

          {fileName && (
            <p className="text-[11px] text-[var(--dg-dim)]">{fileName}</p>
          )}
        </div>
      </div>
    );
  }

  // ── File selected ──
  if (hasFile) {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-[var(--dg-border)] px-4 py-3">
          <div className="flex items-center gap-2.5">
            <h2 className="text-sm font-medium text-[var(--dg-text)]">
              Upload Deck
            </h2>
          </div>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-4 p-5">
          {/* File summary */}
          <div
            className="flex items-center gap-3 rounded-lg px-4 py-3"
            style={{
              backgroundColor: "rgba(108, 92, 231, 0.06)",
              border: "1px solid rgba(108, 92, 231, 0.2)",
            }}
          >
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ backgroundColor: "rgba(108, 92, 231, 0.15)" }}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--dg-accent)"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--dg-text)]">
                {fileName}
              </p>
              <p className="text-[11px] text-[var(--dg-dim)]">
                {extracting
                  ? "Extracting text from PDF..."
                  : extractedPdfText
                    ? `${extractedPdfText.length.toLocaleString()} chars extracted`
                    : "PDF ready"}
              </p>
            </div>
            <button
              onClick={handleClear}
              className="shrink-0 rounded-md px-2 py-1 text-[11px] text-[var(--dg-dim)] transition-colors hover:bg-[var(--dg-border)] hover:text-[var(--dg-text)]"
            >
              Clear
            </button>
          </div>

          {/* Error */}
          {error && (
            <p className="text-[11px] text-[#ff6b6b]">{error}</p>
          )}

          {/* Analyze button */}
          <button
            onClick={handleAnalyze}
            disabled={extracting || (!extractedPdfText && !textInput)}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-semibold text-white transition-all hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              backgroundColor: "var(--dg-accent)",
              boxShadow: extracting ? "none" : "0 0 20px rgba(108, 92, 231, 0.3)",
            }}
          >
            {extracting ? (
              <>
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-transparent border-t-white" />
                Extracting PDF...
              </>
            ) : (
              <>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="11" cy="11" r="8" />
                  <path d="M21 21l-4.35-4.35" />
                </svg>
                Analyze Pitch Deck
              </>
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── Default: Drop zone + textarea ──
  return (
    <div className="flex flex-col">
      <div className="border-b border-[var(--dg-border)] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <h2 className="text-sm font-medium text-[var(--dg-text)]">
            Upload Deck
          </h2>
        </div>
      </div>

      <div className="flex flex-col gap-2 p-3">
        {/* Textarea with drop support */}
        <div
          className="relative"
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <textarea
            value={textInput}
            onChange={(e) => {
              setTextInput(e.target.value);
              setFileName(null);
              setExtractedPdfText("");
              setError("");
            }}
            placeholder="Paste pitch deck text or drop a PDF..."
            className="h-[60px] w-full resize-none rounded-lg border px-3 py-2 text-xs leading-relaxed text-[var(--dg-text)] placeholder-[var(--dg-dim)] outline-none transition-colors focus:border-[var(--dg-accent)]"
            style={{
              backgroundColor: "rgba(26, 26, 38, 0.5)",
              borderColor: dragOver ? "var(--dg-accent)" : "var(--dg-border)",
            }}
          />
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute right-2 top-2 rounded px-2 py-1 text-[10px] font-medium transition-colors"
            style={{
              backgroundColor: "rgba(108, 92, 231, 0.12)",
              color: "var(--dg-accent)",
              border: "1px solid rgba(108, 92, 231, 0.25)",
            }}
          >
            Browse PDF
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Error message */}
        {error && (
          <p className="text-[11px] text-[#ff6b6b]">{error}</p>
        )}

        {/* Analyze button - compact */}
        <button
          onClick={() => {
            if (!textInput.trim()) {
              setError("Please paste deck text or upload a PDF");
              return;
            }
            setError("");
            onAnalyze(textInput);
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-white transition-all hover:brightness-110"
          style={{
            backgroundColor: textInput.trim() ? "#6c5ce7" : "rgba(108, 92, 231, 0.35)",
            boxShadow: textInput.trim() ? "0 0 20px rgba(108, 92, 231, 0.3)" : "none",
            cursor: textInput.trim() ? "pointer" : "default",
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          Analyze Deck
        </button>
      </div>
    </div>
  );
}
