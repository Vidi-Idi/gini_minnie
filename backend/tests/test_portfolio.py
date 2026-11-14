import pytest
from fastapi.testclient import TestClient

from app.analytics.weights import respects_locks, summarize
from app.main import app
from app.models import Holding, Portfolio

client = TestClient(app)


def make(*items: tuple[str, float, bool]) -> Portfolio:
    return Portfolio(holdings=[Holding(ticker=t, amount_usd=a, locked=lk) for t, a, lk in items])


def test_health():
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert isinstance(body["allowed_origins"], list)


@pytest.mark.parametrize(
    "raw, expected",
    [
        ("https://a.vercel.app", ["https://a.vercel.app"]),
        ("https://a.vercel.app/", ["https://a.vercel.app"]),
        (' "https://A.vercel.app/path" ', ["https://a.vercel.app"]),
        ("a.vercel.app", ["https://a.vercel.app"]),
        (
            "http://localhost:3000, https://b.vercel.app/",
            ["http://localhost:3000", "https://b.vercel.app"],
        ),
        ("", []),
    ],
)
def test_cors_origins_are_normalized(raw, expected):
    from app.config import Settings

    assert Settings(cors_origins=raw).cors_origin_list == expected


def test_summary_weights_from_dollars():
    s = summarize(make(("aapl", 3000, True), ("SPY", 1000, False)))
    assert s.total_usd == 4000
    assert [h.ticker for h in s.holdings] == ["AAPL", "SPY"]
    assert s.holdings[0].weight == pytest.approx(0.75)
    assert s.locked_weight == pytest.approx(0.75)
    assert sum(h.weight for h in s.holdings) == pytest.approx(1.0)


def test_summary_endpoint():
    r = client.post(
        "/api/portfolio/summary",
        json={
            "holdings": [
                {"ticker": "msft", "amount_usd": 500},
                {"ticker": "QQQ", "amount_usd": 1500},
            ]
        },
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total_usd"] == 2000
    assert body["holdings"][0]["ticker"] == "QQQ"


@pytest.mark.parametrize(
    "payload",
    [
        {"holdings": []},
        {"holdings": [{"ticker": "AAPL", "amount_usd": 0}]},
        {"holdings": [{"ticker": "AAPL", "amount_usd": 1}, {"ticker": "aapl", "amount_usd": 2}]},
    ],
)
def test_summary_rejects_invalid(payload):
    assert client.post("/api/portfolio/summary", json=payload).status_code == 422


def test_locks_never_sold():
    before = make(("AAPL", 1000, True), ("MSFT", 1000, False))
    assert respects_locks(before, make(("AAPL", 1200, True)))
    assert respects_locks(before, make(("AAPL", 1000, True), ("NVDA", 1000, False)))
    assert not respects_locks(before, make(("AAPL", 900, True), ("MSFT", 1100, False)))
    assert not respects_locks(before, make(("MSFT", 2000, False)))
