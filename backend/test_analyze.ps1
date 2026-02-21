$deckText = @"
Acme Payments — Series A Pitch Deck

MARKET: The global digital payments market is worth over $50 billion and growing at 15% year-over-year.

SOLUTION: Acme Payments is a next-generation B2B payment orchestration platform using AI-powered routing for cross-border enterprise payments.

TRACTION: We've achieved 3x year-over-year revenue growth and serve 500 enterprise customers.

TEAM: CEO Jane Chen spent 4 years leading payments infrastructure at Stripe. CTO Marcus Rivera built the ML platform at Scale AI.

COMPETITION: There are no direct competitors in AI-powered B2B payment orchestration. Existing players focus on consumer payments.

ASK: Raising $15M Series A at $60M pre-money valuation.
"@

$body = @{ deck_text = $deckText } | ConvertTo-Json
Invoke-RestMethod -Uri "http://localhost:8000/api/analyze" -Method Post -Body $body -ContentType "application/json"
