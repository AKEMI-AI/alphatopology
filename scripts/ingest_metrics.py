"""
scripts/ingest_metrics.py
Pulls financial metrics and physical supply-chain telemetry for all 24 seed nodes.
Provider chain: FMP (if FMP_API_KEY set) -> yfinance (free, global tickers) -> static defaults.
"""

import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Tuple

import requests
from dotenv import load_dotenv

load_dotenv()

FMP_API_KEY = os.getenv("FMP_API_KEY", "")
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(Path(BASE_DIR) / "src"))

from alphatopology.telemetry import get_physical_proxy  # noqa: E402

SEED_PATH = os.path.join(BASE_DIR, "data", "nodes_seed.json")
OUTPUT_PATH = os.path.join(BASE_DIR, "data", "live_telemetry.json")


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


def fetch_live_quotes(tickers: List[str]) -> Tuple[Dict[str, Any], Dict[str, str]]:
    quotes: Dict[str, Any] = {}
    providers: Dict[str, str] = {}
    if FMP_API_KEY:
        fmp_quotes = fetch_fmp_quotes(tickers)
        for ticker in tickers:
            normalized = normalize_ticker_for_fmp(ticker)
            if normalized in fmp_quotes:
                quotes[ticker] = fmp_quotes[normalized]
                providers[ticker] = "FMP"
        if len(quotes) < len(tickers):
            print("[!] FMP incomplete — filling missing tickers with yfinance.")
    else:
        print("[!] No FMP_API_KEY found — using free yfinance feed.")

    missing = [ticker for ticker in tickers if ticker not in quotes]
    yahoo_quotes = fetch_yfinance_quotes(missing) if missing else {}
    for ticker, quote in yahoo_quotes.items():
        quotes[ticker] = quote
        providers[ticker] = "yfinance"
    return quotes, providers


def run_pipeline() -> None:
    with open(SEED_PATH, "r") as f:
        seed_data = json.load(f)

    nodes = seed_data["nodes"]
    tickers = [n["ticker"] for n in nodes]
    live_quotes, providers = fetch_live_quotes(tickers)
    as_of = datetime.now(timezone.utc).isoformat()
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
                    "currency": quote.get("currency"),
                    "live": bool(quote),
                    "provider": providers.get(node["ticker"]),
                    "as_of": as_of,
                },
                "telemetry": get_physical_proxy(node["ticker"]),
            }
        )

    output_payload = {
        "metadata": {
            "source": "AlphaTopology Ingestion Engine",
            "providers": sorted(set(providers.values())),
            "as_of": as_of,
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
