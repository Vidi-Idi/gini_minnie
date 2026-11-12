from concurrent.futures import ThreadPoolExecutor
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.analytics.metrics import analyze
from app.analytics.schemas import AnalyzeRequest, AnalyzeResponse
from app.analytics.weights import summarize
from app.config import get_settings
from app.data.models import TickerError, TickerProfile
from app.data.service import MarketData
from app.deps import get_market_data
from app.models import Portfolio, PortfolioSummary, normalize_ticker

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.post("/summary", response_model=PortfolioSummary)
def portfolio_summary(portfolio: Portfolio) -> PortfolioSummary:
    """Total value and weights computed from the dollar amounts entered."""
    return summarize(portfolio)


@router.post("/analyze", response_model=AnalyzeResponse)
def portfolio_analyze(
    req: AnalyzeRequest, md: Annotated[MarketData, Depends(get_market_data)]
) -> AnalyzeResponse:
    """KPIs, performance vs benchmark, breakdowns and correlations over the last year."""
    portfolio = Portfolio(holdings=req.holdings)  # re-validates (duplicates etc.)
    benchmark = normalize_ticker(req.benchmark)
    symbols = list(dict.fromkeys([h.ticker for h in portfolio.holdings] + [benchmark]))

    profiles: dict[str, TickerProfile] = {}
    errors: dict[str, str] = {}

    def load(sym: str):
        try:
            profiles[sym] = md.profile(sym)
        except TickerError as e:
            errors[sym] = e.message

    with ThreadPoolExecutor(max_workers=8) as pool:
        list(pool.map(load, symbols))
    if errors:
        raise HTTPException(status_code=422, detail={"ticker_errors": errors})

    prices = md.prices_1y(symbols)
    try:
        return analyze(
            summarize(portfolio), prices, profiles, benchmark, get_settings().risk_free_rate
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail={"message": str(e)}) from e
