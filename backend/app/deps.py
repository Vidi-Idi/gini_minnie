from functools import lru_cache

from app.config import get_settings
from app.data.cache import Cache
from app.data.service import MarketData
from app.data.yahoo import YahooProvider


@lru_cache
def get_market_data() -> MarketData:
    return MarketData(YahooProvider(), Cache(get_settings().cache_path))
