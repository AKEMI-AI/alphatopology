"""Paper-trading simulator: a positions ledger marked to live quotes.

Simulation only — fills happen at the current (delayed) Yahoo quote against
virtual cash. No brokerage connection exists or is planned in this module.
"""

from __future__ import annotations

import sqlite3
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from .market import get_quotes

DB_PATH = Path(__file__).resolve().parents[2] / "data" / "portfolio.db"
STARTING_CASH = 1_000_000.0  # paper dollars


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.execute(
        """CREATE TABLE IF NOT EXISTS trades (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts REAL NOT NULL,
            ticker TEXT NOT NULL,
            side TEXT NOT NULL CHECK (side IN ('BUY','SELL')),
            qty REAL NOT NULL CHECK (qty > 0),
            price REAL NOT NULL,
            currency TEXT
        )"""
    )
    return conn


def place_paper_order(ticker: str, side: str, qty: float) -> Dict[str, Any]:
    """Fill a paper order at the live quote. Raises ValueError on bad input."""
    side = side.upper()
    if side not in ("BUY", "SELL"):
        raise ValueError("side must be BUY or SELL")
    if qty <= 0:
        raise ValueError("qty must be positive")

    quote = get_quotes([ticker]).get(ticker)
    if not quote or quote.get("price") is None:
        raise ValueError(f"No live quote for '{ticker}'")
    price = float(quote["price"])

    with _conn() as conn:
        if side == "SELL":
            held = conn.execute(
                "SELECT COALESCE(SUM(CASE side WHEN 'BUY' THEN qty ELSE -qty END),0)"
                " FROM trades WHERE ticker = ?",
                (ticker,),
            ).fetchone()[0]
            if qty > held + 1e-9:
                raise ValueError(f"Cannot sell {qty}; only {held} held (paper account)")
        conn.execute(
            "INSERT INTO trades (ts, ticker, side, qty, price, currency) VALUES (?,?,?,?,?,?)",
            (time.time(), ticker, side, qty, price, quote.get("currency")),
        )

    return {
        "status": "FILLED_PAPER",
        "ticker": ticker,
        "side": side,
        "qty": qty,
        "fill_price": price,
        "currency": quote.get("currency"),
        "note": "Simulated fill at delayed quote — no real order was placed.",
    }


def portfolio_status() -> Dict[str, Any]:
    """Positions marked to live quotes, with realized/unrealized P&L per ticker.

    NOTE: cash and P&L are naive same-currency sums — fine while paper trades
    stay in USD names; FX-aware accounting is a TODO for non-USD fills.
    """
    with _conn() as conn:
        rows = conn.execute(
            "SELECT ticker, side, qty, price FROM trades ORDER BY ts"
        ).fetchall()

    lots: Dict[str, Dict[str, float]] = {}
    cash = STARTING_CASH
    for ticker, side, qty, price in rows:
        lot = lots.setdefault(ticker, {"qty": 0.0, "cost": 0.0, "realized": 0.0})
        if side == "BUY":
            lot["cost"] += qty * price
            lot["qty"] += qty
            cash -= qty * price
        else:
            avg = lot["cost"] / lot["qty"] if lot["qty"] else 0.0
            lot["realized"] += qty * (price - avg)
            lot["cost"] -= qty * avg
            lot["qty"] -= qty
            cash += qty * price

    open_tickers = [t for t, l in lots.items() if l["qty"] > 1e-9]
    quotes = get_quotes(open_tickers) if open_tickers else {}

    positions: List[Dict[str, Any]] = []
    unrealized_total = 0.0
    for ticker, lot in lots.items():
        if lot["qty"] <= 1e-9 and abs(lot["realized"]) < 1e-9:
            continue
        mark: Optional[float] = (quotes.get(ticker) or {}).get("price")
        avg = lot["cost"] / lot["qty"] if lot["qty"] > 1e-9 else 0.0
        unrealized = (mark - avg) * lot["qty"] if mark is not None and lot["qty"] > 1e-9 else None
        if unrealized is not None:
            unrealized_total += unrealized
        positions.append(
            {
                "ticker": ticker,
                "qty": round(lot["qty"], 4),
                "avg_cost": round(avg, 2) if lot["qty"] > 1e-9 else None,
                "mark": mark,
                "unrealized_pnl": round(unrealized, 2) if unrealized is not None else None,
                "realized_pnl": round(lot["realized"], 2),
            }
        )

    return {
        "paper_account": True,
        "starting_cash": STARTING_CASH,
        "cash": round(cash, 2),
        "positions": sorted(positions, key=lambda p: p["ticker"]),
        "unrealized_pnl_total": round(unrealized_total, 2),
        "trade_count": len(rows),
    }
