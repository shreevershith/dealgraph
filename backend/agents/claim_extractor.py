from strands import Agent, tool
from strands.models.bedrock import BedrockModel


@tool
def parse_pitch_deck(deck_text: str) -> str:
    """Parse pitch deck text and return it for analysis.
    The agent will use its reasoning to extract and categorize claims."""
    return deck_text


CLAIM_EXTRACTOR_PROMPT = """You are a meticulous due diligence analyst for a venture capital firm.

Given pitch deck text, extract EVERY verifiable claim into a structured JSON list.

For each claim, output:
{
    "id": <sequential number>,
    "text": "The exact claim from the deck",
    "category": "market_size | traction | team | competition | financial",
    "verifiable": true/false
}

Categories:
- market_size: TAM, SAM, SOM, market growth claims
- traction: Revenue, users, growth metrics, customer counts
- team: Founder credentials, experience, track record
- competition: Competitive positioning, differentiation claims
- financial: Revenue projections, unit economics, margins

Be thorough. Extract at least 5-10 claims. Focus on claims that CAN be checked against external data.
Output ONLY valid JSON - no explanation, no markdown fences, no emojis."""

claim_extractor = Agent(
    model=BedrockModel(model_id="us.anthropic.claude-sonnet-4-20250514-v1:0"),
    system_prompt=CLAIM_EXTRACTOR_PROMPT,
    tools=[parse_pitch_deck],
    callback_handler=None
)
