from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Comma-separated list of origins allowed to call the API (the frontend).
    cors_origins: str = "http://localhost:3000"
    # Database URL (Supabase Postgres in production, SQLite locally).
    database_url: str = "sqlite:///./gini_minnie.db"
    # Local cache for market data (safe to delete).
    cache_path: str = "./.cache/market.sqlite"
    # Annual risk-free rate used for Sharpe and Sortino (approx. 3-month T-bill).
    risk_free_rate: float = 0.04
    # Optional provider keys. Free sources are used when these are empty.
    finnhub_api_key: str = ""
    anthropic_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
