"""Graph engine: load the supply-chain topology into a NetworkX DiGraph and query it.

Physical Reality Rule: edges carry lead_time_days; propagation queries accumulate
physical lead times rather than assuming instantaneous transmission.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import networkx as nx

from .models import SupplyChainTopology, TopologyNode

DEFAULT_SEED = Path(__file__).resolve().parents[2] / "data" / "nodes_seed.json"

# Quarter-lag bounds from the Physical Reality Rule: Q_lag in [1, 4].
DAYS_PER_QUARTER = 91
Q_LAG_MIN, Q_LAG_MAX = 1, 4


def load_topology(path: Path = DEFAULT_SEED) -> SupplyChainTopology:
    """Load and schema-validate the topology JSON via Pydantic."""
    topo = SupplyChainTopology.model_validate(json.loads(path.read_text()))
    node_ids = {n.id for n in topo.nodes}
    if len(node_ids) != len(topo.nodes):
        duplicates = sorted(
            node_id
            for node_id in node_ids
            if sum(node.id == node_id for node in topo.nodes) > 1
        )
        raise ValueError(f"Duplicate node ids: {duplicates}")
    dangling = [
        (e.source, e.target)
        for e in topo.edges
        if e.source not in node_ids or e.target not in node_ids
    ]
    if dangling:
        raise ValueError(f"Edges reference unknown node ids: {dangling}")
    return topo


def build_graph(topo: SupplyChainTopology) -> nx.DiGraph:
    g = nx.DiGraph()
    for n in topo.nodes:
        g.add_node(n.id, **n.model_dump())
    for e in topo.edges:
        g.add_edge(e.source, e.target, **e.model_dump())
    if not nx.is_directed_acyclic_graph(g):
        raise ValueError("Supply-chain topology must be a directed acyclic graph")
    return g


def resolve_ticker(g: nx.DiGraph, query: str) -> str:
    """Accept either a node id (NVIDIA) or a ticker (NVDA / 4063.T)."""
    q = query.upper()
    if q in g.nodes:
        return q
    for node_id, attrs in g.nodes(data=True):
        if attrs["ticker"].upper() == q:
            return node_id
    raise KeyError(f"No node with id or ticker '{query}'")


def upstream_dependencies(g: nx.DiGraph, node_id: str) -> List[Dict]:
    """All transitive suppliers of node_id, with cumulative lead time along the
    longest (worst-case) path from each supplier down to node_id."""
    ancestors = nx.ancestors(g, node_id)
    rows = []
    for anc in ancestors:
        worst_days = max(
            sum(g.edges[u, v]["lead_time_days"] for u, v in zip(p, p[1:]))
            for p in nx.all_simple_paths(g, anc, node_id)
        )
        rows.append(
            {
                "id": anc,
                "name": g.nodes[anc]["name"],
                "ticker": g.nodes[anc]["ticker"],
                "stage": g.nodes[anc]["stage"],
                "basket": g.nodes[anc]["basket"],
                "chokepoint_rating": g.nodes[anc]["chokepoint_rating"],
                "worst_case_lead_days": worst_days,
                "quarter_lag": days_to_quarter_lag(worst_days),
            }
        )
    rows.sort(key=lambda r: r["worst_case_lead_days"], reverse=True)
    return rows


def chokepoints(g: nx.DiGraph, threshold: float = 0.95) -> List[TopologyNode]:
    """Single-point-of-failure candidates: chokepoint_rating >= threshold."""
    hits = [
        TopologyNode(**attrs)
        for _, attrs in g.nodes(data=True)
        if attrs["chokepoint_rating"] >= threshold
    ]
    hits.sort(key=lambda n: n.chokepoint_rating, reverse=True)
    return hits


def critical_path(g: nx.DiGraph) -> Tuple[List[str], int]:
    """Longest cumulative lead-time path across the DAG — the physical
    'raw silicon to deployment' constraint. Raises if the graph has cycles."""
    path = nx.dag_longest_path(g, weight="lead_time_days")
    days = nx.dag_longest_path_length(g, weight="lead_time_days")
    return path, days


def days_to_quarter_lag(days: int) -> int:
    """Convert physical days into a quarter lag, clamped to [1, 4]."""
    q = max(1, round(days / DAYS_PER_QUARTER))
    return min(max(q, Q_LAG_MIN), Q_LAG_MAX)


def downstream_lags(g: nx.DiGraph, node_id: str) -> Dict[str, int]:
    """Shortest-lead-time transmission lag (days) from node_id to every
    reachable downstream node — the earliest a shock can arrive."""
    return nx.single_source_dijkstra_path_length(g, node_id, weight="lead_time_days")
