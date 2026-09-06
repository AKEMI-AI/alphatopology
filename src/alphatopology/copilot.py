"""AlphaTopology Copilot — a research analyst over the supply-chain dataset.

Claude Opus 5 with SDK tool runner; tools expose the topology graph, live
market data, analyst forecasts, and the paper portfolio (read-only).
Research assistance only: the system prompt forbids presenting output as
licensed financial advice, and no tool can place orders.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

import anthropic
from anthropic import beta_tool
from dotenv import load_dotenv

from . import simulator
from .market import PHYSICAL_PROXIES, get_forecast, get_quotes
from .topology import (
    build_graph,
    chokepoints,
    critical_path,
    load_topology,
    resolve_ticker,
    upstream_dependencies,
)

load_dotenv()

MODEL = "claude-opus-5"

SYSTEM = """You are the AlphaTopology copilot: a research analyst embedded in a \
supply-chain intelligence terminal for the AI hardware industry (energy → EDA/materials \
→ wafer-fab equipment → foundry → packaging/test → ODM → data center).

Ground every claim in tool output — query the dataset rather than answering from memory, \
and say which tool result a number came from. Quotes are exchange-delayed (~15 min); \
physical telemetry values (CoWoS run-rate etc.) are labeled fixture estimates, not feed \
data — always flag them as such if you use them.

You help the user develop investment research and strategy: tracing dependencies, \
comparing valuations, sizing chokepoint risk, reviewing their paper portfolio against \
the thesis. You are not a licensed financial advisor and must say so when the user asks \
for a personal recommendation; frame output as research, scenarios, and questions to \
investigate, never as instructions to trade. You cannot place orders — paper or real."""

_graph = None
_topo = None


def _g():
    global _graph, _topo
    if _graph is None:
        _topo = load_topology()
        _graph = build_graph(_topo)
    return _graph


@beta_tool
def topology_overview() -> str:
    """Summarize the supply-chain graph: stages, baskets, chokepoint authorities, and the critical path."""
    g = _g()
    path, days = critical_path(g)
    chokes = chokepoints(g, 0.9)
    return json.dumps(
        {
            "nodes": g.number_of_nodes(),
            "edges": g.number_of_edges(),
            "chokepoint_authorities": [
                {"ticker": c.ticker, "name": c.name, "stage": c.stage, "rating": c.chokepoint_rating}
                for c in chokes
            ],
            "critical_path": {"route": path, "total_lead_time_days": days},
        }
    )


@beta_tool
def get_node(ticker: str) -> str:
    """Full profile for one company: graph position, live quote, physical telemetry, analyst forecast.

    Args:
        ticker: Ticker or node id, e.g. NVDA, 4063.T, TSMC.
    """
    g = _g()
    node_id = resolve_ticker(g, ticker)
    attrs = dict(g.nodes[node_id])
    t = attrs["ticker"]
    quote = get_quotes([t]).get(t, {})
    return json.dumps(
        {
            "node": attrs,
            "quote_delayed": quote,
            "physical_telemetry_FIXTURE_ESTIMATE": PHYSICAL_PROXIES.get(t),
            "analyst_forecast": get_forecast(t),
        }
    )


@beta_tool
def trace_upstream(ticker: str) -> str:
    """Trace every transitive supplier of a company with worst-case cumulative lead times.

    Args:
        ticker: Ticker or node id to trace upstream from.
    """
    g = _g()
    node_id = resolve_ticker(g, ticker)
    return json.dumps({"target": node_id, "upstream": upstream_dependencies(g, node_id)})


@beta_tool
def market_snapshot(basket: str = "ALL") -> str:
    """Live delayed quotes for topology companies, optionally filtered by basket.

    Args:
        basket: One of BK_CHOKE, BK_FRONT, BK_BACK, BK_FABLESS, BK_INFRA, or ALL.
    """
    g = _g()
    tickers = [
        a["ticker"] for _, a in g.nodes(data=True)
        if basket == "ALL" or a["basket"] == basket
    ]
    return json.dumps(get_quotes(tickers))


@beta_tool
def dislocation_snapshot() -> str:
    """Compare valuation multiples of upstream chokepoint monopolies vs hyperscaler demand sink (EV/EBITDA, forward P/E)."""
    g = _g()
    upstream = [a["ticker"] for _, a in g.nodes(data=True) if a["chokepoint_rating"] >= 0.9]
    downstream = [a["ticker"] for _, a in g.nodes(data=True) if a["stage"] == "HYPERSCALE_DEPLOYMENT"]

    def side(tickers: List[str]) -> Dict[str, Any]:
        rows = {t: get_forecast(t) for t in tickers}
        evs = [r["ev_to_ebitda"] for r in rows.values() if r.get("ev_to_ebitda")]
        pes = [r["forward_pe"] for r in rows.values() if r.get("forward_pe")]
        med = lambda xs: sorted(xs)[len(xs) // 2] if xs else None  # noqa: E731
        return {"tickers": rows, "median_ev_ebitda": med(evs), "median_forward_pe": med(pes)}

    up, down = side(upstream), side(downstream)
    ratio = (
        round(down["median_ev_ebitda"] / up["median_ev_ebitda"], 3)
        if up["median_ev_ebitda"] and down["median_ev_ebitda"]
        else None
    )
    return json.dumps(
        {"upstream_monopolies": up, "hyperscalers": down, "downstream_over_upstream_ev_ebitda": ratio}
    )


@beta_tool
def key_people(org: str = "ALL") -> str:
    """Key people in the AI industry graph: roles, affiliations, and lineage (e.g. lab departures).

    Args:
        org: A node id/ticker (e.g. NVIDIA, OPENAI) to filter by, or ALL.
    """
    import pathlib

    data = json.loads(
        (pathlib.Path(__file__).resolve().parents[2] / "data" / "people_seed.json").read_text()
    )
    people = data["people"]
    if org != "ALL":
        g = _g()
        try:
            org_id = resolve_ticker(g, org)
        except KeyError:
            org_id = org.upper()
        people = [
            p for p in people
            if any(r["org"] == org_id for r in p.get("roles", []))
            or any(l.get("from_org") == org_id for l in p.get("lineage", []))
        ]
    return json.dumps({"_meta": data["_meta"], "people": people})


@beta_tool
def industry_snapshots(stage: str = "ALL") -> str:
    """Curated nested models of the forces acting on the AI pipeline (power wall, HBM cycle, circular financing, export controls, packaging, talent, robotics, macro). Each has thesis impact, drivers, and watch items.

    Args:
        stage: A pipeline stage (e.g. FOUNDATION_MODELS, MEMORY_HBM) or snapshot id, or ALL.
    """
    import pathlib

    data = json.loads(
        (pathlib.Path(__file__).resolve().parents[2] / "data" / "industry_snapshots.json").read_text()
    )
    snaps = data["snapshots"]
    if stage != "ALL":
        key = stage.upper()
        snaps = [s for s in snaps if s["id"] == key or key in s["scope_stages"]]
    return json.dumps({"_meta": data["_meta"], "snapshots": snaps})


@beta_tool
def frontier_models(org: str = "ALL") -> str:
    """Notable AI models with training compute (Epoch AI database, CC BY). Filter by lab/org node id or ALL for the frontier set.

    Args:
        org: Node id/ticker (OPENAI, ANTHROPIC, GOOGLE…) or ALL.
    """
    import pathlib

    data = json.loads(
        (pathlib.Path(__file__).resolve().parents[2] / "data" / "external" / "epoch_models.json").read_text()
    )
    models = data["models"]
    if org != "ALL":
        key = org.upper()
        models = [m for m in models if m.get("org_id") == key]
    else:
        models = sorted(models, key=lambda m: -(m.get("log10_flop") or 0))[:40]
    return json.dumps({"_meta": data["_meta"], "models": models})


@beta_tool
def materials_inputs(stage: str = "ALL") -> str:
    """Material inputs and environmental footprint of the chip pipeline (resists, gases, quartz, water, power, PFAS) with supplier nodes. Curated from CSET/ESG public sources.

    Args:
        stage: Pipeline stage (e.g. FOUNDRY, RAW_MATERIALS_CHEMISTRY) or ALL.
    """
    import pathlib

    data = json.loads(
        (pathlib.Path(__file__).resolve().parents[2] / "data" / "materials_environment.json").read_text()
    )
    if stage != "ALL":
        data = {
            "_meta": data["_meta"],
            "stages": [s for s in data["stages"] if s["stage"] == stage.upper()],
            "environmental_watch": data["environmental_watch"],
        }
    return json.dumps(data)


@beta_tool
def deal_ledger(org: str = "ALL") -> str:
    """Dated, cited deal records behind the capital/compute flows (announcement dates, amounts, citations, verify flags).

    Args:
        org: Node id/ticker to filter deals touching it, or ALL.
    """
    import pathlib

    data = json.loads(
        (pathlib.Path(__file__).resolve().parents[2] / "data" / "deals.json").read_text()
    )
    deals = data["deals"]
    if org != "ALL":
        key = org.upper()
        deals = [d for d in deals if d["source"] == key or d["target"] == key]
    return json.dumps({"_meta": data["_meta"], "deals": deals})


@beta_tool
def news_digest(force: str = "ALL") -> str:
    """Thesis-filtered AI-industry news clusters from the latest crawl (headline, matched nodes/forces, sources with publishers and dates). Filter by force id or ALL.

    Args:
        force: A force/snapshot id (e.g. HBM_SUPERCYCLE, POWER_WALL) or ALL.
    """
    import pathlib

    data = json.loads(
        (pathlib.Path(__file__).resolve().parents[2] / "data" / "news.json").read_text()
    )
    stories = data["stories"]
    if force != "ALL":
        stories = [s for s in stories if force.upper() in s["forces"]]
    return json.dumps({"_meta": data["_meta"], "stories": stories[:30]})


@beta_tool
def paper_portfolio() -> str:
    """Read the user's paper-trading portfolio: positions, marks, P&L, cash. Read-only."""
    return json.dumps(simulator.portfolio_status())


TOOLS = [topology_overview, get_node, trace_upstream, market_snapshot, dislocation_snapshot, key_people, industry_snapshots, frontier_models, materials_inputs, deal_ledger, news_digest, paper_portfolio]

BRIEF_INSTRUCTION = """Compose a structured research brief on the requested topic using the tools \
— query the dataset first, then write. Format as markdown:

# <Title>
*AlphaTopology brief · <date> · research, not investment advice*

## The read  (3-5 sentences: the answer)
## What the data shows  (grounded findings; name the tool each number came from)
## Forces in play  (relevant industry snapshots, applied to the topic)
## What to watch  (specific, checkable items)
## Test runs  (optional: 1-3 paper-book scenarios framed as hypotheses to track, never instructions)

Keep it under ~700 words. Flag fixture estimates and verify-tagged data. \
End with: "Methodology: AlphaTopology graph + delayed market data; curated layers dated in-line."
"""


def run_brief(topic: str) -> str:
    """Generate a structured research brief on a topic. Raises RuntimeError without credentials."""
    return run_copilot(
        [{"role": "user", "content": f"{BRIEF_INSTRUCTION}\n\nTopic: {topic}"}],
        max_tokens=8000,
    )


def run_copilot(history: List[Dict[str, str]], max_tokens: int = 4096) -> str:
    """Run one copilot turn over the chat history. Raises RuntimeError without credentials."""
    if not (os.getenv("ANTHROPIC_API_KEY") or os.getenv("ANTHROPIC_AUTH_TOKEN")):
        raise RuntimeError(
            "No Anthropic credentials: set ANTHROPIC_API_KEY in .env "
            "(or ANTHROPIC_AUTH_TOKEN) and restart the API."
        )
    client = anthropic.Anthropic()
    runner = client.beta.messages.tool_runner(
        model=MODEL,
        max_tokens=max_tokens,
        system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
        tools=TOOLS,
        messages=[{"role": m["role"], "content": m["content"]} for m in history],
    )
    final = None
    for message in runner:
        final = message
    if final is None:
        return "(no response)"
    return "".join(b.text for b in final.content if b.type == "text") or "(no text response)"
