from pydantic import BaseModel

# Yahoo exchange codes we accept: NYSE, NYSE American, NYSE Arca, and the three NASDAQ tiers.
ALLOWED_EXCHANGES: dict[str, str] = {
    "NYQ": "NYSE",
    "ASE": "NYSE American",
    "PCX": "NYSE Arca",
    "NMS": "NASDAQ",
    "NGM": "NASDAQ",
    "NCM": "NASDAQ",
}
ALLOWED_TYPES = {"EQUITY", "ETF"}


class TickerProfile(BaseModel):
    ticker: str
    name: str
    exchange: str  # display name, e.g. "NYSE" or "NASDAQ"
    quote_type: str  # "EQUITY" or "ETF"
    sector: str | None = None
    industry: str | None = None
    market_cap: float | None = None
    beta: float | None = None
    dividend_yield: float | None = None  # fraction, e.g. 0.019 for 1.9%
    pe_ratio: float | None = None
    # ETF look-through (fractions that add up to about 1)
    etf_sector_weights: dict[str, float] | None = None
    etf_top_holdings: dict[str, float] | None = None


class TickerError(Exception):
    """Ticker missing, not a stock/ETF, or not listed on NYSE or NASDAQ."""

    def __init__(self, ticker: str, message: str):
        super().__init__(message)
        self.ticker = ticker
        self.message = message
