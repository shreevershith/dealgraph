import os
from neo4j import GraphDatabase
from dotenv import load_dotenv

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USER = os.getenv("NEO4J_USER")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

driver = None
if NEO4J_URI and NEO4J_USER and NEO4J_PASSWORD:
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def run_query(cypher: str, params: dict = None) -> list:
    """Execute a Cypher query and return results as list of dicts."""
    if not driver:
        return []
    with driver.session() as session:
        result = session.run(cypher, params or {})
        return [record.data() for record in result]


def find_competitors(company_name: str) -> list:
    """Find companies in the same market as the given company (fuzzy, case-insensitive)."""
    # Try exact match first, then CONTAINS fallback for PDF-extracted names
    cypher = """
    MATCH (c:Company)
    WHERE toLower(c.name) = toLower($name)
       OR toLower(c.name) CONTAINS toLower($name)
       OR toLower($name) CONTAINS toLower(c.name)
    WITH c LIMIT 1
    MATCH (c)-[:OPERATES_IN]->(m:Market)<-[:OPERATES_IN]-(comp:Company)
    WHERE comp.name <> c.name
    RETURN comp.name AS name, comp.total_raised AS total_raised, comp.stage AS stage, comp.employee_count AS employee_count, m.name AS market
    ORDER BY comp.total_raised DESC
    """
    return run_query(cypher, {"name": company_name})


def verify_founder(founder_name: str) -> list:
    """Check founder's background — previous companies, roles, exits."""
    cypher = """
    MATCH (p:Person)
    WHERE toLower(p.name) CONTAINS toLower($name)
    OPTIONAL MATCH (p)-[r:PREVIOUSLY_AT]->(prev:Company)
    OPTIONAL MATCH (company:Company)-[:FOUNDED_BY]->(p)
    RETURN p.name AS name, p.role AS role, r.role AS prev_role, r.years AS prev_years,
           prev.name AS prev_company, prev.status AS prev_status,
           company.name AS current_company
    """
    return run_query(cypher, {"name": founder_name})


def check_market_data(market_keyword: str) -> list:
    """Validate TAM/market size claims against stored market data."""
    cypher = """
    MATCH (m:Market)
    WHERE toLower(m.name) CONTAINS toLower($kw)
    RETURN m.name AS name, m.tam_estimate AS tam_estimate, m.growth_rate AS growth_rate, m.description AS description
    """
    return run_query(cypher, {"kw": market_keyword})


def get_investor_overlap(company_name: str) -> list:
    """Find which investors have invested in competitors."""
    cypher = """
    MATCH (c:Company {name: $name})-[:OPERATES_IN]->(m:Market)<-[:OPERATES_IN]-(comp:Company),
          (inv:Investor)-[:LED_ROUND]->(:FundingRound)-[:RAISED_BY]->(comp)
    RETURN inv.name AS name, collect(DISTINCT comp.name) AS portfolio_in_space
    """
    return run_query(cypher, {"name": company_name})


def get_competitive_landscape(market_name: str) -> list:
    """Get full competitive landscape for a market."""
    cypher = """
    MATCH (m:Market {name: $market})<-[:OPERATES_IN]-(c:Company)
    OPTIONAL MATCH (c)<-[:RAISED_BY]-(fr:FundingRound)
    WITH c, sum(fr.amount) AS total_funding, max(fr.date) AS last_round
    RETURN c.name AS name, c.stage AS stage, c.total_raised AS total_raised, c.employee_count AS employee_count, total_funding AS total_funding, last_round AS last_round
    ORDER BY c.total_raised DESC
    """
    return run_query(cypher, {"market": market_name})
