"""FastAPI backend stub serving the supply-chain graph to the living dashboard.

Run:  uvicorn api.main:app --reload --port 8000
The Next.js dashboard will consume /topology and /topology/upstream/{ticker}.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from fastapi import FastAPI, HTTPException  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from alphatopology.market import (  # noqa: E402
    DEFAULT_PROXY,
    PHYSICAL_PROXIES,
    get_forecast,
    get_history,
    get_quotes,
    get_returns,
)
from alphatopology.topology import (  # noqa: E402
    build_graph,
    chokepoints,
    critical_path,
    load_topology,
    resolve_ticker,
    upstream_dependencies,
)

app = FastAPI(title="AlphaTopology Graph API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

_topo = load_topology()
_g = build_graph(_topo)


@app.get("/topology")
def get_topology():
    """Full node/edge structure, schema-identical to data/nodes_seed.json."""
    return _topo.model_dump()


@app.get("/topology/chokepoints")
def get_chokepoints(threshold: float = 0.95):
    return [n.model_dump() for n in chokepoints(_g, threshold)]


@app.get("/topology/critical-path")
def get_critical_path():
    path, days = critical_path(_g)
    return {"path": path, "total_lead_time_days": days}


@app.get("/topology/upstream/{ticker}")
def get_upstream(ticker: str):
    try:
        node_id = resolve_ticker(_g, ticker)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return {"node": _g.nodes[node_id], "upstream": upstream_dependencies(_g, node_id)}


@app.get("/market/telemetry")
def market_telemetry():
    """Live quotes for every topology node merged with physical proxy fixtures.
    Quotes are Yahoo-feed (exchange-delayed), cached 60s server-side."""
    # private entities have pseudo-tickers — never send them to the quote feed
    tickers = [n.ticker for n in _topo.nodes if n.entity_type == "PUBLIC"]
    quotes = get_quotes(tickers)
    return {
        "metadata": {
            "provider": "yfinance",
            "quote_ttl_seconds": 60,
            "note": "telemetry values are FIXTURE_ESTIMATE until industry feeds are wired in",
        },
        "nodes": [
            {
                **n.model_dump(),
                "market_data": quotes.get(n.ticker, {}),
                "telemetry": PHYSICAL_PROXIES.get(n.ticker, DEFAULT_PROXY),
            }
            for n in _topo.nodes
        ],
    }


@app.get("/market/movers")
def market_movers():
    """Multi-horizon returns (1d/1w/1m + sparkline) for every public node."""
    public = [n for n in _topo.nodes if n.entity_type == "PUBLIC"]
    rets = get_returns([n.ticker for n in public])
    quotes = get_quotes([n.ticker for n in public])
    return {
        "rows": [
            {
                "id": n.id,
                "ticker": n.ticker,
                "name": n.name,
                "basket": n.basket,
                "stage": n.stage,
                "price": (quotes.get(n.ticker) or {}).get("price"),
                "currency": (quotes.get(n.ticker) or {}).get("currency"),
                **(rets.get(n.ticker) or {}),
            }
            for n in public
        ]
    }


@app.get("/market/history/{ticker}")
def market_history(ticker: str, period: str = "1mo", interval: str = "1d"):
    """Real close-price history for the inspector chart."""
    data = get_history(ticker, period=period, interval=interval)
    if not data:
        raise HTTPException(status_code=404, detail=f"No history for '{ticker}'")
    return {"ticker": ticker, "period": period, "interval": interval, "data": data}


@app.get("/market/forecast/{ticker}")
def market_forecast(ticker: str):
    """Analyst consensus, price targets, and forward multiples (cached 1h)."""
    return get_forecast(ticker)


@app.get("/people")
def get_people():
    """Key-person graph (public-record professional roles; see _meta.note)."""
    import json as _json
    from pathlib import Path as _Path

    return _json.loads((_Path(__file__).resolve().parents[1] / "data" / "people_seed.json").read_text())


# ── Paper simulator (simulation only; no brokerage connection) ──

@app.get("/sim/portfolio")
def sim_portfolio():
    from alphatopology.simulator import portfolio_status

    return portfolio_status()


@app.get("/sim/trades")
def sim_trades():
    from alphatopology.simulator import trade_log

    return trade_log()


@app.get("/sim/equity")
def sim_equity():
    from alphatopology.simulator import equity_curve

    return {"curve": equity_curve()}


@app.post("/sim/order")
def sim_order(order: dict):
    from alphatopology.simulator import place_paper_order

    try:
        return place_paper_order(
            str(order.get("ticker", "")), str(order.get("side", "")), float(order.get("qty", 0))
        )
    except (ValueError, TypeError) as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Copilot ──

@app.post("/copilot/chat")
def copilot_chat(body: dict):
    """One research-copilot turn. body: {"history": [{"role","content"}...]}"""
    from alphatopology.copilot import run_copilot

    history = body.get("history", [])
    if not history:
        raise HTTPException(status_code=400, detail="history is required")
    try:
        reply = run_copilot(history)
    except RuntimeError as exc:  # missing credentials
        raise HTTPException(status_code=503, detail=str(exc))
    return {"reply": reply}


@app.post("/copilot/brief")
def copilot_brief(body: dict):
    """Structured research brief. body: {"topic": str}"""
    from alphatopology.copilot import run_brief

    topic = (body.get("topic") or "").strip()
    if not topic:
        raise HTTPException(status_code=400, detail="topic is required")
    try:
        return {"brief": run_brief(topic)}
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc))


@app.get("/external/models")
def external_models():
    """Epoch AI notable-models database, filtered to our universe (CC BY)."""
    import json as _json
    from pathlib import Path as _Path

    return _json.loads(
        (_Path(__file__).resolve().parents[1] / "data" / "external" / "epoch_models.json").read_text()
    )


@app.get("/deals")
def get_deals():
    """The deal ledger — dated, cited records behind every capital flow."""
    import json as _json
    from pathlib import Path as _Path

    return _json.loads((_Path(__file__).resolve().parents[1] / "data" / "deals.json").read_text())


@app.get("/materials")
def get_materials():
    """Materials & environmental footprint tier (curated, sourced)."""
    import json as _json
    from pathlib import Path as _Path

    return _json.loads(
        (_Path(__file__).resolve().parents[1] / "data" / "materials_environment.json").read_text()
    )


@app.get("/snapshots")
def get_snapshots():
    """Industry snapshots — curated force models over the pipeline."""
    import json as _json
    from pathlib import Path as _Path

    return _json.loads(
        (_Path(__file__).resolve().parents[1] / "data" / "industry_snapshots.json").read_text()
    )
