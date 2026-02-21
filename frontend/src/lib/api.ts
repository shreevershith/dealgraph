import { AnalysisResult } from "./types";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function analyzeDeck(deckText: string): Promise<AnalysisResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300_000);

  try {
    const response = await fetch(`${API_URL}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deck_text: deckText }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Analysis failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Resolve an audio URL from the API response.
 * - API paths like "/api/audio/memo_abc.mp3" get the backend base prepended
 * - Absolute URLs (http/https) are used as-is
 * - Local fallbacks like "/fallback_memo.mp3" are used as-is (served from public/)
 */
export function resolveAudioUrl(audioUrl: string): string {
  if (!audioUrl) return "";
  if (audioUrl.startsWith("http://") || audioUrl.startsWith("https://")) {
    return audioUrl;
  }
  if (audioUrl.startsWith("/api/")) {
    return `${API_URL}${audioUrl}`;
  }
  // Local file in public/ (e.g. "/fallback_memo.mp3")
  return audioUrl;
}

export async function healthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3_000);

    const response = await fetch(`${API_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return response.ok;
  } catch {
    return false;
  }
}
