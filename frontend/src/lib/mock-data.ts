import { AnalysisResult } from "./types";

export const mockAnalysisResult: AnalysisResult = {
  status: "complete",
  claims: [
    {
      id: 1,
      text: "Digital payments is a $50B+ market growing 15% YoY",
      category: "market_size",
      status: "verified",
      evidence:
        "Grand View Research estimates the global digital payments market at $68.6B in 2023, growing at 14.2% CAGR through 2030.",
    },
    {
      id: 2,
      text: "3x YoY revenue growth",
      category: "traction",
      status: "unverified",
      evidence:
        "No public revenue data available. Claim could not be independently verified from available sources.",
    },
    {
      id: 3,
      text: "500 enterprise customers",
      category: "traction",
      status: "unverified",
      evidence:
        "Company website lists 12 case studies. LinkedIn shows ~25 employees, making 500 enterprise customers unlikely without further evidence.",
    },
    {
      id: 4,
      text: "CEO Jane Chen led payments at Stripe for 4 years",
      category: "team",
      status: "verified",
      evidence:
        "LinkedIn confirms Jane Chen held VP of Payments role at Stripe from 2018-2022.",
    },
    {
      id: 5,
      text: "CTO Marcus Rivera built ML platform at Scale AI",
      category: "team",
      status: "verified",
      evidence:
        "LinkedIn confirms Marcus Rivera was Senior Staff Engineer at Scale AI, leading their ML Infrastructure team from 2019-2023.",
    },
    {
      id: 6,
      text: "No direct competitors in AI-powered B2B payment orchestration",
      category: "competition",
      status: "red_flag",
      evidence:
        "Found 8 well-funded companies in adjacent or overlapping space including Stripe ($8.8B raised), Checkout.com ($1.8B raised), Ramp ($1.6B raised), and others. Claim of no competition is misleading.",
    },
  ],
  score: {
    overall: 7.2,
    breakdown: {
      team: 8.5,
      market: 7.0,
      traction: 6.5,
      competition: 6.0,
      financials: 7.5,
    },
    recommendation: "Further Diligence",
  },
  memo: `## Executive Summary

Acme Payments is building an AI-powered B2B payment orchestration platform targeting mid-market enterprises. The company is led by a strong founding team with relevant experience at Stripe and Scale AI.

## Key Findings

**Strengths:**
- Strong founding team with direct domain experience
- Large and growing addressable market ($50B+)
- Differentiated AI-first approach to payment orchestration

**Concerns:**
- Traction claims (3x growth, 500 customers) could not be independently verified
- Competitive landscape is significantly more crowded than presented
- 8 well-funded competitors identified with combined $14.9B in funding

## Recommendation

The deal merits further diligence. The team is strong and the market is real, but the competitive dynamics and unverified traction claims require deeper investigation before committing capital.`,
  audio_url: "/api/audio/acme_memo.mp3",
  competitors: [
    { name: "Stripe", total_raised: 8_800_000_000, stage: "Late Stage", employee_count: 8000 },
    { name: "Checkout.com", total_raised: 1_800_000_000, stage: "Series D", employee_count: 1800 },
    { name: "Ramp", total_raised: 1_600_000_000, stage: "Series D", employee_count: 800 },
    { name: "Brex", total_raised: 1_200_000_000, stage: "Series D", employee_count: 1100 },
    { name: "Plaid", total_raised: 734_000_000, stage: "Series D", employee_count: 1200 },
    { name: "Square", total_raised: 590_000_000, stage: "Public", employee_count: 12000 },
    { name: "Adyen", total_raised: 266_000_000, stage: "Public", employee_count: 4000 },
    { name: "Mercury", total_raised: 163_000_000, stage: "Series B", employee_count: 400 },
    { name: "Acme Payments", total_raised: 5_000_000, stage: "Series A", employee_count: 25 },
  ],
};
