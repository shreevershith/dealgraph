"""Quick test: POST Acme deck to /api/analyze and print response."""
import requests
import json

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
    url = "http://localhost:8000/api/analyze"
    payload = {"deck_text": ACME_DECK}
    print("POST /api/analyze (this may take 1–2 min)...")
    r = requests.post(url, json=payload, timeout=300)
    r.raise_for_status()
    data = r.json()
    print("\n--- Response ---")
    print("status:", data.get("status"))
    print("claims count:", len(data.get("claims", [])))
    print("score:", data.get("score", {}).get("overall"), "-", data.get("score", {}).get("recommendation"))
    print("audio_url:", data.get("audio_url"))
    print("competitors count:", len(data.get("competitors", [])))
    print("\n--- Memo (first 500 chars) ---")
    print((data.get("memo") or "")[:500])
    print("\n--- Full JSON saved to test_analyze_response.json ---")
    with open("test_analyze_response.json", "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

if __name__ == "__main__":
    main()
