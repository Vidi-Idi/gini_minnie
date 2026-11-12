from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import portfolio
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


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
