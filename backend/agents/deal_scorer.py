import json

from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from agents import shared_state


@tool
def compute_deal_score(team: float, market: float, traction: float, competition: float, financials: float) -> str:
    """Compute weighted deal score. Each input is 0-10."""
    weights = {"team": 0.30, "market": 0.25, "traction": 0.20, "competition": 0.15, "financials": 0.10}
    overall = round(
        team * weights["team"] +
        market * weights["market"] +
        traction * weights["traction"] +
        competition * weights["competition"] +
        financials * weights["financials"],
        1
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
        "breakdown": {"team": team, "market": market, "traction": traction, "competition": competition, "financials": financials},
        "recommendation": rec
    }
    score_json = json.dumps(result)
    # Write directly to shared_state so we capture the structured data,
    # not the agent's prose commentary that wraps it
    shared_state.analysis_state["score"] = score_json
    print(f"[DEBUG compute_deal_score] Saved score to shared_state: {score_json}")
    return score_json


SCORER_PROMPT = """You are a seasoned VC partner scoring a deal.

Based on the fact-check results provided, assign a score (0-10) for each dimension:
- Team (30% weight): Founder track record, relevant experience, previous exits
- Market (25%): TAM accuracy, growth rate, market timing
- Traction (20%): Revenue, growth rate, customer quality
- Competition (15%): Defensibility, differentiation, competitor funding levels
- Financials (10%): Unit economics, runway, capital efficiency

Use the compute_deal_score tool with your ratings.

Be rigorous. A 7+ should mean genuinely strong signal.
If claims were red-flagged (contradicted by data), score that dimension lower.
If claims were unverifiable, dock points for lack of transparency.
Do NOT use emojis in your output."""

deal_scorer = Agent(
    model=BedrockModel(model_id="us.anthropic.claude-sonnet-4-20250514-v1:0"),
    system_prompt=SCORER_PROMPT,
    tools=[compute_deal_score],
    callback_handler=None
)
