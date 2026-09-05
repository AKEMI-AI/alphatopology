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
    get_forecast,
    get_history,
    get_quotes,
)
from alphatopology.telemetry import FIXTURE_SOURCE, get_physical_proxy  # noqa: E402
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
    allow_methods=["GET"],
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
    tickers = [n.ticker for n in _topo.nodes]
    quotes = get_quotes(tickers)
    return {
        "metadata": {
            "market_data_provider": "yfinance",
            "physical_telemetry_source": FIXTURE_SOURCE,
            "quote_ttl_seconds": 60,
            "note": "Physical telemetry values are fixture estimates until industry feeds are wired in.",
        },
        "nodes": [
            {
                **n.model_dump(),
                "market_data": quotes.get(n.ticker, {}),
                "telemetry": get_physical_proxy(n.ticker),
            }
            for n in _topo.nodes
        ],
    }


@app.get("/market/history/{ticker}")
def market_history(ticker: str, period: str = "1mo", interval: str = "1d"):
    """Real close-price history for the inspector chart."""
    data = get_history(ticker, period=period, interval=interval)
    if not data:
        raise HTTPException(status_code=404, detail=f"No history for '{ticker}'")
    return {
        "ticker": ticker,
        "period": period,
        "interval": interval,
        "provider": "yfinance",
        "data": data,
    }


@app.get("/market/forecast/{ticker}")
def market_forecast(ticker: str):
    """Analyst consensus, price targets, and forward multiples (cached 1h)."""
    return get_forecast(ticker)
