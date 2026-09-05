"""
scripts/ingest_metrics.py
Pulls financial metrics and physical supply-chain telemetry for all 24 seed nodes.
Provider chain: FMP (if FMP_API_KEY set) -> yfinance (free, global tickers) -> static defaults.
"""

import json
import os
from typing import Any, Dict, List

import requests
from dotenv import load_dotenv

load_dotenv()

FMP_API_KEY = os.getenv("FMP_API_KEY", "")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SEED_PATH = os.path.join(BASE_DIR, "data", "nodes_seed.json")
OUTPUT_PATH = os.path.join(BASE_DIR, "data", "live_telemetry.json")

# Physical proxy heuristics for AI hardware bottlenecks.
# NOTE: static fixture estimates until TrendForce/SEMI/BNEF feeds are wired in —
# refresh manually from quarterly filings (see CLAUDE.md Phase 2 proxies).
PHYSICAL_PROXIES = {
    "TSM": {"metric": "CoWoS Run-Rate", "value": "45k wpm", "status": "CONSTRAINED", "lead_time_trend": "EXPANDING"},
    "ASML": {"metric": "High-NA EUV Backlog", "value": "€38.5B", "status": "ALLOCATED", "lead_time_trend": "STABLE"},
    "2802.T": {"metric": "ABF Substrate Lead Time", "value": "28 Weeks", "status": "TIGHT", "lead_time_trend": "EXPANDING"},
    "6146.T": {"metric": "Dicing Saw Lead Time", "value": "16 Weeks", "status": "OPTIMAL", "lead_time_trend": "STABLE"},
    "KLAC": {"metric": "Inspection Tool Cycle", "value": "180 Days", "status": "CRITICAL", "lead_time_trend": "EXPANDING"},
    "000660.KS": {"metric": "HBM3e Allocation", "value": "100% FY26 Sold Out", "status": "CONSTRAINED", "lead_time_trend": "EXPANDING"},
    "VRT": {"metric": "Liquid Cooling Backlog", "value": "$7.2B", "status": "SURGING", "lead_time_trend": "EXPANDING"},
    "ETN": {"metric": "Transformer Interconnect Queue", "value": "112 Weeks", "status": "SEVERE_BOTTLENECK", "lead_time_trend": "EXPANDING"},
    "CEG": {"metric": "PPA Baseload Spread", "value": "$95/MWh", "status": "COMMITTED", "lead_time_trend": "STABLE"},
    "ANET": {"metric": "800G/1.6T Fabric Demand", "value": "+42% YoY", "status": "OPTIMAL", "lead_time_trend": "STABLE"},
}

DEFAULT_PROXY = {
    "metric": "Operational Throughput",
    "value": "Normal Run-rate",
    "status": "BALANCED",
    "lead_time_trend": "STABLE",
}


def normalize_ticker_for_fmp(ticker: str) -> str:
    # Converts Yahoo-style suffixes to FMP global ticker format
    return ticker.replace(".T", ".JP")


def fetch_fmp_quotes(tickers: List[str]) -> Dict[str, Any]:
    symbols = ",".join(normalize_ticker_for_fmp(t) for t in tickers)
    url = (
        "https://financialmodelingprep.com/stable/batch-quote-short"
        f"?symbols={symbols}&apikey={FMP_API_KEY}"
    )
    try:
        res = requests.get(url, timeout=10)
        if res.status_code == 200:
            return {item["symbol"]: item for item in res.json()}
        print(f"[x] FMP returned HTTP {res.status_code}")
    except Exception as e:
        print(f"[x] Error reaching FMP API: {e}")
    return {}


def fetch_yfinance_quotes(tickers: List[str]) -> Dict[str, Any]:
    """Free fallback: Yahoo Finance handles .T/.TW/.KS suffixes natively."""
    import yfinance as yf

    quotes: Dict[str, Any] = {}
    for batch_ticker in yf.Tickers(" ".join(tickers)).tickers.values():
        try:
            fi = batch_ticker.fast_info
            price = fi["last_price"]
            prev = fi["previous_close"]
            quotes[batch_ticker.ticker] = {
                "symbol": batch_ticker.ticker,
                "price": round(float(price), 2),
                "change": round((price / prev - 1.0) * 100.0, 2) if prev else 0.0,
                "volume": int(fi["last_volume"] or 0),
                "currency": fi["currency"],
            }
        except Exception as e:
            print(f"[x] yfinance failed for {batch_ticker.ticker}: {e}")
    return quotes


def fetch_live_quotes(tickers: List[str]) -> Dict[str, Any]:
    if FMP_API_KEY:
        quotes = fetch_fmp_quotes(tickers)
        if quotes:
            # Re-key FMP symbols back to the seed's Yahoo-style tickers
            return {t: quotes[normalize_ticker_for_fmp(t)] for t in tickers
                    if normalize_ticker_for_fmp(t) in quotes}
        print("[!] FMP empty — falling back to yfinance.")
    else:
        print("[!] No FMP_API_KEY found — using free yfinance feed.")
    return fetch_yfinance_quotes(tickers)


def run_pipeline() -> None:
    with open(SEED_PATH, "r") as f:
        seed_data = json.load(f)

    nodes = seed_data["nodes"]
    tickers = [n["ticker"] for n in nodes if n.get("entity_type", "PUBLIC") == "PUBLIC"]
    live_quotes = fetch_live_quotes(tickers)
    missing = [t for t in tickers if t not in live_quotes]
    if missing:
        print(f"[!] No live quote for {missing} — writing null market_data (Graceful Failures rule).")

    enriched_nodes = []
    for node in nodes:
        quote = live_quotes.get(node["ticker"], {})
        enriched_nodes.append(
            {
                **node,
                "market_data": {
                    "price": quote.get("price"),
                    "change_pct": quote.get("change"),
                    "volume": quote.get("volume"),
                    "currency": quote.get("currency", "USD"),
                    "live": bool(quote),
                },
                "telemetry": PHYSICAL_PROXIES.get(node["ticker"], DEFAULT_PROXY),
            }
        )

    output_payload = {
        "metadata": {
            "source": "AlphaTopology Ingestion Engine",
            "provider": "FMP" if FMP_API_KEY else "yfinance",
            "total_nodes": len(enriched_nodes),
            "live_quotes": len(live_quotes),
        },
        "nodes": enriched_nodes,
        "edges": seed_data["edges"],
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(output_payload, f, indent=2)

    print(f"[✓] Telemetry payload written: {OUTPUT_PATH} "
          f"({len(live_quotes)}/{len(tickers)} live quotes)")


if __name__ == "__main__":
    run_pipeline()
