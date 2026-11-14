from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import portfolio, tickers
from app.config import get_settings

settings = get_settings()

app = FastAPI(title="gini_minnie API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(portfolio.router)
app.include_router(tickers.router)


@app.get("/")
def root() -> dict[str, str]:
    return {"message": "gini_minnie API is running. Health check: /api/health"}


@app.get("/api/health")
def health() -> dict[str, object]:
    # Allowed origins are public website addresses, shown here to make setup easy to check.
    return {"status": "ok", "allowed_origins": settings.cors_origin_list}
