from datetime import date, timedelta

import pandas as pd

from app.data.cache import Cache
from app.data.models import TickerError, TickerProfile
from app.data.provider import MarketDataProvider

PROFILE_TTL = 7 * 24 * 3600
PRICES_TTL = 6 * 3600
ERROR_TTL = 24 * 3600


class MarketData:
    """Provider wrapper that adds caching. The rest of the app talks to this."""

    def __init__(self, provider: MarketDataProvider, cache: Cache):
        self.provider = provider
        self.cache = cache

    def profile(self, ticker: str) -> TickerProfile:
        key = f"profile:{ticker}"
        cached = self.cache.get(key)
        if cached is not None:
            if "error" in cached:
                raise TickerError(ticker, cached["error"])
            return TickerProfile(**cached)
        try:
            p = self.provider.get_profile(ticker)
        except TickerError as e:
            self.cache.set(key, {"error": e.message}, ERROR_TTL)
            raise
        self.cache.set(key, p.model_dump(), PROFILE_TTL)
        return p

    def prices_1y(self, tickers: list[str], as_of: date | None = None) -> pd.DataFrame:
        """About one year of daily prices (plus a buffer for YTD and 1Y returns)."""
        end = as_of or date.today()
        start = end - timedelta(days=372)
        frames: dict[str, pd.Series] = {}
        missing: list[str] = []
        for t in tickers:
            cached = self.cache.get(f"prices:{t}:{end.isoformat()}")
            if cached is None:
                missing.append(t)
            else:
                frames[t] = pd.Series(cached["v"], index=pd.to_datetime(cached["d"]), name=t)
        if missing:
            fetched = self.provider.get_prices(missing, start, end)
            for t in missing:
                s = fetched[t].dropna() if t in fetched else pd.Series(dtype=float)
                frames[t] = s
                self.cache.set(
                    f"prices:{t}:{end.isoformat()}",
                    {"d": [d.strftime("%Y-%m-%d") for d in s.index], "v": s.tolist()},
                    PRICES_TTL,
                )
        return pd.DataFrame(frames).sort_index().reindex(columns=tickers)
