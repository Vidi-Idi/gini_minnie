from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException

from app.data.models import TickerError, TickerProfile
from app.data.service import MarketData
from app.deps import get_market_data
from app.models import normalize_ticker

router = APIRouter(prefix="/api/tickers", tags=["tickers"])


@router.get("/{symbol}", response_model=TickerProfile)
def ticker_profile(symbol: str, md: Annotated[MarketData, Depends(get_market_data)]):
    """Validate a ticker (NYSE/NASDAQ stock or ETF) and return its profile."""
    try:
        return md.profile(normalize_ticker(symbol))
    except TickerError as e:
        raise HTTPException(status_code=404, detail=e.message) from e
