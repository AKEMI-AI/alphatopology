from scripts import ingest_metrics


def test_partial_fmp_response_falls_back_per_ticker(monkeypatch) -> None:
    monkeypatch.setattr(ingest_metrics, "FMP_API_KEY", "test-key")
    monkeypatch.setattr(
        ingest_metrics,
        "fetch_fmp_quotes",
        lambda tickers: {
            "AAA": {"symbol": "AAA", "price": 10.0, "change": 1.0}
        },
    )

    requested_from_yahoo = []

    def fake_yahoo(tickers):
        requested_from_yahoo.extend(tickers)
        return {"BBB": {"symbol": "BBB", "price": 20.0, "change": -1.0}}

    monkeypatch.setattr(ingest_metrics, "fetch_yfinance_quotes", fake_yahoo)

    quotes, providers = ingest_metrics.fetch_live_quotes(["AAA", "BBB"])

    assert requested_from_yahoo == ["BBB"]
    assert set(quotes) == {"AAA", "BBB"}
    assert providers == {"AAA": "FMP", "BBB": "yfinance"}
