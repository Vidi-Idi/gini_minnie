from pydantic import BaseModel

from app.data.models import TickerProfile
from app.models import Holding


class AnalyzeRequest(BaseModel):
    holdings: list[Holding]
    benchmark: str = "SPY"


class Kpis(BaseModel):
    total_usd: float
    return_1d: float | None
    return_1m: float | None
    return_3m: float | None
    return_ytd: float | None
    return_1y: float | None
    benchmark_return_1y: float | None
    annual_volatility: float
    sharpe: float | None
    sortino: float | None
    max_drawdown: float  # negative fraction, e.g. -0.18
    beta: float | None
    correlation_to_benchmark: float | None
    dividend_yield: float | None
    pe_ratio: float | None  # weighted harmonic mean over stocks with positive P/E
    holdings_count: int
    effective_holdings: float  # 1 / sum(w^2)


class HoldingDetail(BaseModel):
    ticker: str
    name: str
    quote_type: str
    exchange: str
    sector: str | None
    amount_usd: float
    weight: float
    locked: bool
    return_1y: float | None
    annual_volatility: float | None
    contribution_to_return: float | None  # weight x return over the window
    risk_contribution: float | None  # share of portfolio variance (adds up to 1)


class Series(BaseModel):
    dates: list[str]
    portfolio: list[float]  # growth of 100
    benchmark: list[float]  # growth of 100
    drawdown: list[float]  # 0 or negative fraction


class Slice(BaseModel):
    label: str
    weight: float


class AnalyzeResponse(BaseModel):
    benchmark: str
    window_start: str
    window_end: str
    kpis: Kpis
    holdings: list[HoldingDetail]
    series: Series
    sectors: list[Slice]
    asset_types: list[Slice]
    market_caps: list[Slice]
    correlation: dict[str, dict[str, float]]
    profiles: dict[str, TickerProfile]
    warnings: list[str]
