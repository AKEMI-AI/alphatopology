"""Physical supply-chain telemetry fixtures.

These values are research placeholders until licensed industry feeds are wired
in. Every returned record carries an explicit source label so fixture data can
never be mistaken for live telemetry.
"""

from __future__ import annotations

from typing import Dict

FIXTURE_SOURCE = "FIXTURE_ESTIMATE"

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

DEFAULT_PROXY: Dict[str, str] = {
    "metric": "Operational Throughput",
    "value": "Normal Run-rate",
    "status": "BALANCED",
    "lead_time_trend": "STABLE",
}


def get_physical_proxy(ticker: str) -> Dict[str, str]:
    """Return a copy of a proxy record with an unavoidable fixture label."""
    proxy = PHYSICAL_PROXIES.get(ticker, DEFAULT_PROXY)
    return {**proxy, "data_source": FIXTURE_SOURCE}
