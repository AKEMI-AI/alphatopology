import json
from pathlib import Path

from alphatopology.agents import IngestionAgent, Orchestrator


def test_daily_cycle_uses_observed_capacity_shock(tmp_path: Path) -> None:
    (tmp_path / "TSM.json").write_text(json.dumps({"capacity_change_pct": 5.0}))
    orchestrator = Orchestrator(ingestion=IngestionAgent(tmp_path))

    signals = orchestrator.run_daily_cycle()

    assert signals
    assert {signal.source_ticker for signal in signals} == {"TSM"}
    assert {signal.signal_type for signal in signals} == {"LONG"}
    assert {signal.observed_delta for signal in signals} == {5.0}


def test_daily_cycle_does_not_invent_missing_observations(tmp_path: Path) -> None:
    orchestrator = Orchestrator(ingestion=IngestionAgent(tmp_path))
    assert orchestrator.run_daily_cycle() == []


def test_subthreshold_shock_is_not_published(tmp_path: Path) -> None:
    (tmp_path / "TSM.json").write_text(json.dumps({"capacity_change_pct": 1.5}))
    orchestrator = Orchestrator(ingestion=IngestionAgent(tmp_path))
    assert orchestrator.run_daily_cycle() == []
