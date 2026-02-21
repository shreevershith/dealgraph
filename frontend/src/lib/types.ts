export interface Claim {
  id: number;
  text: string;
  category: "market_size" | "traction" | "team" | "competition" | "financial";
  status: "verified" | "unverified" | "partial" | "red_flag";
  evidence: string;
}

export interface ScoreBreakdown {
  team: number;
  market: number;
  traction: number;
  competition: number;
  financials: number;
}

export interface DealScore {
  overall: number;
  breakdown: ScoreBreakdown;
  recommendation: string;
}

export interface Competitor {
  name: string;
  total_raised: number;
  stage: string;
  employee_count?: number;
}

export interface AnalysisResult {
  status: string;
  claims: Claim[];
  score: DealScore;
  memo: string;
  audio_url: string;
  competitors: Competitor[];
  company_name?: string;
}
