"""Portfolio metrics over the last year.

Convention: the portfolio is modeled with today's weights held constant over the
window (rebalanced daily). This answers "how would the current mix have behaved?",
which is what a periodic review needs.
"""

from collections import defaultdict

import numpy as np
import pandas as pd

from app.analytics.schemas import AnalyzeResponse, HoldingDetail, Kpis, Series, Slice
from app.data.models import TickerProfile
from app.models import PortfolioSummary

TRADING_DAYS = 252

# yfinance fund sector keys -> the sector names used for stocks
ETF_SECTOR_NAMES = {
    "technology": "Technology",
    "financial_services": "Financial Services",
    "healthcare": "Healthcare",
    "consumer_cyclical": "Consumer Cyclical",
    "consumer_defensive": "Consumer Defensive",
    "communication_services": "Communication Services",
    "industrials": "Industrials",
    "energy": "Energy",
    "utilities": "Utilities",
    "realestate": "Real Estate",
    "basic_materials": "Basic Materials",
}


def _period_return(index: pd.Series, offset: pd.DateOffset | None = None, since=None):
    """Return of a growth index from a past date (or the last close before `since`)."""
    end = index.iloc[-1]
    if since is not None:
        past = index[index.index < since]
    else:
        past = index[index.index <= index.index[-1] - offset]
    if past.empty:
        return None
    return float(end / past.iloc[-1] - 1)


def _ann_return(r: pd.Series) -> float:
    growth = float((1 + r).prod())
    return growth ** (TRADING_DAYS / len(r)) - 1


def _sorted_slices(d: dict[str, float]) -> list[Slice]:
    items = sorted(((k, v) for k, v in d.items() if v > 1e-6), key=lambda kv: -kv[1])
    return [Slice(label=k, weight=v) for k, v in items]


def _cap_bucket(p: TickerProfile) -> str:
    if p.quote_type == "ETF":
        return "ETF"
    mc = p.market_cap
    if mc is None:
        return "Unknown"
    if mc >= 200e9:
        return "Mega cap (>$200B)"
    if mc >= 10e9:
        return "Large cap ($10–200B)"
    if mc >= 2e9:
        return "Mid cap ($2–10B)"
    return "Small cap (<$2B)"


def sector_breakdown(weights: dict[str, float], profiles: dict[str, TickerProfile]):
    out: dict[str, float] = defaultdict(float)
    for t, w in weights.items():
        p = profiles[t]
        if p.quote_type == "ETF":
            sw = p.etf_sector_weights or {}
            if not sw:
                out["ETF (unclassified)"] += w
                continue
            covered = 0.0
            for k, v in sw.items():
                out[ETF_SECTOR_NAMES.get(k, k.replace("_", " ").title())] += w * v
                covered += v
            if covered < 0.999:
                out["Other"] += w * (1 - covered)
        else:
            out[p.sector or "Unknown"] += w
    return _sorted_slices(out)


def analyze(
    summary: PortfolioSummary,
    prices: pd.DataFrame,
    profiles: dict[str, TickerProfile],
    benchmark: str,
    risk_free_rate: float,
) -> AnalyzeResponse:
    tickers = [h.ticker for h in summary.holdings]
    w = pd.Series({h.ticker: h.weight for h in summary.holdings})
    warnings: list[str] = []

    cols = list(dict.fromkeys(tickers + [benchmark]))
    px = prices[cols].ffill()
    first_dates = px.apply(lambda s: s.first_valid_index())
    if first_dates.isna().any():
        bad = ", ".join(first_dates[first_dates.isna()].index)
        raise ValueError(f"No price history for: {bad}")
    target_start = px.index[-1] - pd.DateOffset(years=1)
    for t, d in first_dates.items():
        if d - target_start > pd.Timedelta(days=7):
            warnings.append(
                f"{t} has price history only since {d:%b %d, %Y}; "
                "metrics use the shorter common window."
            )
    # Use exactly one year: start at the last close on or before (last date - 1 year).
    one_year_ago = px.index[-1] - pd.DateOffset(years=1)
    before = px.index[px.index <= one_year_ago]
    window_start = before[-1] if len(before) else px.index[0]
    px = px.loc[max(window_start, first_dates.max()) :]
    if len(px) < 40:
        raise ValueError("Not enough common price history to analyze (need about 2 months).")

    rets = px.pct_change().dropna()
    port = rets[tickers] @ w[tickers]
    bench = rets[benchmark]

    port_idx = 100 * (1 + port).cumprod()
    bench_idx = 100 * (1 + bench).cumprod()
    # Prepend the starting point so both series begin at exactly 100.
    start_day = px.index[0]
    port_idx = pd.concat([pd.Series([100.0], index=[start_day]), port_idx])
    bench_idx = pd.concat([pd.Series([100.0], index=[start_day]), bench_idx])
    drawdown = port_idx / port_idx.cummax() - 1

    rf_daily = (1 + risk_free_rate) ** (1 / TRADING_DAYS) - 1
    ann_ret = _ann_return(port)
    vol = float(port.std(ddof=1) * np.sqrt(TRADING_DAYS))
    downside = np.minimum(port - rf_daily, 0)
    down_dev = float(np.sqrt((downside**2).mean()) * np.sqrt(TRADING_DAYS))
    bench_var = float(bench.var(ddof=1))
    beta = float(port.cov(bench) / bench_var) if bench_var > 0 else None
    full_year = (px.index[-1] - px.index[0]).days >= 360
    last = port_idx.index[-1]

    cov = rets[tickers].cov()
    port_var = float(w @ cov @ w)
    rc = (w * (cov @ w)) / port_var if port_var > 0 else pd.Series(np.nan, index=tickers)

    holdings: list[HoldingDetail] = []
    for h in summary.holdings:
        p = profiles[h.ticker]
        r = rets[h.ticker]
        window_ret = float((1 + r).prod() - 1)
        holdings.append(
            HoldingDetail(
                ticker=h.ticker,
                name=p.name,
                quote_type=p.quote_type,
                exchange=p.exchange,
                sector=p.sector,
                amount_usd=h.amount_usd,
                weight=h.weight,
                locked=h.locked,
                return_1y=window_ret,
                annual_volatility=float(r.std(ddof=1) * np.sqrt(TRADING_DAYS)),
                contribution_to_return=h.weight * window_ret,
                risk_contribution=float(rc[h.ticker]),
            )
        )

    wd = w.to_dict()
    stock_pe = [(wd[t], profiles[t].pe_ratio) for t in tickers if (profiles[t].pe_ratio or 0) > 0]
    pe = sum(x for x, _ in stock_pe) / sum(x / v for x, v in stock_pe) if stock_pe else None
    div_yield = sum(wd[t] * (profiles[t].dividend_yield or 0.0) for t in tickers)

    types: dict[str, float] = defaultdict(float)
    caps: dict[str, float] = defaultdict(float)
    for t in tickers:
        types["ETFs" if profiles[t].quote_type == "ETF" else "Stocks"] += wd[t]
        caps[_cap_bucket(profiles[t])] += wd[t]

    corr = rets[tickers].corr().fillna(0.0).round(4)
    np.fill_diagonal(corr.values, 1.0)
    corr_bench = port.corr(bench)

    kpis = Kpis(
        total_usd=summary.total_usd,
        return_1d=float(port.iloc[-1]),
        return_1m=_period_return(port_idx, pd.DateOffset(months=1)),
        return_3m=_period_return(port_idx, pd.DateOffset(months=3)),
        return_ytd=_period_return(port_idx, since=pd.Timestamp(year=last.year, month=1, day=1)),
        return_1y=float(port_idx.iloc[-1] / 100 - 1) if full_year else None,
        benchmark_return_1y=float(bench_idx.iloc[-1] / 100 - 1) if full_year else None,
        annual_volatility=vol,
        sharpe=(ann_ret - risk_free_rate) / vol if vol > 0 else None,
        sortino=(ann_ret - risk_free_rate) / down_dev if down_dev > 0 else None,
        max_drawdown=float(drawdown.min()),
        beta=beta,
        correlation_to_benchmark=None if np.isnan(corr_bench) else float(corr_bench),
        dividend_yield=div_yield,
        pe_ratio=pe,
        holdings_count=len(tickers),
        effective_holdings=float(1 / (w**2).sum()),
    )

    return AnalyzeResponse(
        benchmark=benchmark,
        window_start=f"{px.index[0]:%Y-%m-%d}",
        window_end=f"{px.index[-1]:%Y-%m-%d}",
        kpis=kpis,
        holdings=holdings,
        series=Series(
            dates=[f"{d:%Y-%m-%d}" for d in port_idx.index],
            portfolio=[round(float(v), 4) for v in port_idx],
            benchmark=[round(float(v), 4) for v in bench_idx],
            drawdown=[round(float(v), 5) for v in drawdown],
        ),
        sectors=sector_breakdown(wd, profiles),
        asset_types=_sorted_slices(types),
        market_caps=_sorted_slices(caps),
        correlation={a: {b: float(corr.loc[a, b]) for b in tickers} for a in tickers},
        profiles={t: profiles[t] for t in cols},
        warnings=warnings,
    )
