from app.models import Portfolio, PortfolioSummary, WeightedHolding


def summarize(portfolio: Portfolio) -> PortfolioSummary:
    """Compute total value and each holding's weight from dollar amounts.

    Holdings are returned sorted by amount, largest first.
    """
    total = sum(h.amount_usd for h in portfolio.holdings)
    weighted = [
        WeightedHolding(**h.model_dump(), weight=h.amount_usd / total)
        for h in sorted(portfolio.holdings, key=lambda h: h.amount_usd, reverse=True)
    ]
    locked_total = sum(h.amount_usd for h in portfolio.holdings if h.locked)
    return PortfolioSummary(
        total_usd=total,
        holdings=weighted,
        locked_total_usd=locked_total,
        locked_weight=locked_total / total,
    )


def respects_locks(before: Portfolio, after: Portfolio) -> bool:
    """True if no locked holding from `before` was sold (amount never decreases).

    This is the rule every suggestion and what-if result must satisfy.
    """
    after_amounts = {h.ticker: h.amount_usd for h in after.holdings}
    return all(
        after_amounts.get(h.ticker, 0.0) >= h.amount_usd - 1e-9 for h in before.holdings if h.locked
    )
