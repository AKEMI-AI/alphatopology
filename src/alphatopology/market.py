"""Live market data layer: quotes, price history, and analyst forecasts.

Free yfinance backend with in-process TTL caching. All lookups degrade to
None fields rather than raising (Graceful Failures rule) — non-US tickers
often lack analyst coverage fields.
"""

from __future__ import annotations

import threading
import time
from typing import Any, Dict, List, Optional

import yfinance as yf

_CACHE: Dict[str, Any] = {}
_REFRESHING: Dict[str, bool] = {}


def _cached(key: str, ttl: float, fn):
    """TTL cache with stale-while-revalidate: an expired entry is served
    immediately while a background thread refreshes it, so slow upstream
    fetches (24 sequential Yahoo calls) never block a request."""
    now = time.time()
    hit = _CACHE.get(key)
    if hit and hit[0] > now:
        return hit[1]
    if hit:  # stale — serve it, refresh in the background
        if not _REFRESHING.get(key):
            _REFRESHING[key] = True

            def refresh():
                try:
                    _CACHE[key] = (time.time() + ttl, fn())
                finally:
                    _REFRESHING[key] = False

            threading.Thread(target=refresh, daemon=True).start()
        return hit[1]
    value = fn()  # cold cache — nothing to serve, fetch synchronously
    _CACHE[key] = (now + ttl, value)
    return value


# Physical proxy heuristics for AI hardware bottlenecks.
# NOTE: static fixture estimates until TrendForce/SEMI/BNEF feeds are wired in —
# refresh manually from quarterly filings. Flagged data_source=FIXTURE_ESTIMATE
# so the UI can distinguish them from live feed values.
PHYSICAL_PROXIES: Dict[str, Dict[str, str]] = {
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


def get_fx_to_usd(ttl: float = 3600.0) -> Dict[str, float]:
    """USD per 1 unit of each foreign currency the topology trades in."""

    def fetch() -> Dict[str, float]:
        rates: Dict[str, float] = {"USD": 1.0}
        for ccy in ("JPY", "KRW", "TWD", "EUR"):
            try:
                # USDJPY=X quotes JPY per USD → invert for USD per JPY
                per_usd = yf.Ticker(f"USD{ccy}=X").fast_info["last_price"]
                if per_usd:
                    rates[ccy] = 1.0 / float(per_usd)
            except Exception:
                pass  # missing rate → market_cap_usd stays None for that ccy
        return rates

    return _cached("fx:usd", ttl, fetch)


def get_quotes(tickers: List[str], ttl: float = 60.0) -> Dict[str, Dict[str, Any]]:
    """Latest price/change/volume/market-cap per ticker (Yahoo feed,
    exchange-delayed). Market cap is FX-normalized to USD."""

    def fetch_one(fx: Dict[str, float], t) -> Dict[str, Any]:
        try:
            fi = t.fast_info
            price = fi["last_price"]
            prev = fi["previous_close"]
            currency = fi["currency"]
            cap = fi["market_cap"]
            cap_usd = (
                round(float(cap) * fx[currency])
                if cap and currency in fx
                else None
            )
            return {
                "price": round(float(price), 2),
                "change_pct": round((price / prev - 1.0) * 100.0, 2) if prev else 0.0,
                "volume": int(fi["last_volume"] or 0),
                "currency": currency,
                "market_cap_usd": cap_usd,
                "live": True,
            }
        except Exception:
            return {
                "price": None, "change_pct": None, "volume": None,
                "currency": None, "market_cap_usd": None, "live": False,
            }

    def fetch() -> Dict[str, Dict[str, Any]]:
        from concurrent.futures import ThreadPoolExecutor

        fx = get_fx_to_usd()
        ts = list(yf.Tickers(" ".join(tickers)).tickers.values())
        with ThreadPoolExecutor(max_workers=8) as pool:
            results = pool.map(lambda t: (t.ticker, fetch_one(fx, t)), ts)
        return dict(results)

    return _cached(f"quotes:{','.join(sorted(tickers))}", ttl, fetch)


def get_history(
    ticker: str, period: str = "1mo", interval: str = "1d", ttl: float = 300.0
) -> List[Dict[str, Any]]:
    """Real close-price history shaped for lightweight-charts: [{time, value}]."""

    def fetch() -> List[Dict[str, Any]]:
        df = yf.Ticker(ticker).history(period=period, interval=interval)
        if df.empty:
            return []
        return [
            {"time": idx.strftime("%Y-%m-%d"), "value": round(float(row["Close"]), 2)}
            for idx, row in df.iterrows()
        ]

    return _cached(f"hist:{ticker}:{period}:{interval}", ttl, fetch)


def get_forecast(ticker: str, ttl: float = 3600.0) -> Dict[str, Any]:
    """Analyst consensus + forward multiples. Fields are None where Yahoo
    has no coverage (common for non-US listings)."""

    def fetch() -> Dict[str, Any]:
        try:
            info = yf.Ticker(ticker).info or {}
        except Exception:
            info = {}

        def g(key: str) -> Optional[Any]:
            v = info.get(key)
            return v if isinstance(v, (int, float, str)) else None

        return {
            "ticker": ticker,
            "current_price": g("currentPrice") or g("regularMarketPrice"),
            "target_mean": g("targetMeanPrice"),
            "target_high": g("targetHighPrice"),
            "target_low": g("targetLowPrice"),
            "analyst_count": g("numberOfAnalystOpinions"),
            "recommendation": g("recommendationKey"),
            "forward_pe": g("forwardPE"),
            "trailing_pe": g("trailingPE"),
            "forward_eps": g("forwardEps"),
            "revenue_growth": g("revenueGrowth"),
            "earnings_growth": g("earningsGrowth"),
            "ev_to_ebitda": g("enterpriseToEbitda"),
        }

    return _cached(f"fcst:{ticker}", ttl, fetch)
