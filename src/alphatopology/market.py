"""Live market data layer: quotes, price history, and analyst forecasts.

Free yfinance backend with in-process TTL caching. All lookups degrade to
None fields rather than raising (Graceful Failures rule) — non-US tickers
often lack analyst coverage fields.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union

import yfinance as yf

_CACHE: Dict[str, Any] = {}
_CACHE_MAX_ENTRIES = 512


def _cached(key: str, ttl: float, fn):
    now = time.time()
    hit = _CACHE.get(key)
    if hit and hit[0] > now:
        return hit[1]
    value = fn()
    if key not in _CACHE and len(_CACHE) >= _CACHE_MAX_ENTRIES:
        expired = [cache_key for cache_key, (expires, _) in _CACHE.items() if expires <= now]
        for cache_key in expired:
            _CACHE.pop(cache_key, None)
        if len(_CACHE) >= _CACHE_MAX_ENTRIES:
            oldest = min(_CACHE, key=lambda cache_key: _CACHE[cache_key][0])
            _CACHE.pop(oldest, None)
    _CACHE[key] = (now + ttl, value)
    return value


def _history_time(index: Any, interval: str) -> Union[str, int]:
    """Use business-day strings for daily bars and Unix seconds intraday."""
    intraday = interval.endswith("m") and not interval.endswith("mo")
    intraday = intraday or interval.endswith("h")
    return int(index.timestamp()) if intraday else index.strftime("%Y-%m-%d")


def get_quotes(tickers: List[str], ttl: float = 60.0) -> Dict[str, Dict[str, Any]]:
    """Latest price/change/volume per ticker (Yahoo feed, exchange-delayed)."""

    def fetch() -> Dict[str, Dict[str, Any]]:
        quotes: Dict[str, Dict[str, Any]] = {}
        as_of = datetime.now(timezone.utc).isoformat()
        for t in yf.Tickers(" ".join(tickers)).tickers.values():
            try:
                fi = t.fast_info
                price = fi["last_price"]
                prev = fi["previous_close"]
                quotes[t.ticker] = {
                    "price": round(float(price), 2),
                    "change_pct": round((price / prev - 1.0) * 100.0, 2) if prev else 0.0,
                    "volume": int(fi["last_volume"] or 0),
                    "currency": fi["currency"],
                    "live": True,
                    "provider": "yfinance",
                    "as_of": as_of,
                }
            except Exception:
                quotes[t.ticker] = {
                    "price": None, "change_pct": None, "volume": None,
                    "currency": None, "live": False, "provider": "yfinance",
                    "as_of": as_of,
                }
        return quotes

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
            {
                "time": _history_time(idx, interval),
                "value": round(float(row["Close"]), 2),
            }
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
            "provider": "yfinance",
            "as_of": datetime.now(timezone.utc).isoformat(),
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
