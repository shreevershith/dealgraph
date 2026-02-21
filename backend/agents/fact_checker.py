from strands import Agent, tool
from strands.models.bedrock import BedrockModel
from tools.neo4j_tools import find_competitors, verify_founder, check_market_data


@tool
def query_competitors(company_name: str) -> str:
    """Find companies competing in the same market. Returns list of competitors with funding data."""
    results = find_competitors(company_name)
    return str(results)


@tool
def check_founder_background(founder_name: str) -> str:
    """Verify a founder's track record — previous companies, roles, and exits."""
    results = verify_founder(founder_name)
    return str(results)


@tool
def validate_market_size(market_keyword: str) -> str:
    """Check TAM/market size claims against stored market data."""
    results = check_market_data(market_keyword)
    return str(results)


FACT_CHECKER_PROMPT = """You are a relentless fact-checker for a top-tier venture capital firm.

Given a list of claims extracted from a pitch deck, verify each one using the available tools.

For EACH claim:
1. Use the appropriate tool to check it against the knowledge graph
2. Rate the claim:
   - "verified": Data supports the claim
   - "partial": Some support but gaps exist
   - "unverified": No supporting data found
   - "red_flag": Data CONTRADICTS the claim

Output a JSON list:
[
  {
    "id": <claim id>,
    "text": "original claim text",
    "category": "original category",
    "status": "verified | partial | unverified | red_flag",
    "evidence": "Specific data points from the graph that support or contradict the claim"
  }
]

Be specific in evidence. Cite exact numbers from the graph.
If a company claims "no competitors" but you find competitors, that is a RED FLAG.
Output ONLY valid JSON. Do NOT use emojis."""

fact_checker = Agent(
    model=BedrockModel(model_id="us.anthropic.claude-sonnet-4-20250514-v1:0"),
    system_prompt=FACT_CHECKER_PROMPT,
    tools=[query_competitors, check_founder_background, validate_market_size],
    callback_handler=None
)
