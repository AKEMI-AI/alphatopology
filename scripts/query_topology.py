#!/usr/bin/env python3
"""Query the AlphaTopology supply-chain graph.

Usage:
  python scripts/query_topology.py --upstream NVDA
  python scripts/query_topology.py --chokepoints [--threshold 0.95]
  python scripts/query_topology.py --lead-time
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from alphatopology.topology import (  # noqa: E402
    build_graph,
    chokepoints,
    critical_path,
    load_topology,
    resolve_ticker,
    upstream_dependencies,
)


def main() -> int:
    ap = argparse.ArgumentParser(description="AlphaTopology graph queries")
    ap.add_argument("--upstream", metavar="TICKER", help="trace transitive suppliers of a ticker/id")
    ap.add_argument("--chokepoints", action="store_true", help="list single-point-failure bottlenecks")
    ap.add_argument("--threshold", type=float, default=0.95, help="chokepoint rating cutoff")
    ap.add_argument("--lead-time", action="store_true", help="longest cumulative lead-time path")
    args = ap.parse_args()

    g = build_graph(load_topology())

    if args.upstream:
        node_id = resolve_ticker(g, args.upstream)
        rows = upstream_dependencies(g, node_id)
        print(f"Upstream dependencies of {g.nodes[node_id]['name']} ({g.nodes[node_id]['ticker']}):")
        if not rows:
            print("  (none — this node is a graph source)")
        for r in rows:
            print(
                f"  {r['ticker']:<10} {r['name']:<24} {r['stage']:<28} "
                f"choke={r['chokepoint_rating']:.2f}  "
                f"worst-case lead={r['worst_case_lead_days']}d (Q_lag={r['quarter_lag']})"
            )

    if args.chokepoints:
        hits = chokepoints(g, args.threshold)
        print(f"Chokepoints (rating >= {args.threshold}):")
        for n in hits:
            print(f"  {n.ticker:<10} {n.name:<24} {n.stage:<28} rating={n.chokepoint_rating:.2f} [{n.basket}]")

    if args.lead_time:
        path, days = critical_path(g)
        names = " -> ".join(g.nodes[p]["ticker"] for p in path)
        print(f"Critical path (longest cumulative physical lead time): {days} days (~{days/91:.1f} quarters)")
        print(f"  {names}")

    if not (args.upstream or args.chokepoints or args.lead_time):
        ap.print_help()
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
