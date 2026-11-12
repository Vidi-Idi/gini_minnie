import numpy as np
import pandas as pd
import pytest

from app.analytics.metrics import analyze, sector_breakdown
from app.analytics.weights import summarize
from app.models import Holding, Portfolio
from tests.conftest import PROFILES


def _prices(port_rets, bench_rets, start="2025-01-01"):
    idx = pd.bdate_range(start, periods=len(port_rets) + 1)
    return pd.DataFrame(
        {
            "AAA": 100 * np.cumprod(np.r_[1, 1 + np.asarray(port_rets)]),
            "SPY": 100 * np.cumprod(np.r_[1, 1 + np.asarray(bench_rets)]),
        },
        index=idx,
    )


def _run(prices, rf=0.0):
    summary = summarize(Portfolio(holdings=[Holding(ticker="AAA", amount_usd=1000)]))
    return analyze(summary, prices, PROFILES, "SPY", rf)


def test_beta_is_exact_for_leveraged_series():
    rng = np.random.default_rng(1)
    bench = rng.normal(0, 0.01, 300)
    res = _run(_prices(2 * bench, bench))
    assert res.kpis.beta == pytest.approx(2.0)
    assert res.kpis.correlation_to_benchmark == pytest.approx(1.0)


def test_max_drawdown_and_series_start_at_100():
    # +10%, then -20%, then +5%: peak 110, trough 88 -> drawdown -20%
    rets = [0.10, -0.20, 0.05] + [0.001, -0.001] * 30
    res = _run(_prices(rets, [0.0005] * len(rets)))
    assert res.kpis.max_drawdown == pytest.approx(-0.20)
    assert res.series.portfolio[0] == 100
    assert res.series.benchmark[0] == 100
    assert len(res.series.dates) == len(res.series.drawdown)


def test_window_is_one_year_and_returns_consistent():
    n = 400
    res = _run(_prices([0.001] * n, [0.0] * n))
    start, end = pd.Timestamp(res.window_start), pd.Timestamp(res.window_end)
    assert 360 <= (end - start).days <= 366
    assert res.kpis.return_1y == pytest.approx(res.series.portfolio[-1] / 100 - 1, rel=1e-5)
    assert res.kpis.benchmark_return_1y == pytest.approx(0.0)
    assert res.kpis.annual_volatility == pytest.approx(0.0, abs=1e-12)
    assert res.kpis.correlation_to_benchmark is None  # flat benchmark: undefined, not NaN


def test_short_history_warns():
    res = _run(_prices([0.001] * 100, [0.0] * 100))
    assert res.kpis.return_1y is None
    assert any("price history only since" in w for w in res.warnings)


def test_sector_breakdown_looks_through_etfs():
    slices = {s.label: s.weight for s in sector_breakdown({"AAA": 0.5, "ETF1": 0.5}, PROFILES)}
    assert slices["Technology"] == pytest.approx(0.5 + 0.25)
    assert slices["Energy"] == pytest.approx(0.15)
    assert slices["Other"] == pytest.approx(0.10)
    assert sum(slices.values()) == pytest.approx(1.0)
