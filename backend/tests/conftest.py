from datetime import date

import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient

from app.data.cache import Cache
from app.data.models import TickerError, TickerProfile
from app.data.service import MarketData
from app.deps import get_market_data
from app.main import app

PROFILES = {
    "AAA": TickerProfile(
        ticker="AAA",
        name="Alpha Corp",
        exchange="NASDAQ",
        quote_type="EQUITY",
        sector="Technology",
        market_cap=500e9,
        pe_ratio=20.0,
        dividend_yield=0.01,
    ),
    "BBB": TickerProfile(
        ticker="BBB",
        name="Beta Inc",
        exchange="NYSE",
        quote_type="EQUITY",
        sector="Energy",
        market_cap=5e9,
        pe_ratio=10.0,
        dividend_yield=0.04,
    ),
    "ETF1": TickerProfile(
        ticker="ETF1",
        name="Some ETF",
        exchange="NYSE Arca",
        quote_type="ETF",
        dividend_yield=0.015,
        etf_sector_weights={"technology": 0.5, "energy": 0.3},
    ),
    "SPY": TickerProfile(ticker="SPY", name="S&P 500 ETF", exchange="NYSE Arca", quote_type="ETF"),
}


class FakeProvider:
    """Deterministic synthetic prices: a seeded random walk per ticker."""

    def __init__(self):
        self.price_calls = 0

    def get_profile(self, ticker: str) -> TickerProfile:
        if ticker not in PROFILES:
            raise TickerError(ticker, f"{ticker}: ticker not found")
        return PROFILES[ticker]

    def get_prices(self, tickers, start: date, end: date) -> pd.DataFrame:
        self.price_calls += 1
        idx = pd.bdate_range(start, end)
        data = {}
        for i, t in enumerate(tickers):
            rng = np.random.default_rng(i + sum(map(ord, t)))
            data[t] = 100 * np.cumprod(1 + rng.normal(0.0005, 0.01, len(idx)))
        return pd.DataFrame(data, index=idx)


@pytest.fixture
def provider():
    return FakeProvider()


@pytest.fixture
def client(provider):
    md = MarketData(provider, Cache(":memory:"))
    app.dependency_overrides[get_market_data] = lambda: md
    yield TestClient(app)
    app.dependency_overrides.clear()
