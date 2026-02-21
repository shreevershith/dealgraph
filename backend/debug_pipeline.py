"""Run the orchestrator directly and print any exception."""
import sys
import traceback

# Load env from dealgraph-backend
from pathlib import Path
import os
os.chdir(Path(__file__).resolve().parent)
from dotenv import load_dotenv
load_dotenv()

ACME_DECK = """
Acme Payments — Series A Pitch Deck

MARKET: The global digital payments market is worth over $50 billion and growing at 15% year-over-year.

SOLUTION: Acme Payments is a next-generation B2B payment orchestration platform using AI-powered routing for cross-border enterprise payments.

TRACTION: We've achieved 3x year-over-year revenue growth and serve 500 enterprise customers.

TEAM: CEO Jane Chen spent 4 years leading payments infrastructure at Stripe. CTO Marcus Rivera built the ML platform at Scale AI.

COMPETITION: There are no direct competitors in AI-powered B2B payment orchestration. Existing players focus on consumer payments.

ASK: Raising $15M Series A at $60M pre-money valuation.
"""

def main():
    print("Calling orchestrator (may take 1-2 min)...")
    try:
        from agents.orchestrator import orchestrator
        result = orchestrator(f"Analyze this pitch deck:\n\n{ACME_DECK}")
        print("SUCCESS:", type(result), str(result)[:500])
    except Exception as e:
        print("EXCEPTION:", type(e).__name__, str(e))
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
