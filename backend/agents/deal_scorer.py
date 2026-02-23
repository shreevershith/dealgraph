"""Deal Scorer — confidence-weighted investment scoring.

Dimensions and weights:
  Team (30%) | Market (25%) | Traction (20%) | Competition (15%) | Financials (10%)

The scorer receives normalized evidence with confidence scores and instructs the
LLM to weight verified claims higher than unverified or flagged ones.
"""

import json

from strands import Agent, tool
from agents import shared_state
from model_config import get_model


@tool
def compute_deal_score(team: float, market: float, traction: float, competition: float, financials: float) -> str:
    """Compute weighted deal score. Each input is 0-10."""
    weights = {"team": 0.30, "market": 0.25, "traction": 0.20, "competition": 0.15, "financials": 0.10}
    overall = round(
        team * weights["team"]
        + market * weights["market"]
        + traction * weights["traction"]
        + competition * weights["competition"]
        + financials * weights["financials"],
        1,
    )
    rec = (
        "Strong Pass" if overall < 4 else
        "Pass" if overall < 5.5 else
        "Further Diligence" if overall < 7 else
        "Strong Interest" if overall < 8.5 else
        "Conviction Bet"
    )
    result = {
        "overall": overall,
        "breakdown": {
            "team": team,
            "market": market,
            "traction": traction,
            "competition": competition,
            "financials": financials,
        },
        "recommendation": rec,
    }
    score_json = json.dumps(result)
    shared_state.analysis_state["score"] = score_json
    print(f"[Pipeline] compute_deal_score: overall={overall} rec={rec}")
    return score_json


SCORER_PROMPT = """You are a seasoned VC partner scoring a deal using confidence-weighted evidence.

Each piece of evidence has a STATUS and CONFIDENCE score:
  - VERIFIED (confidence > 0.7)   -> claim is backed by data; score the dimension normally
  - VERIFIED (confidence 0.4-0.7) -> partially supported; adjust score proportionally
  - UNVERIFIED (low confidence)   -> no data found; dock 1-2 points for lack of transparency
  - CONTRADICTED                  -> data CONTRADICTS the claim; score that dimension LOW (2-4)
  - FLAGGED                       -> unverifiable projection; note it but don't dock heavily

Assign a score (0-10) for each dimension:
- Team (30% weight): Founder track record, relevant experience, previous exits
- Market (25%): TAM accuracy, growth rate, market timing
- Traction (20%): Revenue, growth rate, customer quality
- Competition (15%): Defensibility, differentiation, competitor funding levels
- Financials (10%): Unit economics, runway, capital efficiency

Use the compute_deal_score tool with your ratings.

Be rigorous. A 7+ should mean genuinely strong, well-verified signal.
A company with mostly unverified claims should score 4-6 (Further Diligence).
A company with contradicted claims should score below 4 (Pass/Strong Pass).
Do NOT use emojis in your output."""


deal_scorer = Agent(
    model=get_model(),
    system_prompt=SCORER_PROMPT,
    tools=[compute_deal_score],
    callback_handler=None,
)
