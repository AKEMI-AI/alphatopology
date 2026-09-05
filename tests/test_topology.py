import json
from pathlib import Path

import networkx as nx
import pytest
from jsonschema import Draft7Validator

from alphatopology.models import SupplyChainTopology, TopologyEdge
from alphatopology.topology import (
    build_graph,
    days_to_quarter_lag,
    load_topology,
)

ROOT = Path(__file__).resolve().parents[1]


def test_seed_validates_against_json_schema() -> None:
    schema = json.loads((ROOT / "data" / "topology_schema.json").read_text())
    seed = json.loads((ROOT / "data" / "nodes_seed.json").read_text())
    Draft7Validator(schema).validate(seed)


def test_seed_builds_a_dag_with_unique_ids() -> None:
    topology = load_topology()
    graph = build_graph(topology)
    assert nx.is_directed_acyclic_graph(graph)
    assert len(graph) == len(topology.nodes)
    assert len({node.id for node in topology.nodes}) == len(topology.nodes)


def test_duplicate_node_ids_are_rejected(tmp_path: Path) -> None:
    seed = json.loads((ROOT / "data" / "nodes_seed.json").read_text())
    seed["nodes"].append(dict(seed["nodes"][0]))
    duplicate_seed = tmp_path / "duplicate.json"
    duplicate_seed.write_text(json.dumps(seed))

    with pytest.raises(ValueError, match="Duplicate node ids"):
        load_topology(duplicate_seed)


def test_cycle_is_rejected() -> None:
    topology = load_topology()
    cyclic = SupplyChainTopology(
        nodes=topology.nodes,
        edges=[
            *topology.edges,
            TopologyEdge(
                source="FOXCONN",
                target="ASML",
                relationship="invalid reverse dependency",
                lead_time_days=1,
                criticality="CRITICAL",
            ),
        ],
    )

    with pytest.raises(ValueError, match="directed acyclic graph"):
        build_graph(cyclic)


@pytest.mark.parametrize(
    ("days", "expected"),
    [(0, 1), (91, 1), (182, 2), (365, 4), (999, 4)],
)
def test_quarter_lag_is_clamped(days: int, expected: int) -> None:
    assert days_to_quarter_lag(days) == expected
