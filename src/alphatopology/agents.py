"""AlphaTopology: Autonomous Multi-Agent Research Pipeline.

Four-agent loop over the physical supply graph. This module generates research
signals (MacroSignal) and a daily report — it does NOT place orders or connect
to any brokerage; execution is intentionally out of scope.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional

import networkx as nx

from .models import MacroSignal, ValueChainNode
from .topology import (
    build_graph,
    days_to_quarter_lag,
    downstream_lags,
    load_topology,
)

FIXTURES = Path(__file__).resolve().parents[2] / "data" / "fixtures"


class IngestionAgent:
    """Agent 1: Ingests quarterly 10-Qs, Taiwan MoEA monthly export data,
    and WFE book-to-bill metrics.

    Until EDGAR / MoEA scrapers are wired in, reads deterministic local
    fixtures from data/fixtures/<TICKER>.json so the rest of the pipeline
    is testable offline.
    """

    def __init__(self, fixtures: Path = FIXTURES):
        self.fixtures = fixtures

    def fetch_filing_signals(self, ticker: str) -> Dict[str, float]:
        fixture = self.fixtures / f"{ticker}.json"
        if fixture.exists():
            return {k: float(v) for k, v in json.loads(fixture.read_text()).items()}
        # TODO: EDGAR full-text + XBRL via sec-api / edgartools; MoEA export CSVs.
        return {}


class TransmissionLagAgent:
    """Agent 2: Models delay propagation across physical graph edges.

    Example: TSMC CoWoS capacity additions dictate Foxconn ODM server
    deliveries with an empirical 120-day lag.
    """

    def __init__(self, graph: Optional[nx.DiGraph] = None):
        self.g = graph if graph is not None else build_graph(load_topology())

    def evaluate_edge_shock(
        self, upstream_node: str, downstream_node: str, capacity_change_pct: float
    ) -> MacroSignal:
        lags = downstream_lags(self.g, upstream_node)
        if downstream_node not in lags:
            raise ValueError(
                f"{downstream_node} is not downstream of {upstream_node} in the graph"
            )
        lag_days = lags[downstream_node]
        hops = nx.shortest_path_length(self.g, upstream_node, downstream_node)
        # Confidence decays with graph distance; boosted by upstream chokepoint power.
        choke = self.g.nodes[upstream_node]["chokepoint_rating"]
        confidence = round(max(0.05, choke * (0.85 ** (hops - 1))), 3)
        direction = "LONG" if capacity_change_pct > 0 else "SHORT"
        return MacroSignal(
            source_ticker=self.g.nodes[upstream_node]["ticker"],
            target_ticker=self.g.nodes[downstream_node]["ticker"],
            metric="capacity_change_pct",
            observed_delta=capacity_change_pct,
            confidence=confidence,
            transmission_lag_days=lag_days,
            signal_type=direction if abs(capacity_change_pct) >= 2.0 else "NEUTRAL",
            rationale=(
                f"{upstream_node} capacity shift of {capacity_change_pct:+.1f}% propagates "
                f"{hops} hop(s) to {downstream_node} with ~{lag_days}d physical lag "
                f"(Q_lag={days_to_quarter_lag(lag_days)}); upstream chokepoint {choke:.2f}."
            ),
        )


class DislocationArbitrageAgent:
    """Agent 3: Identifies multiple dislocations between high-margin
    monopolies (e.g., KLAC, ASML, Disco) and downstream multiples."""

    # PEG-style spread beyond which the pair is considered dislocated.
    DISLOCATION_THRESHOLD = 0.5

    def generate_pairs_trade(
        self, upstream: ValueChainNode, downstream: ValueChainNode
    ) -> MacroSignal:
        def growth_adjusted_multiple(n: ValueChainNode) -> float:
            growth = max(n.forward_revenue_growth, 0.01)
            return n.current_pe_ratio / (growth * 100.0)

        up_m = growth_adjusted_multiple(upstream)
        down_m = growth_adjusted_multiple(downstream)
        spread = down_m - up_m  # >0: downstream rich relative to upstream monopoly
        dislocated = abs(spread) >= self.DISLOCATION_THRESHOLD
        confidence = round(
            min(0.95, upstream.chokepoint_score * min(abs(spread), 2.0) / 2.0), 3
        )
        return MacroSignal(
            source_ticker=upstream.ticker,
            target_ticker=downstream.ticker,
            metric="growth_adjusted_pe_spread",
            observed_delta=round(spread, 3),
            confidence=confidence if dislocated else 0.1,
            transmission_lag_days=0,
            signal_type="PAIRS_SPREAD" if dislocated else "NEUTRAL",
            rationale=(
                f"Growth-adjusted multiples: {upstream.ticker}={up_m:.2f} vs "
                f"{downstream.ticker}={down_m:.2f} (spread {spread:+.2f}); "
                f"upstream chokepoint {upstream.chokepoint_score:.2f}. "
                + ("Dislocation exceeds threshold." if dislocated else "Within normal band.")
            ),
        )


class Orchestrator:
    """Agent 4: Synthesizes signals across the graph into the Living Report.

    Output is research only — MacroSignal objects and a JSON report.
    No trade execution: order routing is deliberately not implemented.
    """

    def __init__(
        self,
        graph: Optional[nx.DiGraph] = None,
        ingestion: Optional[IngestionAgent] = None,
    ):
        self.g = graph if graph is not None else build_graph(load_topology())
        self.ingestion = ingestion if ingestion is not None else IngestionAgent()
        self.transmission = TransmissionLagAgent(self.g)
        self.arbitrage = DislocationArbitrageAgent()

    def run_daily_cycle(self) -> List[MacroSignal]:
        signals: List[MacroSignal] = []
        # Propagate observed capacity shocks from chokepoint nodes. Missing data
        # produces no signal rather than a fabricated neutral observation.
        for node_id, attrs in self.g.nodes(data=True):
            if attrs["chokepoint_rating"] < 0.95:
                continue
            observed = self.ingestion.fetch_filing_signals(attrs["ticker"])
            capacity_change_pct = observed.get("capacity_change_pct")
            if capacity_change_pct is None:
                continue
            for downstream in nx.descendants(self.g, node_id):
                sig = self.transmission.evaluate_edge_shock(
                    node_id, downstream, capacity_change_pct
                )
                if sig.signal_type != "NEUTRAL":
                    signals.append(sig)
        return signals

    def write_report(self, signals: List[MacroSignal], out: Path) -> None:
        out.write_text(
            json.dumps([s.model_dump() for s in signals], indent=2) + "\n"
        )
