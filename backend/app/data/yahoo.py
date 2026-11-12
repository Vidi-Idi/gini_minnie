import logging
from datetime import date, timedelta

import pandas as pd
import yfinance as yf

from app.data.models import ALLOWED_EXCHANGES, ALLOWED_TYPES, TickerError, TickerProfile

log = logging.getLogger(__name__)


def _pct_to_fraction(v: float | None) -> float | None:
    # yfinance reports dividendYield in percent (1.92 means 1.92%).
    return None if v is None else v / 100


class YahooProvider:
    """Market data from Yahoo Finance via yfinance (free, unofficial)."""

    def get_profile(self, ticker: str) -> TickerProfile:
        t = yf.Ticker(ticker)
        try:
            info = t.info or {}
        except Exception as e:  # yfinance raises many error types for unknown symbols
            raise TickerError(ticker, f"{ticker}: ticker not found") from e

        quote_type = info.get("quoteType")
        exchange_code = info.get("exchange")
        if not quote_type or not info.get("regularMarketPrice") and not info.get("previousClose"):
            raise TickerError(ticker, f"{ticker}: ticker not found")
        if quote_type not in ALLOWED_TYPES:
            raise TickerError(ticker, f"{ticker}: only stocks and ETFs are supported")
        if exchange_code not in ALLOWED_EXCHANGES:
            where = info.get("fullExchangeName") or exchange_code or "an unknown exchange"
            raise TickerError(ticker, f"{ticker}: listed on {where}, not NYSE or NASDAQ")

        profile = TickerProfile(
            ticker=ticker,
            name=info.get("longName") or info.get("shortName") or ticker,
            exchange=ALLOWED_EXCHANGES[exchange_code],
            quote_type=quote_type,
            sector=info.get("sector"),
            industry=info.get("industry"),
            market_cap=info.get("marketCap"),
            beta=info.get("beta"),
            dividend_yield=_pct_to_fraction(info.get("dividendYield")),
            pe_ratio=info.get("trailingPE"),
        )
        if quote_type == "ETF":
            profile.dividend_yield = _pct_to_fraction(info.get("dividendYield")) or info.get(
                "yield"
            )
            try:
                fd = t.funds_data
                profile.etf_sector_weights = {
                    k: float(v) for k, v in (fd.sector_weightings or {}).items() if v
                }
                th = fd.top_holdings
                if th is not None and not th.empty:
                    profile.etf_top_holdings = {
                        str(sym): float(row["Holding Percent"]) for sym, row in th.iterrows()
                    }
            except Exception:
                log.warning("No fund data for %s", ticker)
        return profile

    def get_prices(self, tickers: list[str], start: date, end: date) -> pd.DataFrame:
        df = yf.download(
            tickers,
            start=start.isoformat(),
            end=(end + timedelta(days=1)).isoformat(),
            auto_adjust=True,
            progress=False,
            threads=True,
        )
        if df is None or df.empty:
            return pd.DataFrame(columns=tickers, dtype=float)
        close = df["Close"]
        if isinstance(close, pd.Series):  # single ticker
            close = close.to_frame(name=tickers[0])
        close.index = pd.to_datetime(close.index).tz_localize(None).normalize()
        return close.reindex(columns=tickers).astype(float)
