from datetime import date
from typing import Protocol

import pandas as pd

from app.data.models import TickerProfile


class MarketDataProvider(Protocol):
    """Source of market data. Swap the implementation to change vendors."""

    def get_profile(self, ticker: str) -> TickerProfile:
        """Profile of one ticker. Raises TickerError if it is not usable."""
        ...

    def get_prices(self, tickers: list[str], start: date, end: date) -> pd.DataFrame:
        """Daily adjusted close prices. Index: dates. Columns: tickers. Missing = NaN."""
        ...
