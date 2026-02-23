"use client";

import React from "react";
import { Claim } from "@/lib/types";

export function FounderCard({
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
                      {entry.prev_role || "Role"} at <span className="text-blue-400">{entry.prev_company}</span>
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
