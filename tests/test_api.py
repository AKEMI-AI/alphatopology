from fastapi.testclient import TestClient

import api.main as api_main

client = TestClient(api_main.app)


def test_topology_contract() -> None:
    response = client.get("/topology")
    assert response.status_code == 200
    payload = response.json()
    assert payload["nodes"]
    assert payload["edges"]


def test_fixture_source_survives_api_boundary(monkeypatch) -> None:
    monkeypatch.setattr(api_main, "get_quotes", lambda tickers: {})
    response = client.get("/market/telemetry")

    assert response.status_code == 200
    payload = response.json()
    assert payload["metadata"]["physical_telemetry_source"] == "FIXTURE_ESTIMATE"
    assert all(
        node["telemetry"]["data_source"] == "FIXTURE_ESTIMATE"
        for node in payload["nodes"]
    )
