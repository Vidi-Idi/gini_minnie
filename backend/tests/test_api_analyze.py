import pytest

HOLDINGS = [
    {"ticker": "aaa", "amount_usd": 6000, "locked": True},
    {"ticker": "BBB", "amount_usd": 3000},
    {"ticker": "ETF1", "amount_usd": 1000},
]


def test_analyze_happy_path(client):
    r = client.post("/api/portfolio/analyze", json={"holdings": HOLDINGS, "benchmark": "spy"})
    assert r.status_code == 200, r.text
    b = r.json()
    assert b["benchmark"] == "SPY"
    assert b["kpis"]["total_usd"] == 10000
    assert b["kpis"]["holdings_count"] == 3
    assert [h["ticker"] for h in b["holdings"]] == ["AAA", "BBB", "ETF1"]
    assert b["holdings"][0]["locked"] is True
    assert sum(h["risk_contribution"] for h in b["holdings"]) == pytest.approx(1.0)
    assert sum(s["weight"] for s in b["sectors"]) == pytest.approx(1.0)
    assert {s["label"] for s in b["asset_types"]} == {"Stocks", "ETFs"}
    assert b["correlation"]["AAA"]["AAA"] == pytest.approx(1.0)
    # Harmonic weighted P/E over stocks: (0.6+0.3) / (0.6/20 + 0.3/10) = 15
    assert b["kpis"]["pe_ratio"] == pytest.approx(15.0)
    assert b["kpis"]["dividend_yield"] == pytest.approx(0.6 * 0.01 + 0.3 * 0.04 + 0.1 * 0.015)


def test_analyze_reports_bad_tickers(client):
    r = client.post(
        "/api/portfolio/analyze",
        json={
            "holdings": [{"ticker": "AAA", "amount_usd": 1}, {"ticker": "NOPE", "amount_usd": 1}]
        },
    )
    assert r.status_code == 422
    assert r.json()["detail"]["ticker_errors"] == {"NOPE": "NOPE: ticker not found"}


def test_prices_are_cached(client, provider):
    for _ in range(2):
        client.post("/api/portfolio/analyze", json={"holdings": HOLDINGS})
    assert provider.price_calls == 1


def test_ticker_endpoint(client):
    assert client.get("/api/tickers/aaa").json()["name"] == "Alpha Corp"
    assert client.get("/api/tickers/NOPE").status_code == 404
