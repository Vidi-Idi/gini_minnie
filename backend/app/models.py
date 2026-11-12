from pydantic import BaseModel, Field, field_validator


class Holding(BaseModel):
    """One position as entered by the user: a ticker and the dollar amount held."""

    ticker: str = Field(min_length=1, max_length=10)
    amount_usd: float = Field(gt=0)
    locked: bool = False

    @field_validator("ticker")
    @classmethod
    def normalize_ticker(cls, v: str) -> str:
        return v.strip().upper()


class Portfolio(BaseModel):
    holdings: list[Holding] = Field(min_length=1)

    @field_validator("holdings")
    @classmethod
    def no_duplicates(cls, v: list[Holding]) -> list[Holding]:
        seen: set[str] = set()
        for h in v:
            if h.ticker in seen:
                raise ValueError(f"Duplicate ticker: {h.ticker}")
            seen.add(h.ticker)
        return v


class WeightedHolding(Holding):
    weight: float  # fraction of total, 0..1


class PortfolioSummary(BaseModel):
    total_usd: float
    holdings: list[WeightedHolding]
    locked_total_usd: float
    locked_weight: float
