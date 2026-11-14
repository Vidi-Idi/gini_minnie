import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """App settings, read from environment variables or a .env file."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Comma-separated list of origins allowed to call the API (the frontend).
    cors_origins: str = "http://localhost:3000"
    # Database URL (Supabase Postgres in production, SQLite locally).
    database_url: str = "sqlite:///./gini_minnie.db"
    # Local cache for market data (safe to delete). On Vercel only /tmp is writable.
    cache_path: str = (
        "/tmp/gini_minnie_market.sqlite" if os.environ.get("VERCEL") else "./.cache/market.sqlite"
    )
    # Annual risk-free rate used for Sharpe and Sortino (approx. 3-month T-bill).
    risk_free_rate: float = 0.04
    # Optional provider keys. Free sources are used when these are empty.
    finnhub_api_key: str = ""
    anthropic_api_key: str = ""

    @property
    def cors_origin_list(self) -> list[str]:
        """Origins from CORS_ORIGINS, forgiving common copy-paste mistakes.

        Browsers send the origin without a trailing slash or path, so
        "https://x.vercel.app/" or "x.vercel.app" would never match as typed.
        """
        out = []
        for raw in self.cors_origins.replace("\n", ",").split(","):
            o = raw.strip().strip("'\"").strip()
            if not o:
                continue
            if "://" not in o:
                o = "https://" + o
            scheme, rest = o.split("://", 1)
            out.append(f"{scheme.lower()}://{rest.split('/', 1)[0].lower()}")
        return list(dict.fromkeys(out))


@lru_cache
def get_settings() -> Settings:
    return Settings()
