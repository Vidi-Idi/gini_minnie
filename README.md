# gini_minnie

A web app that analyzes a US stock and ETF portfolio (NYSE and NASDAQ). It is built for a review every 2–4 weeks, not day trading.

See [`docs/PHASE1_PLAN.md`](docs/PHASE1_PLAN.md) for the full Phase 1 plan.

## Status

| Milestone | State |
|-----------|-------|
| M0 Setup: FastAPI backend, Next.js frontend, CI | ✅ |
| Portfolio input: $ amounts, computed weights, locks | ✅ (saved in the browser for now) |
| M1 Market data layer: Yahoo Finance prices and profiles, NYSE/NASDAQ validation, cache | ✅ |
| M2 Overview: KPIs, performance vs chosen benchmark, drawdown, sectors (ETF look-through), holdings | ✅ |
| M3 Risk: correlation heatmap and risk contribution | ✅ first version (efficient frontier and VaR next) |
| M4 What-if: add a ticker | Next |

## Project layout

```
backend/   FastAPI (Python) — analytics and data API
frontend/  Next.js (React + TypeScript + Tailwind) — the web app
docs/      Plans and design notes
```

## Run locally

Backend (http://localhost:8000, API docs at `/docs`):

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
cp .env.example .env
.venv/bin/uvicorn app.main:app --reload
```

Frontend (http://localhost:3000):

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Checks:

```bash
cd backend && .venv/bin/ruff check . && .venv/bin/pytest -q
cd frontend && npm run lint && npm run build
```

---
For informational purposes only, not investment advice.
