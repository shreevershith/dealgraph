"""
Seed Memgraph with the DealGraph VC knowledge graph data.

Generalized dataset across multiple domains (fintech, AI, dev tools, digital health,
health & fitness apps, enterprise automation, cybersecurity) with market and
company data aligned to publicly cited sources (Crunchbase, CMS/CDC, Statista,
MarketsandMarkets, etc.) for fact-checking pitch deck claims.

Usage:
    python seed_memgraph.py

Prerequisites:
    - Memgraph running (docker compose up memgraph)
    - pip install neo4j python-dotenv
"""

import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

URI = os.getenv("MEMGRAPH_URI", "bolt://localhost:7687")
USER = os.getenv("MEMGRAPH_USER", "")
PASSWORD = os.getenv("MEMGRAPH_PASSWORD", "")

auth = (USER, PASSWORD) if USER else None
driver = GraphDatabase.driver(URI, auth=auth)


def run(cypher: str):
    with driver.session() as session:
        session.run(cypher)


def esc(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "\\'")


def seed():
    print("[seed] Clearing existing data...")
    run("MATCH (n) DETACH DELETE n")

    # ── Constraints (Memgraph syntax) ──
    print("[seed] Creating constraints...")
    for c in [
        "CREATE CONSTRAINT ON (c:Company) ASSERT c.name IS UNIQUE;",
        "CREATE CONSTRAINT ON (p:Person) ASSERT p.name IS UNIQUE;",
        "CREATE CONSTRAINT ON (m:Market) ASSERT m.name IS UNIQUE;",
        "CREATE CONSTRAINT ON (i:Investor) ASSERT i.name IS UNIQUE;",
    ]:
        try:
            run(c)
        except Exception as e:
            if "already exists" not in str(e).lower():
                print(f"  Constraint warning: {e}")

    # ── Markets (TAM/CAGR from public reports: MarketsandMarkets, Statista, CDC/CMS, industry reports) ──
    print("[seed] Creating markets...")
    markets = [
        # Digital Payments: ~$50B+ segment, double-digit growth (industry reports)
        {"name": "Digital Payments", "tam_estimate": 50_000_000_000, "growth_rate": 15.2,
         "description": "Global digital payment processing including B2B and B2C transactions."},
        # AI Infrastructure: high growth (Gartner, IDC)
        {"name": "AI Infrastructure", "tam_estimate": 30_000_000_000, "growth_rate": 35.0,
         "description": "Tools, platforms and compute for building and deploying AI models."},
        # Developer Tools (Forrester, Gartner)
        {"name": "Developer Tools", "tam_estimate": 20_000_000_000, "growth_rate": 22.0,
         "description": "Software tools, platforms and services for software developers."},
        # Digital Health: $573B–$881B by 2030, ~18–23% CAGR (MarketsandMarkets, SkyQuest, GlobeNewswire 2024)
        {"name": "Digital Health", "tam_estimate": 600_000_000_000, "growth_rate": 20.0,
         "description": "Technology-enabled healthcare. US health spending ~$4.9T; ~90% toward chronic/preventable conditions (CDC/CMS). Majority of chronic disease preventable with lifestyle change (WHO/CDC)."},
        # Health & Fitness Apps: segment of digital health (Statista, Grand View)
        {"name": "Health & Fitness Apps", "tam_estimate": 94_000_000_000, "growth_rate": 22.0,
         "description": "Health and fitness app segment. Global smartphone users ~4.2B (Statista 2024); 18–55 segment often cited ~3.5B."},
        # Cybersecurity (Gartner, IDC)
        {"name": "Cybersecurity", "tam_estimate": 40_000_000_000, "growth_rate": 14.0,
         "description": "Security software, services and infrastructure."},
        # Enterprise Automation: $48B–$75B 2024, $111B–$250B by 2032 (DataHorizzon, Polaris 2024)
        {"name": "Enterprise Automation", "tam_estimate": 120_000_000_000, "growth_rate": 18.0,
         "description": "Enterprise process and AI-powered automation. RPA and business process automation."},
    ]
    for m in markets:
        run(
            f"CREATE (:Market {{name: '{esc(m['name'])}', tam_estimate: {m['tam_estimate']}, "
            f"growth_rate: {m['growth_rate']}, description: '{esc(m['description'])}'}});"
        )

    # ── Companies (fintech, AI, dev tools, digital health, health & fitness, enterprise automation) ──
    print("[seed] Creating companies...")
    companies = [
        # Fintech / Digital Payments
        {"name": "Stripe", "description": "Payment infrastructure for the internet. APIs for online and in-person payment processing.", "stage": "Late Stage", "founded_year": 2010, "total_raised": 8_800_000_000, "employee_count": 8000, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Square", "description": "Financial services and digital payments. Point-of-sale, Cash App, business banking.", "stage": "Public", "founded_year": 2009, "total_raised": 590_000_000, "employee_count": 12000, "hq_location": "San Francisco, CA", "status": "Public"},
        {"name": "Adyen", "description": "Global payment platform for enterprise. Unified commerce online, mobile, in-store.", "stage": "Public", "founded_year": 2006, "total_raised": 266_000_000, "employee_count": 4000, "hq_location": "Amsterdam, Netherlands", "status": "Public"},
        {"name": "Checkout.com", "description": "Cloud-based payment processing for enterprise merchants.", "stage": "Series D", "founded_year": 2012, "total_raised": 1_800_000_000, "employee_count": 1800, "hq_location": "London, UK", "status": "Active"},
        {"name": "Plaid", "description": "Financial data connectivity. APIs connecting apps to bank accounts.", "stage": "Series D", "founded_year": 2013, "total_raised": 734_000_000, "employee_count": 1200, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Brex", "description": "Corporate card and spend management for startups and enterprises.", "stage": "Series D", "founded_year": 2017, "total_raised": 1_200_000_000, "employee_count": 1100, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Ramp", "description": "Corporate card and expense management with automated savings.", "stage": "Series D", "founded_year": 2019, "total_raised": 1_600_000_000, "employee_count": 800, "hq_location": "New York, NY", "status": "Active"},
        {"name": "Mercury", "description": "Banking platform for startups. Business checking, savings, treasury.", "stage": "Series B", "founded_year": 2017, "total_raised": 163_000_000, "employee_count": 400, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Acme Payments", "description": "Next-generation B2B payment orchestration. AI-powered routing and reconciliation.", "stage": "Series A", "founded_year": 2023, "total_raised": 5_000_000, "employee_count": 25, "hq_location": "San Francisco, CA", "status": "Active"},
        # AI / ML
        {"name": "OpenAI", "description": "AI research lab. GPT models, ChatGPT, DALL-E.", "stage": "Late Stage", "founded_year": 2015, "total_raised": 11_000_000_000, "employee_count": 1500, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Anthropic", "description": "AI safety and reliable AI systems. Claude model family.", "stage": "Late Stage", "founded_year": 2021, "total_raised": 7_600_000_000, "employee_count": 900, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Cohere", "description": "Enterprise AI for text generation, search and analysis.", "stage": "Series C", "founded_year": 2019, "total_raised": 970_000_000, "employee_count": 500, "hq_location": "Toronto, Canada", "status": "Active"},
        {"name": "Scale AI", "description": "Data labeling and AI infrastructure for training ML models.", "stage": "Series F", "founded_year": 2016, "total_raised": 1_000_000_000, "employee_count": 700, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Hugging Face", "description": "Open-source AI platform. Model hub, datasets, inference APIs.", "stage": "Series D", "founded_year": 2016, "total_raised": 395_000_000, "employee_count": 250, "hq_location": "New York, NY", "status": "Active"},
        # Developer Tools
        {"name": "Vercel", "description": "Frontend cloud. Next.js deployment, edge functions, serverless.", "stage": "Series D", "founded_year": 2015, "total_raised": 563_000_000, "employee_count": 500, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Supabase", "description": "Open source Firebase alternative. Postgres, auth, storage, realtime.", "stage": "Series C", "founded_year": 2020, "total_raised": 116_000_000, "employee_count": 200, "hq_location": "Singapore", "status": "Active"},
        # Digital Health / Health & Fitness (Crunchbase, public filings)
        {"name": "VitalQuest", "description": "Gamifying preventive healthcare. Daily quests, guild battles, level system for wellness.", "stage": "Series A", "founded_year": 2024, "total_raised": 18_000_000, "employee_count": 45, "hq_location": "San Francisco, CA", "status": "Active"},
        {"name": "Duolingo", "description": "Language learning app with gamification. Streaks, XP, leaderboards.", "stage": "Public", "founded_year": 2011, "total_raised": 183_000_000, "employee_count": 700, "hq_location": "Pittsburgh, PA", "status": "Public"},
        {"name": "Peloton", "description": "Connected fitness. Subscription and hardware for at-home cycling and running.", "stage": "Public", "founded_year": 2012, "total_raised": 994_000_000, "employee_count": 3500, "hq_location": "New York, NY", "status": "Public"},
        {"name": "Noom", "description": "Behavior change and weight wellness app. Psychology-based coaching.", "stage": "Series F", "founded_year": 2008, "total_raised": 624_000_000, "employee_count": 500, "hq_location": "New York, NY", "status": "Active"},
        {"name": "Headspace", "description": "Meditation and mindfulness app. Mental health and sleep content.", "stage": "Series C", "founded_year": 2010, "total_raised": 322_000_000, "employee_count": 400, "hq_location": "Santa Monica, CA", "status": "Active"},
        # Enterprise Automation (PitchBook, Crunchbase, IPO)
        {"name": "UiPath", "description": "Enterprise RPA and automation platform. AI-powered process automation.", "stage": "Public", "founded_year": 2005, "total_raised": 2_000_000_000, "employee_count": 4000, "hq_location": "New York, NY", "status": "Public"},
        {"name": "Automation Anywhere", "description": "RPA and intelligent automation for enterprises.", "stage": "Series B", "founded_year": 2003, "total_raised": 1_000_000_000, "employee_count": 3000, "hq_location": "San Jose, CA", "status": "Active"},
        {"name": "Apple", "description": "Technology company. iPhone, Apple Health, HealthKit.", "stage": "Public", "founded_year": 1976, "total_raised": 0, "employee_count": 164000, "hq_location": "Cupertino, CA", "status": "Public"},
    ]
    for c in companies:
        run(
            f"CREATE (:Company {{name: '{esc(c['name'])}', description: '{esc(c['description'])}', "
            f"stage: '{c['stage']}', founded_year: {c['founded_year']}, total_raised: {c['total_raised']}, "
            f"employee_count: {c['employee_count']}, hq_location: '{esc(c['hq_location'])}', status: '{c['status']}'}});"
        )

    # ── People / Founders ──
    print("[seed] Creating people...")
    people = [
        {"name": "Jane Chen", "role": "CEO", "linkedin_url": "linkedin.com/in/janechen", "notable_exits": 0},
        {"name": "Marcus Rivera", "role": "CTO", "linkedin_url": "linkedin.com/in/marcusrivera", "notable_exits": 0},
        {"name": "Patrick Collison", "role": "CEO", "linkedin_url": "linkedin.com/in/patrickcollison", "notable_exits": 0},
        {"name": "John Collison", "role": "President", "linkedin_url": "linkedin.com/in/johncollison", "notable_exits": 0},
        {"name": "Jack Dorsey", "role": "CEO", "linkedin_url": "linkedin.com/in/jackdorsey", "notable_exits": 1},
        {"name": "Dario Amodei", "role": "CEO", "linkedin_url": "linkedin.com/in/darioamodei", "notable_exits": 0},
        {"name": "Sam Altman", "role": "CEO", "linkedin_url": "linkedin.com/in/samaltman", "notable_exits": 1},
        {"name": "Luis von Ahn", "role": "CEO", "linkedin_url": "linkedin.com/in/luisvonahn", "notable_exits": 1},
        {"name": "John Foley", "role": "Executive Chairman", "linkedin_url": "linkedin.com/in/johnfoley", "notable_exits": 0},
        {"name": "Saeju Jeong", "role": "CEO", "linkedin_url": "linkedin.com/in/saejujeong", "notable_exits": 0},
        {"name": "Andy Puddicombe", "role": "Co-Founder", "linkedin_url": "linkedin.com/in/andypuddicombe", "notable_exits": 0},
        {"name": "Daniel Dines", "role": "CEO", "linkedin_url": "linkedin.com/in/danieldines", "notable_exits": 0},
        {"name": "Mihir Shukla", "role": "CEO", "linkedin_url": "linkedin.com/in/mihirshukla", "notable_exits": 0},
        {"name": "Priya Anand", "role": "CEO", "linkedin_url": "linkedin.com/in/priyaanand", "notable_exits": 0},
        {"name": "Carlos Mendez", "role": "CTO", "linkedin_url": "linkedin.com/in/carlosmendez", "notable_exits": 0},
    ]
    for p in people:
        run(
            f"CREATE (:Person {{name: '{esc(p['name'])}', role: '{p['role']}', "
            f"linkedin_url: '{p['linkedin_url']}', notable_exits: {p['notable_exits']}}});"
        )

    # ── Investors ──
    print("[seed] Creating investors...")
    investors = [
        {"name": "Sequoia Capital", "type": "VC", "focus_areas": ["Fintech", "AI", "SaaS", "Enterprise"], "portfolio_size": 400},
        {"name": "Andreessen Horowitz", "type": "VC", "focus_areas": ["AI", "Crypto", "Enterprise", "Consumer"], "portfolio_size": 500},
        {"name": "Accel", "type": "VC", "focus_areas": ["SaaS", "Fintech", "Security"], "portfolio_size": 300},
        {"name": "Thrive Capital", "type": "VC", "focus_areas": ["AI", "Consumer", "SaaS"], "portfolio_size": 150},
        {"name": "Google Ventures", "type": "VC", "focus_areas": ["AI", "Enterprise", "Health"], "portfolio_size": 350},
        {"name": "General Catalyst", "type": "VC", "focus_areas": ["Health", "Fintech", "Enterprise"], "portfolio_size": 200},
    ]
    for inv in investors:
        focus = str(inv["focus_areas"]).replace("'", '"')
        run(f"CREATE (:Investor {{name: '{esc(inv['name'])}', type: '{inv['type']}', focus_areas: {focus}, portfolio_size: {inv['portfolio_size']}}});")

    # ── Funding Rounds ──
    print("[seed] Creating funding rounds...")
    rounds = [
        {"type": "Series I", "amount": 6_500_000_000, "date": "2023-03", "valuation": 50_000_000_000, "company_name": "Stripe"},
        {"type": "Series D", "amount": 1_000_000_000, "date": "2023-06", "valuation": 15_000_000_000, "company_name": "Checkout.com"},
        {"type": "Series D", "amount": 750_000_000, "date": "2023-04", "valuation": 8_000_000_000, "company_name": "Plaid"},
        {"type": "Series E", "amount": 4_000_000_000, "date": "2024-03", "valuation": 18_000_000_000, "company_name": "Anthropic"},
        {"type": "Seed", "amount": 5_000_000, "date": "2024-01", "valuation": 20_000_000, "company_name": "Acme Payments"},
        {"type": "Series A", "amount": 18_000_000, "date": "2024-06", "valuation": 72_000_000, "company_name": "VitalQuest"},
    ]
    for r in rounds:
        run(
            f"CREATE (:FundingRound {{type: '{r['type']}', amount: {r['amount']}, "
            f"date: '{r['date']}', valuation: {r['valuation']}, company_name: '{esc(r['company_name'])}'}});"
        )

    # ── Company → Market ──
    print("[seed] Creating company-market relationships...")
    company_markets = [
        ("Stripe", "Digital Payments"), ("Square", "Digital Payments"), ("Adyen", "Digital Payments"),
        ("Checkout.com", "Digital Payments"), ("Plaid", "Digital Payments"), ("Brex", "Digital Payments"),
        ("Ramp", "Digital Payments"), ("Mercury", "Digital Payments"), ("Acme Payments", "Digital Payments"),
        ("OpenAI", "AI Infrastructure"), ("Anthropic", "AI Infrastructure"), ("Cohere", "AI Infrastructure"),
        ("Scale AI", "AI Infrastructure"), ("Hugging Face", "AI Infrastructure"),
        ("Vercel", "Developer Tools"), ("Supabase", "Developer Tools"),
        ("VitalQuest", "Digital Health"), ("VitalQuest", "Health & Fitness Apps"),
        ("Duolingo", "Health & Fitness Apps"), ("Peloton", "Health & Fitness Apps"), ("Peloton", "Digital Health"),
        ("Noom", "Digital Health"), ("Noom", "Health & Fitness Apps"),
        ("Headspace", "Digital Health"), ("Headspace", "Health & Fitness Apps"),
        ("UiPath", "Enterprise Automation"), ("Automation Anywhere", "Enterprise Automation"),
    ]
    for company, market in company_markets:
        run(f"MATCH (c:Company {{name: '{esc(company)}'}}), (m:Market {{name: '{esc(market)}'}}) CREATE (c)-[:OPERATES_IN]->(m);")

    # ── COMPETES_WITH ──
    print("[seed] Creating competition relationships...")
    competitors = [
        ("Stripe", "Adyen"), ("Stripe", "Square"), ("Stripe", "Checkout.com"),
        ("Adyen", "Checkout.com"), ("Brex", "Ramp"),
        ("OpenAI", "Anthropic"), ("OpenAI", "Cohere"), ("Anthropic", "Cohere"),
        ("VitalQuest", "Noom"), ("VitalQuest", "Headspace"), ("VitalQuest", "Peloton"), ("VitalQuest", "Duolingo"),
        ("Noom", "Headspace"), ("Peloton", "Headspace"),
        ("UiPath", "Automation Anywhere"),
    ]
    for a, b in competitors:
        run(f"MATCH (a:Company {{name: '{esc(a)}'}}), (b:Company {{name: '{esc(b)}'}}) CREATE (a)-[:COMPETES_WITH]->(b), (b)-[:COMPETES_WITH]->(a);")

    # ── FOUNDED_BY ──
    print("[seed] Creating founder relationships...")
    founded_by = [
        ("Acme Payments", "Jane Chen"), ("Acme Payments", "Marcus Rivera"),
        ("Stripe", "Patrick Collison"), ("Stripe", "John Collison"),
        ("Square", "Jack Dorsey"), ("Anthropic", "Dario Amodei"), ("OpenAI", "Sam Altman"),
        ("Duolingo", "Luis von Ahn"), ("Peloton", "John Foley"), ("Noom", "Saeju Jeong"),
        ("Headspace", "Andy Puddicombe"), ("UiPath", "Daniel Dines"), ("Automation Anywhere", "Mihir Shukla"),
        ("VitalQuest", "Priya Anand"), ("VitalQuest", "Carlos Mendez"),
    ]
    for company, person in founded_by:
        run(f"MATCH (p:Person {{name: '{esc(person)}'}}), (c:Company {{name: '{esc(company)}'}}) CREATE (c)-[:FOUNDED_BY]->(p);")

    # Previous experience (for fact-checking)
    run("MATCH (p:Person {name: 'Jane Chen'}), (c:Company {name: 'Stripe'}) CREATE (p)-[:PREVIOUSLY_AT {role: 'Head of Payments Infrastructure', years: '2019-2023'}]->(c);")
    run("MATCH (p:Person {name: 'Marcus Rivera'}), (c:Company {name: 'Scale AI'}) CREATE (p)-[:PREVIOUSLY_AT {role: 'ML Platform Lead', years: '2020-2023'}]->(c);")
    run("MATCH (p:Person {name: 'Priya Anand'}), (c:Company {name: 'Duolingo'}) CREATE (p)-[:PREVIOUSLY_AT {role: 'Head of Growth', years: '2016-2022'}]->(c);")
    run("MATCH (p:Person {name: 'Carlos Mendez'}), (c:Company {name: 'Apple'}) CREATE (p)-[:PREVIOUSLY_AT {role: 'Staff Engineer Apple Health', years: '2017-2023'}]->(c);")

    # ── Funding → Company, Investor → Round ──
    print("[seed] Creating funding relationships...")
    for r in rounds:
        run(f"MATCH (fr:FundingRound {{company_name: '{esc(r['company_name'])}'}}), (c:Company {{name: '{esc(r['company_name'])}'}}) CREATE (fr)-[:RAISED_BY]->(c);")
    investor_rounds = [
        ("Sequoia Capital", "Stripe"), ("Andreessen Horowitz", "Anthropic"),
        ("Accel", "Checkout.com"), ("General Catalyst", "VitalQuest"),
    ]
    for investor, company in investor_rounds:
        run(f"MATCH (i:Investor {{name: '{esc(investor)}'}}), (fr:FundingRound {{company_name: '{esc(company)}'}}) CREATE (i)-[:LED_ROUND]->(fr);")

    # ── Verification ──
    print("\n[seed] Verifying data...")
    with driver.session() as session:
        result = session.run("MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY count DESC;")
        for record in result:
            print(f"  {record['type']}: {record['count']}")

        for company in ["Acme Payments", "VitalQuest"]:
            result = session.run("""
                MATCH (c:Company {name: $name})-[:OPERATES_IN]->(m:Market)<-[:OPERATES_IN]-(comp:Company)
                WHERE comp.name <> c.name
                RETURN comp.name AS name, comp.total_raised AS raised
                ORDER BY comp.total_raised DESC
            """, {"name": company})
            comps = [r.data() for r in result]
            print(f"\n  {company} competitors: {len(comps)} found")
            for c in comps[:5]:
                print(f"    {c['name']}: ${c['raised']:,.0f}")

    print("\n[seed] Done! Memgraph is ready.")
    driver.close()


if __name__ == "__main__":
    seed()
