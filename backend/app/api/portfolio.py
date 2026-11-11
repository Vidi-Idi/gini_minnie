from fastapi import APIRouter

from app.analytics.weights import summarize
from app.models import Portfolio, PortfolioSummary

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


@router.post("/summary", response_model=PortfolioSummary)
def portfolio_summary(portfolio: Portfolio) -> PortfolioSummary:
    """Total value and weights computed from the dollar amounts entered."""
    return summarize(portfolio)
